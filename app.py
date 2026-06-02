from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS
import firebase_admin
from firebase_admin import auth, credentials, firestore, messaging
import os
import time
import json
import traceback
from urllib import request as urlrequest
from urllib import parse as urlparse
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin

app = Flask(__name__)
APP_BUILD = "20260531-route-check"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_EXTENSIONS = {".html", ".js", ".css", ".json", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".txt"}
PUBLIC_FILES = {
    "index.html",
    "login.html",
    "signup.html",
    "exchange.html",
    "convert.html",
    "payment.html",
    "deposit.html",
    "withdraw.html",
    "transfer.html",
    "wallet-convert.html",
    "orders.html",
    "order-detail.html",
    "success.html",
    "profile.html",
    "kyc.html",
    "dashboard.html",
    "settings.html",
    "notifications.html",
    "notification-settings.html",
    "payment-method.html",
    "add-payment-method.html",
    "security.html",
    "withdrawal-pin.html",
    "about.html",
    "contact.html",
    "privacy.html",
    "terms.html",
    "refund.html",
    "kyc-aml.html",
    "customers.html",
    "profit.html",
    "rates.html",
    "announcements.html",
    "kyc-admin.html",
    "support.html",
    "support-admin.html",
    "support-chat-admin.html",
    "app.js",
    "styles.css",
    "style.css",
    "manifest.json",
    "sw.js",
    "firebase-messaging-sw.js",
    "icon.png",
}

ALLOWED_ORIGINS = [
    "https://atvexchange.pythonanywhere.com",
    "https://www.atvexchange.pythonanywhere.com",
    "https://atvexchange.net",
    "https://www.atvexchange.net",
    "https://austintradeventures.github.io",
    "https://austintradeventures.github.io/ATV_Exchange",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

SERVICE_ACCOUNT_PATH = os.environ.get(
    "FIREBASE_SERVICE_ACCOUNT",
    "/home/ATVEXCHANGE/firebase-service-account.json"
)
APP_BASE_URL = os.environ.get(
    "ATV_APP_BASE_URL",
    "https://www.atvexchange.net"
).rstrip("/")

ADMIN_EMAILS = {
    "ezeaugustinemmaduabuchi@gmail.com",
}

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()


def json_error(message, status=400):
    return jsonify({"ok": False, "message": message}), status


def backend_log(event, data=None):
    try:
        print("[ATV]", event, json.dumps(data or {}, default=str), flush=True)
    except Exception:
        print("[ATV]", event, data, flush=True)


def verify_request_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None

    token = header.replace("Bearer ", "", 1).strip()
    if not token:
        return None

    return auth.verify_id_token(token)


def is_admin(decoded):
    email = (decoded or {}).get("email", "").strip().lower()
    return email in ADMIN_EMAILS


def absolute_link(link):
    if not link:
        return APP_BASE_URL + "/exchange.html"
    if link.startswith("http://") or link.startswith("https://"):
        return link
    return urljoin(APP_BASE_URL + "/", link.lstrip("./"))


def stringify_data(data):
    output = {}
    for key, value in (data or {}).items():
        if value is None:
            continue
        output[str(key)] = value if isinstance(value, str) else str(value)
    return output


def token_docs_for_user(uid):
    if not uid:
        return []

    docs = db.collection("users").document(uid).collection("fcmTokens").stream()
    tokens = []
    for doc in docs:
        token_doc = doc.to_dict() or {}
        if token_doc.get("enabled") is False:
            continue
        token = token_doc.get("token")
        if token:
            tokens.append(token)
    return tokens


def user_allows_push_type(user, push_type):
    settings = (user or {}).get("notificationSettings") or {}
    if settings.get("pushEnabled") is False:
        return False
    if push_type == "announcement" and settings.get("announcements") is False:
        return False
    if push_type == "rate-update" and settings.get("rateUpdates") is False:
        return False
    return True


def admin_tokens():
    tokens = []
    users = db.collection("users").stream()
    for doc in users:
        user = doc.to_dict() or {}
        email = str(user.get("email") or "").strip().lower()
        if email in ADMIN_EMAILS:
            tokens.extend(token_docs_for_user(doc.id))
    return tokens


def all_customer_tokens():
    tokens = []
    users = db.collection("users").stream()
    for doc in users:
        user = doc.to_dict() or {}
        if not user_allows_push_type(user, "announcement"):
            continue
        tokens.extend(token_docs_for_user(doc.id))
    return tokens


def all_customer_tokens_for_type(push_type):
    tokens = []
    users = db.collection("users").stream()
    for doc in users:
        user = doc.to_dict() or {}
        if user_allows_push_type(user, push_type):
            tokens.extend(token_docs_for_user(doc.id))
    return tokens


def send_push(tokens, title, body, link, data=None):
    clean_tokens = list(dict.fromkeys([token for token in tokens if token]))
    resolved_link = absolute_link(link)

    if not clean_tokens:
        return {
            "status": "no_tokens",
            "successCount": 0,
            "failureCount": 0,
            "link": resolved_link,
        }

    payload_data = stringify_data({
        **(data or {}),
        "title": title,
        "body": body,
        "link": resolved_link,
        "icon": APP_BASE_URL + "/icon.png",
        "badge": APP_BASE_URL + "/icon.png",
        "priority": (data or {}).get("priority", "medium"),
    })
    priority = str((data or {}).get("priority", "medium")).lower()
    is_important = priority in {"critical", "high"}

    response = messaging.send_each_for_multicast(
        messaging.MulticastMessage(
            tokens=clean_tokens,
            webpush=messaging.WebpushConfig(
                headers={"Urgency": "high" if is_important else "normal"},
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon=APP_BASE_URL + "/icon.png",
                    badge=APP_BASE_URL + "/icon.png",
                    tag=str((data or {}).get("type", "atv-notification")),
                    renotify=True,
                    require_interaction=is_important,
                    vibrate=[220, 120, 220] if is_important else [120],
                    data={"link": resolved_link, **(data or {})},
                ),
                fcm_options=messaging.WebpushFCMOptions(link=resolved_link),
            ),
            data=payload_data,
        )
    )

    return {
        "status": "sent",
        "successCount": response.success_count,
        "failureCount": response.failure_count,
        "link": resolved_link,
    }


def save_push_log(decoded, target, payload, result):
    db.collection("pushLogs").add({
        "target": target,
        "title": payload.get("title", ""),
        "body": payload.get("body", ""),
        "link": result.get("link", payload.get("link", "")),
        "data": payload.get("data", {}),
        "status": result.get("status", ""),
        "successCount": result.get("successCount", 0),
        "failureCount": result.get("failureCount", 0),
        "requestedByUid": decoded.get("uid", ""),
        "requestedByEmail": decoded.get("email", ""),
        "createdAt": firestore.SERVER_TIMESTAMP,
    })


def validate_push_payload(data, require_user=False):
    if require_user and not data.get("userId"):
        return "Missing userId"
    if not data.get("title"):
        return "Missing title"
    if not data.get("body"):
        return "Missing body"
    return ""


def normalize_payload(data, default_link):
    return {
        "title": data.get("title", ""),
        "body": data.get("body") or data.get("message") or "",
        "link": data.get("link") or data.get("actionLink") or default_link,
        "data": data.get("data") or data.get("metadata") or {},
    }


def account_blocks_transfer(user):
    status = str((user or {}).get("accountStatus") or (user or {}).get("status") or "active").strip().lower()
    return (
        status in {"banned", "ban", "restricted", "suspended"}
        or (user or {}).get("banned") is True
        or (user or {}).get("transferRestricted") is True
        or (user or {}).get("restrictedFromTransfer") is True
    )


def number_value(value):
    try:
        value = float(value)
        if value != value:
            return 0.0
        return value
    except Exception:
        return 0.0


def clean_money(value):
    return round(number_value(value), 2)


def to_base36(value):
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    value = int(value or 0)
    if value == 0:
        return "0"
    result = ""
    while value:
        value, remainder = divmod(value, 36)
        result = digits[remainder] + result
    return result


def pin_hash(value):
    hash_value = 5381
    for char in str(value or ""):
        hash_value = ((hash_value << 5) + hash_value) + ord(char)
    return to_base36(abs(hash_value))


def verify_withdrawal_pin(user_id, raw_pin):
    pin = str(raw_pin or "").strip()
    if not pin or not pin.isdigit() or len(pin) < 4 or len(pin) > 6:
        raise PermissionError("Incorrect withdrawal PIN")

    security_doc = (
        db.collection("users")
        .document(user_id)
        .collection("security")
        .document("withdrawalPin")
        .get()
    )
    security_data = security_doc.to_dict() if security_doc.exists else {}
    expected = (security_data or {}).get("withdrawalPinHash")

    if not expected:
        user_doc = db.collection("users").document(user_id).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        expected = (user_data or {}).get("withdrawalPinHash")

    if not expected:
        raise PermissionError("Withdrawal PIN is required")

    if pin_hash(user_id + "-" + pin) != expected:
        raise PermissionError("Incorrect withdrawal PIN")

    return True


def require_signed_in_request():
    try:
        decoded = verify_request_user()
    except Exception:
        decoded = None
    if not decoded:
        raise PermissionError("Invalid Firebase token")
    return decoded


def http_json(method, url, headers=None, body=None, timeout=18):
    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
    req = urlrequest.Request(url, data=payload, method=method.upper())
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    try:
        with urlrequest.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw or "{}")
    except HTTPError as exc:
        try:
            raw = exc.read().decode("utf-8")
            data = json.loads(raw or "{}")
        except Exception:
            data = {}
        message = data.get("message") or data.get("error") or "Verification provider rejected the request"
        raise ValueError(message)
    except URLError as exc:
        raise ValueError("Verification provider is unavailable: " + str(exc.reason))


def verified_name_from_response(data):
    if not isinstance(data, dict):
        return ""
    candidates = [
        data.get("account_name"),
        data.get("accountName"),
        data.get("accountNameEnquiry"),
        data.get("momoName"),
        data.get("name"),
    ]
    nested = data.get("data") if isinstance(data.get("data"), dict) else {}
    candidates.extend([
        nested.get("account_name"),
        nested.get("accountName"),
        nested.get("full_name"),
        nested.get("name"),
        nested.get("momoName"),
    ])
    for value in candidates:
        if value:
            return str(value).strip()
    return ""


def flutterwave_secret_key():
    return (
        os.environ.get("FLW_SECRET_KEY", "").strip()
        or os.environ.get("FLUTTERWAVE_SECRET_KEY", "").strip()
    )


def flutterwave_public_key():
    return os.environ.get("FLW_PUBLIC_KEY", "").strip()


def flutterwave_secret_hash():
    return os.environ.get("FLW_SECRET_HASH", "").strip()


def flutterwave_headers():
    secret = flutterwave_secret_key()
    if not secret:
        raise ValueError("Flutterwave secret key is not configured")
    return {"Authorization": "Bearer " + secret}


def flutterwave_status(data):
    if not isinstance(data, dict):
        return ""
    nested = data.get("data") if isinstance(data.get("data"), dict) else {}
    return str(nested.get("status") or data.get("status") or "").strip().lower()


def flutterwave_data(data):
    return data.get("data") if isinstance(data, dict) and isinstance(data.get("data"), dict) else {}


def verify_flutterwave_reference(tx_ref):
    tx_ref = str(tx_ref or "").strip()
    if not tx_ref:
        raise ValueError("Missing Flutterwave transaction reference")
    query = urlparse.urlencode({"tx_ref": tx_ref})
    result = http_json(
        "GET",
        "https://api.flutterwave.com/v3/transactions/verify_by_reference?" + query,
        headers=flutterwave_headers(),
    )
    backend_log("flutterwave.verify.response", {"tx_ref": tx_ref, "response": result})
    return result


def credit_verified_deposit(tx_ref, verification_response):
    data = flutterwave_data(verification_response)
    status = str(data.get("status") or "").lower()
    amount = clean_money(data.get("amount"))
    currency = str(data.get("currency") or "").upper()
    flw_id = str(data.get("id") or "")

    if status != "successful":
        raise ValueError("Flutterwave payment is not successful")
    if currency not in {"NGN", "GHS"}:
        raise ValueError("Unsupported payment currency")
    if amount <= 0:
        raise ValueError("Invalid payment amount")

    deposit_ref = db.collection("deposits").document(tx_ref)
    wallet_ref = db.collection("walletRequests").document(tx_ref)
    payment_ref = db.collection("flutterwavePayments").document(tx_ref)
    transaction_ref = db.collection("transactions").document("DEP-" + tx_ref)
    transaction = db.transaction()

    @firestore.transactional
    def do_credit(tx):
        deposit_doc = deposit_ref.get(transaction=tx)
        if not deposit_doc.exists:
            raise ValueError("Deposit order not found for reference " + tx_ref)
        deposit = deposit_doc.to_dict() or {}

        existing_payment = payment_ref.get(transaction=tx)
        if existing_payment.exists and (existing_payment.to_dict() or {}).get("credited") is True:
            return {"alreadyCredited": True, "depositId": tx_ref}

        expected_amount = clean_money(deposit.get("amount"))
        expected_currency = str(deposit.get("currency") or "").upper()
        if expected_currency != currency:
            raise ValueError("Payment currency mismatch")
        if round(expected_amount, 2) != round(amount, 2):
            raise ValueError("Payment amount mismatch")

        if str(deposit.get("status") or "").lower() in {"credited", "approved"}:
            tx.set(payment_ref, {
                "tx_ref": tx_ref,
                "flutterwaveId": flw_id,
                "status": status,
                "amount": amount,
                "currency": currency,
                "credited": True,
                "duplicate": True,
                "verifiedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                "raw": data,
            }, merge=True)
            return {"alreadyCredited": True, "depositId": tx_ref}

        customer_id = deposit.get("customerId") or deposit.get("user_id")
        if not customer_id:
            raise ValueError("Deposit customer ID is missing")
        balance_ref = db.collection("balances").document(customer_id)
        balance_doc = balance_ref.get(transaction=tx)
        balance = balance_doc.to_dict() if balance_doc.exists else {}
        field = "ngn" if currency == "NGN" else "ghs"
        current_balance = clean_money((balance or {}).get(field, 0))
        new_balance = clean_money(current_balance + amount)
        now_text = time.strftime("%Y-%m-%d %H:%M:%S")

        tx.set(balance_ref, {
            field: new_balance,
            "updatedAt": now_text,
            "lastDepositId": tx_ref,
        }, merge=True)
        update_payload = {
            "status": "credited",
            "flutterwaveStatus": "successful",
            "flutterwaveId": flw_id,
            "paymentProvider": "flutterwave",
            "paymentVerified": True,
            "creditedAt": now_text,
            "updatedAt": now_text,
        }
        tx.set(deposit_ref, update_payload, merge=True)
        tx.set(wallet_ref, {**update_payload, "status": "Credited"}, merge=True)
        tx.set(payment_ref, {
            "tx_ref": tx_ref,
            "flutterwaveId": flw_id,
            "status": status,
            "amount": amount,
            "currency": currency,
            "customerId": customer_id,
            "depositId": tx_ref,
            "credited": True,
            "verifiedAt": now_text,
            "raw": data,
        }, merge=True)
        tx.set(transaction_ref, {
            "orderID": "DEP-" + tx_ref,
            "requestId": tx_ref,
            "type": "deposit",
            "customerId": customer_id,
            "customerEmail": deposit.get("customerEmail", ""),
            "currency": currency,
            "amount": amount,
            "converted": amount,
            "status": "Completed",
            "paymentProvider": "flutterwave",
            "paymentReference": tx_ref,
            "flutterwaveId": flw_id,
            "date": now_text,
            "createdAt": now_text,
        }, merge=True)
        return {"alreadyCredited": False, "depositId": tx_ref, "customerId": customer_id, "amount": amount, "currency": currency}

    return do_credit(transaction)


def can_serve_public_file(filename):
    clean_name = filename.split("?", 1)[0].strip("/")
    if clean_name == "style.css":
        clean_name = "styles.css"
    if not clean_name or clean_name.startswith(".") or ".." in clean_name:
        return False
    if clean_name in PUBLIC_FILES:
        return True
    _, ext = os.path.splitext(clean_name)
    return ext.lower() in PUBLIC_EXTENSIONS and os.path.isfile(os.path.join(BASE_DIR, clean_name))


@app.get("/health")
def health():
    return "Backend is running", 200


@app.get("/diagnostics/routes")
def route_diagnostics():
    return jsonify({
        "ok": True,
        "build": APP_BUILD,
        "baseDir": BASE_DIR,
        "file": __file__,
        "routes": sorted(str(rule) for rule in app.url_map.iter_rules()),
    })


@app.get("/diagnostics/payout-verification")
def payout_verification_diagnostics():
    return jsonify({
        "ok": True,
        "service": "ATV Exchange Payout Verification",
        "flutterwavePayments": {
            "configured": bool(flutterwave_secret_key()),
            "hasPublicKey": bool(flutterwave_public_key()),
            "hasSecretHash": bool(flutterwave_secret_hash()),
            "webhookUrl": APP_BASE_URL + "/api/flutterwave/webhook",
        },
        "ngnBankVerification": {
            "configured": bool(os.environ.get("PAYSTACK_SECRET_KEY", "").strip() or flutterwave_secret_key()),
            "paystack": bool(os.environ.get("PAYSTACK_SECRET_KEY", "").strip()),
            "flutterwave": bool(flutterwave_secret_key()),
        },
        "ghsMomoVerification": {
            "configured": bool(os.environ.get("GHANA_MOMO_VERIFY_URL", "").strip()),
            "hasToken": bool(os.environ.get("GHANA_MOMO_VERIFY_TOKEN", "").strip()),
        },
        "allowedOrigins": ALLOWED_ORIGINS,
    })


@app.get("/diagnostics/pages")
def page_diagnostics():
    pages = sorted([name for name in PUBLIC_FILES if name.endswith(".html")])
    return jsonify({
        "ok": True,
        "baseDir": BASE_DIR,
        "pages": [
            {
                "file": page,
                "exists": os.path.isfile(os.path.join(BASE_DIR, page)),
                "url": APP_BASE_URL + "/" + page,
            }
            for page in pages
        ],
    })


@app.get("/api/verify-bank-account")
def verify_bank_account_status():
    configured = bool(flutterwave_secret_key())
    if not configured:
        backend_log("bank.verify.missing_secret", {"message": "Missing FLW_SECRET_KEY"})
    return jsonify({
        "ok": True,
        "service": "ATV Exchange Bank Account Verification",
        "method": "POST required for verification",
        "provider": "flutterwave",
        "configured": configured,
        "message": "Ready" if configured else "Missing FLW_SECRET_KEY",
    })


@app.post("/verify-ngn-bank")
@app.post("/api/verify-bank-account")
def verify_ngn_bank():
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)

    data = request.get_json(silent=True) or {}
    account_number = str(data.get("account_number") or data.get("accountNumber") or "").strip().replace(" ", "")
    bank_code = str(data.get("bank_code") or data.get("bankCode") or "").strip()
    bank_name = str(data.get("bankName") or "").strip()
    if not account_number.isdigit() or len(account_number) != 10:
        return json_error("Enter a valid 10-digit Nigerian account number")
    if not bank_code:
        return json_error("Bank code is required")
    if not bank_code.isdigit():
        backend_log("bank.verify.invalid_bank_code", {
            "userId": decoded.get("uid", ""),
            "bankCode": bank_code,
            "bankName": bank_name,
            "accountNumberLast4": account_number[-4:],
        })
        return json_error("Bank code must be numeric", 400)

    flutterwave_secret = flutterwave_secret_key()
    if not flutterwave_secret:
        backend_log("bank.verify.missing_secret", {
            "message": "Missing FLW_SECRET_KEY",
            "userId": decoded.get("uid", ""),
            "bankCode": bank_code,
            "bankName": bank_name,
            "accountNumberLast4": account_number[-4:],
        })
        return json_error("Missing FLW_SECRET_KEY", 503)

    backend_log("bank.verify.request", {
        "userId": decoded.get("uid", ""),
        "bankCode": bank_code,
        "bankName": bank_name,
        "accountNumberLast4": account_number[-4:],
        "provider": "flutterwave",
        "requestBody": {"account_number": account_number, "account_bank": bank_code},
    })
    try:
        result = http_json(
            "POST",
            "https://api.flutterwave.com/v3/accounts/resolve",
            headers={"Authorization": "Bearer " + flutterwave_secret},
            body={"account_number": account_number, "account_bank": bank_code},
        )
        backend_log("bank.verify.flutterwave.response", {"response": result})
        account_name = verified_name_from_response(result)
        if not account_name:
            return json_error("Bank account name could not be verified", 400)
        return jsonify({
            "ok": True,
            "provider": "flutterwave",
            "bankName": bank_name,
            "bankCode": bank_code,
            "bank_code": bank_code,
            "accountNumber": account_number,
            "account_number": account_number,
            "accountName": account_name,
            "verifiedAccountName": account_name,
            "userId": decoded.get("uid", ""),
        })
    except ValueError as exc:
        backend_log("bank.verify.flutterwave.error", {"error": str(exc)})
        return json_error(str(exc), 400)
    except Exception as exc:
        backend_log("bank.verify.flutterwave.exception", {"error": str(exc), "trace": traceback.format_exc()})
        return json_error("Bank verification failed: " + str(exc), 500)


@app.post("/verify-ghs-momo")
def verify_ghs_momo():
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)

    data = request.get_json(silent=True) or {}
    momo_number = str(data.get("momoNumber") or data.get("accountNumber") or "").strip().replace(" ", "")
    network = str(data.get("network") or "MTN Mobile Money").strip() or "MTN Mobile Money"
    if not momo_number.isdigit() or len(momo_number) < 9 or len(momo_number) > 15:
        return json_error("Enter a valid MTN MoMo number")

    momo_url = os.environ.get("GHANA_MOMO_VERIFY_URL", "").strip()
    momo_token = os.environ.get("GHANA_MOMO_VERIFY_TOKEN", "").strip()
    if not momo_url:
        return json_error("Mobile Money Account Verification is not configured on backend", 503)

    headers = {}
    if momo_token:
        headers["Authorization"] = "Bearer " + momo_token

    try:
        result = http_json(
            "POST",
            momo_url,
            headers=headers,
            body={"network": "MTN", "momoNumber": momo_number, "accountNumber": momo_number},
        )
        account_name = verified_name_from_response(result)
        if not account_name:
            return json_error("MoMo account name could not be verified", 400)
        return jsonify({
            "ok": True,
            "provider": "momo-name-enquiry",
            "network": network,
            "momoNumber": momo_number,
            "accountNumber": momo_number,
            "accountName": account_name,
            "momoName": account_name,
            "verifiedAccountName": account_name,
            "userId": decoded.get("uid", ""),
        })
    except ValueError as exc:
        return json_error(str(exc), 400)
    except Exception as exc:
        return json_error("MoMo verification failed: " + str(exc), 500)


@app.post("/api/flutterwave/create-payment")
def create_flutterwave_payment():
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)

    data = request.get_json(silent=True) or {}
    tx_ref = str(data.get("tx_ref") or data.get("orderId") or data.get("requestId") or "").strip()
    amount = clean_money(data.get("amount"))
    currency = str(data.get("currency") or "NGN").upper().strip()
    customer_email = str(data.get("email") or decoded.get("email") or "").strip()
    customer_name = str(data.get("customerName") or data.get("name") or customer_email or "ATV customer").strip()

    if not tx_ref:
        return json_error("Missing payment reference")
    if amount <= 0:
        return json_error("Enter a valid payment amount")
    if currency not in {"NGN", "GHS"}:
        return json_error("Invalid payment currency")
    if not customer_email:
        return json_error("Customer email is required")

    redirect_url = APP_BASE_URL + "/deposit.html?tx_ref=" + urlparse.quote(tx_ref)
    payload = {
        "tx_ref": tx_ref,
        "amount": amount,
        "currency": currency,
        "redirect_url": redirect_url,
        "payment_options": "card,banktransfer,ussd",
        "customer": {
            "email": customer_email,
            "name": customer_name,
        },
        "customizations": {
            "title": "ATV Exchange Deposit",
            "description": currency + " wallet deposit",
            "logo": APP_BASE_URL + "/icon.png",
        },
        "meta": {
            "customerId": decoded.get("uid", ""),
            "orderId": tx_ref,
            "type": "deposit",
        },
    }

    try:
        backend_log("flutterwave.create.request", {"tx_ref": tx_ref, "amount": amount, "currency": currency, "userId": decoded.get("uid", "")})
        result = http_json(
            "POST",
            "https://api.flutterwave.com/v3/payments",
            headers=flutterwave_headers(),
            body=payload,
        )
        backend_log("flutterwave.create.response", {"tx_ref": tx_ref, "response": result})
        payment_data = flutterwave_data(result)
        payment_link = payment_data.get("link") or result.get("link")
        if not payment_link:
            return json_error("Flutterwave did not return a payment link", 502)
        db.collection("deposits").document(tx_ref).set({
            "flutterwavePaymentLink": payment_link,
            "flutterwaveCreateResponse": result,
            "paymentProvider": "flutterwave",
            "paymentStatus": "pending",
            "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        }, merge=True)
        return jsonify({"ok": True, "tx_ref": tx_ref, "paymentLink": payment_link, "provider": "flutterwave"})
    except ValueError as exc:
        backend_log("flutterwave.create.error", {"tx_ref": tx_ref, "error": str(exc)})
        return json_error(str(exc), 400)
    except Exception as exc:
        backend_log("flutterwave.create.exception", {"tx_ref": tx_ref, "error": str(exc), "trace": traceback.format_exc()})
        return json_error("Flutterwave payment could not be created", 500)


@app.get("/api/flutterwave/verify/<tx_ref>")
def verify_flutterwave_payment(tx_ref):
    try:
        result = verify_flutterwave_reference(tx_ref)
        credit_result = credit_verified_deposit(tx_ref, result)
        backend_log("flutterwave.verify.success", {"tx_ref": tx_ref, "credit": credit_result})
        return jsonify({"ok": True, "tx_ref": tx_ref, "verification": result, "credit": credit_result})
    except ValueError as exc:
        backend_log("flutterwave.verify.failed", {"tx_ref": tx_ref, "error": str(exc)})
        return json_error(str(exc), 400)
    except Exception as exc:
        backend_log("flutterwave.verify.exception", {"tx_ref": tx_ref, "error": str(exc), "trace": traceback.format_exc()})
        return json_error("Flutterwave verification failed", 500)


@app.get("/api/flutterwave/webhook")
def flutterwave_webhook_status():
    return jsonify({
        "ok": True,
        "service": "ATV Exchange Flutterwave Webhook",
        "method": "POST required for live webhook events",
        "configured": bool(flutterwave_secret_key()),
        "hasSecretHash": bool(flutterwave_secret_hash()),
    })


@app.post("/api/flutterwave/webhook")
def flutterwave_webhook():
    expected_hash = flutterwave_secret_hash()
    received_hash = request.headers.get("verif-hash", "")
    if expected_hash and received_hash != expected_hash:
        backend_log("flutterwave.webhook.invalid_hash", {"received": bool(received_hash)})
        return json_error("Invalid webhook signature", 401)

    payload = request.get_json(silent=True) or {}
    backend_log("flutterwave.webhook.received", payload)
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    tx_ref = str(data.get("tx_ref") or data.get("txRef") or "").strip()
    event = str(payload.get("event") or "").lower()
    if not tx_ref:
        return json_error("Missing transaction reference", 400)

    try:
        verification = verify_flutterwave_reference(tx_ref)
        credit_result = credit_verified_deposit(tx_ref, verification)
        backend_log("flutterwave.webhook.credited", {"tx_ref": tx_ref, "event": event, "credit": credit_result})
        return jsonify({"ok": True, "tx_ref": tx_ref, "credit": credit_result})
    except Exception as exc:
        backend_log("flutterwave.webhook.failed", {"tx_ref": tx_ref, "event": event, "error": str(exc), "trace": traceback.format_exc()})
        return json_error("Webhook verification failed: " + str(exc), 400)


@app.get("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/index.html")
def index_page():
    return send_from_directory(BASE_DIR, "index.html")


@app.post("/notify-user")
@app.post("/send-notification")
def notify_user():
    try:
        decoded = verify_request_user()
    except Exception:
        return json_error("Invalid Firebase token", 401)

    if not decoded:
        return json_error("Missing Firebase token", 401)

    data = request.get_json(silent=True) or {}
    payload = normalize_payload(data, "exchange.html")
    data = {**data, **payload}
    error = validate_push_payload(data, require_user=True)
    if error:
        return json_error(error)

    target_uid = data.get("userId")
    if target_uid != decoded.get("uid") and not is_admin(decoded):
        return json_error("Admin permission required", 403)

    result = send_push(
        token_docs_for_user(target_uid),
        data["title"],
        data["body"],
        data.get("link", "exchange.html"),
        data.get("data", {}),
    )
    save_push_log(decoded, {"userId": target_uid}, data, result)
    return jsonify({"ok": True, **result})


@app.post("/send-self-test")
def send_self_test():
    try:
        decoded = verify_request_user()
    except Exception:
        return json_error("Invalid Firebase token", 401)

    if not decoded:
        return json_error("Missing Firebase token", 401)

    data = request.get_json(silent=True) or {}
    payload = {
        "title": data.get("title", "ATV Exchange Test"),
        "body": data.get("body", "Your phone push notifications are working."),
        "link": data.get("link", "exchange.html"),
        "data": data.get("data", {"type": "test", "priority": "high"}),
    }
    result = send_push(
        token_docs_for_user(decoded.get("uid")),
        payload["title"],
        payload["body"],
        payload["link"],
        payload["data"],
    )
    save_push_log(decoded, {"userId": decoded.get("uid"), "test": True}, payload, result)
    return jsonify({"ok": True, **result})


@app.post("/notify-admins")
@app.post("/send-admin-alert")
def notify_admins():
    try:
        decoded = verify_request_user()
    except Exception:
        return json_error("Invalid Firebase token", 401)

    if not decoded:
        return json_error("Missing Firebase token", 401)

    data = request.get_json(silent=True) or {}
    data = {**data, **normalize_payload(data, "dashboard.html")}
    error = validate_push_payload(data)
    if error:
        return json_error(error)

    result = send_push(
        admin_tokens(),
        data["title"],
        data["body"],
        data.get("link", "dashboard.html"),
        data.get("data", {}),
    )
    save_push_log(decoded, {"role": "admin"}, data, result)
    return jsonify({"ok": True, **result})


@app.post("/broadcast-rate-update")
def broadcast_rate_update():
    try:
        decoded = verify_request_user()
    except Exception:
        return json_error("Invalid Firebase token", 401)

    if not decoded:
        return json_error("Missing Firebase token", 401)
    if not is_admin(decoded):
        return json_error("Admin permission required", 403)

    data = request.get_json(silent=True) or {}
    data = {**data, **normalize_payload(data, "exchange.html")}
    error = validate_push_payload(data)
    if error:
        return json_error(error)

    throttle_ref = db.collection("systemLimits").document("ratePush")
    throttle = throttle_ref.get()
    now_ms = int(time.time() * 1000)
    last_sent = 0
    if throttle.exists:
        last_sent = int((throttle.to_dict() or {}).get("lastSentAtMs") or 0)
    if now_ms - last_sent < 10 * 60 * 1000:
        return jsonify({"ok": False, "status": "rate_limited", "message": "Rate notification already sent in the last 10 minutes"})

    result = send_push(all_customer_tokens_for_type("rate-update"), data["title"], data["body"], data.get("link", "exchange.html"), data.get("data", {}))
    throttle_ref.set({"lastSentAtMs": now_ms, "lastSentAt": firestore.SERVER_TIMESTAMP}, merge=True)
    save_push_log(decoded, {"role": "customer", "broadcast": "rate-update"}, data, result)
    return jsonify({"ok": True, **result})


@app.post("/broadcast-announcement")
def broadcast_announcement():
    try:
        decoded = verify_request_user()
    except Exception:
        return json_error("Invalid Firebase token", 401)

    if not decoded:
        return json_error("Missing Firebase token", 401)
    if not is_admin(decoded):
        return json_error("Admin permission required", 403)

    data = request.get_json(silent=True) or {}
    data = {**data, **normalize_payload(data, "exchange.html")}
    error = validate_push_payload(data)
    if error:
        return json_error(error)

    result = send_push(all_customer_tokens_for_type("announcement"), data["title"], data["body"], data.get("link", "exchange.html"), data.get("data", {}))
    save_push_log(decoded, {"role": "customer", "broadcast": "announcement"}, data, result)
    return jsonify({"ok": True, **result})


@app.post("/notify-event")
def notify_event():
    try:
        decoded = verify_request_user()
    except Exception:
        return json_error("Invalid Firebase token", 401)

    if not decoded:
        return json_error("Missing Firebase token", 401)

    data = request.get_json(silent=True) or {}
    event = data.get("event", "")
    payload = data.get("payload", {})

    if event.startswith("admin."):
        request_payload = {
            "title": payload.get("title", "ATV Exchange Admin Alert"),
            "body": payload.get("body", "A new admin action needs attention."),
            "link": payload.get("link", "dashboard.html"),
            "data": payload.get("data", {}),
        }
        result = send_push(
            admin_tokens(),
            request_payload["title"],
            request_payload["body"],
            request_payload["link"],
            request_payload["data"],
        )
        save_push_log(decoded, {"role": "admin", "event": event}, request_payload, result)
        return jsonify({"ok": True, **result})

    if event.startswith("user."):
        user_id = payload.get("userId")
        if user_id != decoded.get("uid") and not is_admin(decoded):
            return json_error("Admin permission required", 403)
        request_payload = {
            "userId": user_id,
            "title": payload.get("title", "ATV Exchange"),
            "body": payload.get("body", "You have a new update."),
            "link": payload.get("link", "exchange.html"),
            "data": payload.get("data", {}),
        }
        result = send_push(
            token_docs_for_user(user_id),
            request_payload["title"],
            request_payload["body"],
            request_payload["link"],
            request_payload["data"],
        )
        save_push_log(decoded, {"userId": user_id, "event": event}, request_payload, result)
        return jsonify({"ok": True, **result})

    return json_error("Unknown notification event")


@app.post("/internal-transfer")
def internal_transfer():
    try:
        decoded = verify_request_user()
    except Exception:
        return json_error("Invalid Firebase token", 401)

    if not decoded:
        return json_error("Missing Firebase token", 401)

    data = request.get_json(silent=True) or {}
    sender_id = decoded.get("uid", "")
    sender_email = decoded.get("email", "")
    recipient_id = str(data.get("recipientId") or "").strip()
    currency = str(data.get("currency") or "").strip().upper()
    amount = clean_money(data.get("amount"))
    request_id = str(data.get("requestId") or ("TRF-" + str(int(time.time() * 1000)))).strip()

    if not sender_id:
        return json_error("Missing sender", 401)
    if not recipient_id:
        return json_error("Missing recipient")
    if recipient_id == sender_id:
        return json_error("You cannot send money to yourself")
    if currency not in {"GHS", "NGN"}:
        return json_error("Invalid currency")
    if amount <= 0:
        return json_error("Enter a valid amount")
    try:
        verify_withdrawal_pin(sender_id, data.get("withdrawalPin"))
    except PermissionError as exc:
        return json_error(str(exc), 403)

    sender_ref = db.collection("users").document(sender_id)
    recipient_ref = db.collection("users").document(recipient_id)
    sender_balance_ref = db.collection("balances").document(sender_id)
    recipient_balance_ref = db.collection("balances").document(recipient_id)
    wallet_ref = db.collection("walletRequests").document(request_id)
    sender_tx_ref = db.collection("transactions").document(request_id + "-sender")
    recipient_tx_ref = db.collection("transactions").document(request_id + "-recipient")

    transaction = db.transaction()

    @firestore.transactional
    def do_transfer(tx):
        sender_doc = sender_ref.get(transaction=tx)
        recipient_doc = recipient_ref.get(transaction=tx)
        if not sender_doc.exists:
            raise ValueError("Sender account not found")
        if not recipient_doc.exists:
            raise ValueError("Recipient not found")

        sender_user = sender_doc.to_dict() or {}
        recipient_user = recipient_doc.to_dict() or {}
        if account_blocks_transfer(sender_user):
            raise PermissionError("This account is restricted from transfers")

        existing_transfer = wallet_ref.get(transaction=tx)
        if existing_transfer.exists:
            raise ValueError("Duplicate transfer request")

        sender_balance_doc = sender_balance_ref.get(transaction=tx)
        recipient_balance_doc = recipient_balance_ref.get(transaction=tx)
        sender_balance = sender_balance_doc.to_dict() if sender_balance_doc.exists else {}
        recipient_balance = recipient_balance_doc.to_dict() if recipient_balance_doc.exists else {}

        field = "ngn" if currency == "NGN" else "ghs"
        sender_ghs = clean_money((sender_balance or {}).get("ghs", 0))
        sender_ngn = clean_money((sender_balance or {}).get("ngn", 0))
        recipient_ghs = clean_money((recipient_balance or {}).get("ghs", 0))
        recipient_ngn = clean_money((recipient_balance or {}).get("ngn", 0))
        available = sender_ngn if field == "ngn" else sender_ghs
        if available < amount:
            raise ValueError("Insufficient " + currency + " balance")

        sender_name = (
            data.get("senderName")
            or sender_user.get("fullName")
            or sender_user.get("name")
            or sender_user.get("username")
            or sender_email
            or "ATV user"
        )
        recipient_name = (
            data.get("recipientName")
            or recipient_user.get("fullName")
            or recipient_user.get("name")
            or recipient_user.get("username")
            or "ATV user"
        )
        recipient_username = data.get("recipientUsername") or recipient_user.get("username") or ""
        recipient_uid = data.get("recipientTransferUid") or recipient_user.get("transferUid") or recipient_user.get("atvUid") or ""
        now_text = time.strftime("%Y-%m-%d %H:%M:%S")

        new_sender_ghs = clean_money(sender_ghs - amount) if currency == "GHS" else sender_ghs
        new_sender_ngn = clean_money(sender_ngn - amount) if currency == "NGN" else sender_ngn
        new_recipient_ghs = clean_money(recipient_ghs + amount) if currency == "GHS" else recipient_ghs
        new_recipient_ngn = clean_money(recipient_ngn + amount) if currency == "NGN" else recipient_ngn

        base_payload = {
            "requestId": request_id,
            "senderId": sender_id,
            "senderEmail": sender_email,
            "senderName": sender_name,
            "recipientId": recipient_id,
            "recipientName": recipient_name,
            "recipientUsername": recipient_username,
            "recipientTransferUid": recipient_uid,
            "currency": currency,
            "amount": amount,
            "type": "internal-transfer",
            "status": "Successful",
            "createdAt": now_text,
            "updatedAt": now_text,
            "processedBy": "pythonanywhere-backend",
        }

        tx.set(wallet_ref, base_payload)
        tx.set(sender_balance_ref, {
            "ghs": new_sender_ghs,
            "ngn": new_sender_ngn,
            "updatedAt": now_text,
            "lastTransferId": request_id,
            "lastTransferDirection": "sent",
        }, merge=True)
        tx.set(recipient_balance_ref, {
            "ghs": new_recipient_ghs,
            "ngn": new_recipient_ngn,
            "updatedAt": now_text,
            "lastTransferId": request_id,
            "lastTransferDirection": "received",
        }, merge=True)
        tx.set(sender_tx_ref, {
            **base_payload,
            "orderID": request_id,
            "direction": "sent",
            "customerId": sender_id,
            "customerEmail": sender_email,
            "converted": amount,
            "status": "Completed",
            "date": now_text,
        })
        tx.set(recipient_tx_ref, {
            **base_payload,
            "orderID": request_id,
            "direction": "received",
            "customerId": recipient_id,
            "converted": amount,
            "status": "Completed",
            "date": now_text,
        })

        return {
            "requestId": request_id,
            "senderName": sender_name,
            "recipientName": recipient_name,
            "recipientUsername": recipient_username,
            "recipientTransferUid": recipient_uid,
            "currency": currency,
            "amount": amount,
        }

    try:
        result = do_transfer(transaction)
        return jsonify({"ok": True, **result})
    except PermissionError as exc:
        return json_error(str(exc), 403)
    except ValueError as exc:
        return json_error(str(exc), 400)
    except Exception as exc:
        return json_error("Transfer failed: " + str(exc), 500)


@app.get("/<path:filename>")
def public_file(filename):
    clean_name = filename.split("?", 1)[0].strip("/")
    if can_serve_public_file(clean_name):
        if clean_name == "style.css":
            clean_name = "styles.css"
        return send_from_directory(BASE_DIR, clean_name)
    abort(404)
