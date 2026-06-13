from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS
import firebase_admin
from firebase_admin import auth, credentials, firestore, messaging
import os
import time
import json
import traceback
import hmac
import hashlib
import base64
import secrets
import uuid
from urllib import request as urlrequest
from urllib import parse as urlparse
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin

app = Flask(__name__)
APP_BUILD = "20260613platformapi1"
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
    "api-management.html",
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

NIGERIAN_BANK_CODES = {
    "044": "Access Bank",
    "023": "Citibank Nigeria",
    "050": "Ecobank Nigeria",
    "070": "Fidelity Bank",
    "011": "First Bank of Nigeria",
    "214": "First City Monument Bank",
    "058": "Guaranty Trust Bank",
    "082": "Keystone Bank",
    "50211": "Kuda Microfinance Bank",
    "50515": "Moniepoint Microfinance Bank",
    "999992": "OPay Microfinance Bank",
    "999991": "PalmPay",
    "076": "Polaris Bank",
    "221": "Stanbic IBTC Bank",
    "232": "Sterling Bank",
    "032": "Union Bank of Nigeria",
    "033": "United Bank for Africa",
    "215": "Unity Bank",
    "035": "Wema Bank",
    "057": "Zenith Bank",
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


def paystack_secret_key():
    return os.environ.get("PAYSTACK_SECRET_KEY", "").strip()


def paystack_ghana_secret_key():
    return os.environ.get("PAYSTACK_GH_SECRET_KEY", "").strip() or os.environ.get("PAYSTACK_GHS_SECRET_KEY", "").strip()


def paystack_deposit_secret_key(currency):
    currency = str(currency or "NGN").upper().strip()
    if currency == "GHS":
        return paystack_ghana_secret_key()
    return paystack_secret_key()


def paystack_public_key():
    return os.environ.get("PAYSTACK_PUBLIC_KEY", "").strip()


def paystack_headers():
    secret = paystack_secret_key()
    if not secret:
        raise ValueError("PAYSTACK_SECRET_KEY is not configured")
    return {
        "Authorization": "Bearer " + secret,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 ATVExchange/1.0",
    }


def paystack_deposit_headers(currency):
    currency = str(currency or "NGN").upper().strip()
    secret = paystack_deposit_secret_key(currency)
    if currency == "GHS" and not secret:
        raise ValueError("GHS Paystack/Mobile Money is not enabled yet.")
    if not secret:
        raise ValueError("PAYSTACK_SECRET_KEY is not configured")
    return {
        "Authorization": "Bearer " + secret,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 ATVExchange/1.0",
    }


def paystack_webhook_secrets():
    secrets = [paystack_secret_key(), paystack_ghana_secret_key()]
    return [secret for index, secret in enumerate(secrets) if secret and secret not in secrets[:index]]


def paystack_data(data):
    return data.get("data") if isinstance(data, dict) and isinstance(data.get("data"), dict) else {}


def paystack_status(data):
    nested = paystack_data(data)
    return str(nested.get("status") or data.get("status") or "").strip().lower()


def paystack_reference_currency(reference):
    reference = str(reference or "").strip()
    if not reference:
        return "NGN"
    try:
        doc = db.collection("deposits").document(reference).get()
        if doc.exists:
            return str((doc.to_dict() or {}).get("currency") or "NGN").upper().strip()
    except Exception as exc:
        backend_log("paystack.reference.currency_failed", {"reference": reference, "error": str(exc)})
    return "NGN"


def verify_paystack_reference(reference, currency=None):
    reference = str(reference or "").strip()
    if not reference:
        raise ValueError("Missing Paystack payment reference")
    currency = str(currency or paystack_reference_currency(reference) or "NGN").upper().strip()
    result = http_json(
        "GET",
        "https://api.paystack.co/transaction/verify/" + urlparse.quote(reference),
        headers=paystack_deposit_headers(currency),
    )
    backend_log("paystack.verify.response", {"reference": reference, "currency": currency, "response": result})
    return result


def calculate_paystack_deposit_fee(amount, currency):
    amount = clean_money(amount)
    currency = str(currency or "NGN").upper().strip()
    default_percent = "1.95" if currency == "GHS" else "1.5"
    percent = clean_money(os.environ.get("PAYSTACK_DEPOSIT_FEE_PERCENT_" + currency, os.environ.get("PAYSTACK_DEPOSIT_FEE_PERCENT", default_percent)))
    flat = clean_money(os.environ.get("PAYSTACK_DEPOSIT_FEE_FLAT_" + currency, "100" if currency == "NGN" and amount >= 2500 else "0"))
    cap = clean_money(os.environ.get("PAYSTACK_DEPOSIT_FEE_CAP_" + currency, "2000" if currency == "NGN" else "0"))
    fee = round((amount * percent / 100) + flat, 2)
    if cap > 0:
        fee = min(fee, cap)
    return round(fee, 2)


def credit_paystack_verified_deposit(reference, verification_response):
    data = paystack_data(verification_response)
    status = str(data.get("status") or "").lower()
    currency = str(data.get("currency") or "").upper()
    paid_amount_kobo = clean_money(data.get("amount"))
    paid_amount = round(paid_amount_kobo / 100, 2)
    paystack_id = str(data.get("id") or "")

    if status != "success":
        raise ValueError("Paystack payment is not successful")
    if currency not in {"NGN", "GHS"}:
        raise ValueError("Paystack payment currency must be NGN or GHS")
    if paid_amount <= 0:
        raise ValueError("Invalid Paystack payment amount")

    deposit_ref = db.collection("deposits").document(reference)
    wallet_ref = db.collection("walletRequests").document(reference)
    payment_ref = db.collection("paystackPayments").document(reference)
    transaction_ref = db.collection("transactions").document("DEP-" + reference)
    notification_ref = db.collection("notifications").document()
    transaction = db.transaction()

    @firestore.transactional
    def do_credit(tx):
        deposit_doc = deposit_ref.get(transaction=tx)
        if not deposit_doc.exists:
            raise ValueError("Deposit order not found for reference " + reference)
        deposit = deposit_doc.to_dict() or {}

        existing_payment = payment_ref.get(transaction=tx)
        if existing_payment.exists and (existing_payment.to_dict() or {}).get("credited") is True:
            backend_log("paystack.credit.duplicate_ignored", {"reference": reference})
            return {"alreadyCredited": True, "depositId": reference}

        if deposit.get("credited") is True or str(deposit.get("status") or "").lower() in {"credited", "approved", "successful"}:
            tx.set(payment_ref, {
                "reference": reference,
                "paystackId": paystack_id,
                "status": status,
                "amount": paid_amount,
                "amountKobo": paid_amount_kobo,
                "currency": currency,
                "credited": True,
                "duplicate": True,
                "verifiedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                "raw": data,
            }, merge=True)
            backend_log("paystack.credit.duplicate_ignored", {"reference": reference, "reason": "deposit already credited"})
            return {"alreadyCredited": True, "depositId": reference}

        expected_amount = clean_money(deposit.get("amount"))
        expected_total = clean_money(deposit.get("totalAmountPayable") or deposit.get("paystackChargeAmount") or expected_amount)
        processing_fee = clean_money(deposit.get("processingFee") or max(expected_total - expected_amount, 0))
        expected_currency = str(deposit.get("currency") or "").upper()
        if expected_currency not in {"NGN", "GHS"}:
            raise ValueError("Deposit currency mismatch")
        if expected_currency != currency:
            raise ValueError("Payment currency mismatch")
        if round(expected_total, 2) != round(paid_amount, 2):
            raise ValueError("Payment amount mismatch")

        customer_id = deposit.get("customerId") or deposit.get("user_id")
        if not customer_id:
            raise ValueError("Deposit customer ID is missing")

        balance_ref = db.collection("balances").document(customer_id)
        balance_doc = balance_ref.get(transaction=tx)
        balance = balance_doc.to_dict() if balance_doc.exists else {}
        balance_field = "ngn" if expected_currency == "NGN" else "ghs"
        current_balance = clean_money((balance or {}).get(balance_field, 0))
        new_balance = clean_money(current_balance + expected_amount)
        now_text = time.strftime("%Y-%m-%d %H:%M:%S")

        tx.set(balance_ref, {
            balance_field: new_balance,
            "updatedAt": now_text,
            "lastDepositId": reference,
        }, merge=True)
        update_payload = {
            "status": "credited",
            "paymentStatus": "success",
            "paymentProvider": "paystack",
            "paystackStatus": "success",
            "paystackId": paystack_id,
            "paystackReference": reference,
            "processingFee": processing_fee,
            "totalAmountPaid": paid_amount,
            "walletCreditAmount": expected_amount,
            "paymentVerified": True,
            "credited": True,
            "creditedAt": now_text,
            "updatedAt": now_text,
            "balanceBeforeCredit": current_balance,
            "balanceAfterCredit": new_balance,
        }
        tx.set(deposit_ref, update_payload, merge=True)
        tx.set(wallet_ref, {**update_payload, "status": "Successful"}, merge=True)
        tx.set(payment_ref, {
            "reference": reference,
            "paystackId": paystack_id,
            "status": status,
            "amount": paid_amount,
            "amountKobo": paid_amount_kobo,
            "depositAmount": expected_amount,
            "processingFee": processing_fee,
            "walletCreditAmount": expected_amount,
            "currency": currency,
            "customerId": customer_id,
            "depositId": reference,
            "credited": True,
            "verifiedAt": now_text,
            "raw": data,
        }, merge=True)
        tx.set(transaction_ref, {
            "orderID": "DEP-" + reference,
            "requestId": reference,
            "type": "deposit",
            "customerId": customer_id,
            "customerEmail": deposit.get("customerEmail", ""),
            "currency": expected_currency,
            "amount": expected_amount,
            "converted": expected_amount,
            "processingFee": processing_fee,
            "totalAmountPaid": paid_amount,
            "walletCreditAmount": expected_amount,
            "status": "Completed",
            "paymentProvider": "paystack",
            "paymentReference": reference,
            "paystackId": paystack_id,
            "date": now_text,
            "createdAt": now_text,
        }, merge=True)
        tx.set(notification_ref, {
            "forUserId": customer_id,
            "type": "deposit",
            "title": "Deposit Confirmed",
            "message": "Your " + expected_currency + " wallet has been credited successfully.",
            "depositId": reference,
            "createdAt": now_text,
            "read": False,
        }, merge=True)
        backend_log("paystack.credit.success", {"reference": reference, "customerId": customer_id, "amount": expected_amount, "processingFee": processing_fee, "totalPaid": paid_amount, "currency": expected_currency})
        return {"alreadyCredited": False, "depositId": reference, "customerId": customer_id, "amount": expected_amount, "processingFee": processing_fee, "totalPaid": paid_amount, "currency": expected_currency}

    return do_credit(transaction)


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
        "paystackDeposits": {
            "configured": bool(paystack_secret_key()),
            "hasPublicKey": bool(paystack_public_key()),
            "webhookUrl": APP_BASE_URL + "/api/paystack/webhook",
        },
        "ngnBankVerification": {
            "configured": bool(os.environ.get("PAYSTACK_SECRET_KEY", "").strip()),
            "paystack": bool(os.environ.get("PAYSTACK_SECRET_KEY", "").strip()),
            "flutterwave": False,
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
    configured = bool(os.environ.get("PAYSTACK_SECRET_KEY", "").strip())
    if not configured:
        backend_log("bank.verify.missing_secret", {"message": "Missing PAYSTACK_SECRET_KEY"})
    return jsonify({
        "ok": True,
        "service": "ATV Exchange Bank Account Verification",
        "build": APP_BUILD,
        "method": "POST required for verification",
        "provider": "paystack",
        "configured": configured,
        "message": "Ready" if configured else "Missing PAYSTACK_SECRET_KEY",
    })


@app.post("/api/verify-bank-account")
def verify_ngn_bank():
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)

    data = request.get_json(silent=True) or {}
    account_number = str(data.get("account_number") or data.get("accountNumber") or "").strip().replace(" ", "")
    bank_code = str(data.get("bank_code") or data.get("bankCode") or data.get("account_bank") or "").strip()
    bank_name = str(data.get("bankName") or data.get("bank_name") or NIGERIAN_BANK_CODES.get(bank_code, "")).strip()
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

    paystack_secret = os.environ.get("PAYSTACK_SECRET_KEY", "").strip()
    if not paystack_secret:
        backend_log("bank.verify.missing_secret", {
            "message": "Missing PAYSTACK_SECRET_KEY",
            "userId": decoded.get("uid", ""),
            "bankCode": bank_code,
            "bankName": bank_name,
            "accountNumberLast4": account_number[-4:],
        })
        return json_error("Missing PAYSTACK_SECRET_KEY", 503)

    query = urlparse.urlencode({"account_number": account_number, "bank_code": bank_code})
    paystack_url = "https://api.paystack.co/bank/resolve?" + query
    backend_log("bank.verify.request", {
        "userId": decoded.get("uid", ""),
        "bankCode": bank_code,
        "bankName": bank_name,
        "accountNumber": account_number,
        "provider": "paystack",
        "requestQuery": {"account_number": account_number, "bank_code": bank_code},
    })
    try:
        req = urlrequest.Request(paystack_url, method="GET")
        req.add_header("Accept", "application/json")
        req.add_header("Accept-Language", "en-US,en;q=0.9")
        req.add_header("Authorization", "Bearer " + paystack_secret)
        req.add_header("Referer", "https://www.atvexchange.net/")
        req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 ATVExchange/1.0")
        with urlrequest.urlopen(req, timeout=18) as response:
            raw = response.read().decode("utf-8")
            result = json.loads(raw or "{}")
            backend_log("bank.verify.paystack.response", {
                "status": response.status,
                "body": result,
                "raw": raw,
            })
        account_name = verified_name_from_response(result)
        if not account_name:
            message = result.get("message") or result.get("error") or "Bank account name could not be verified"
            backend_log("bank.verify.paystack.no_name", {"message": message, "response": result})
            return jsonify({
                "ok": False,
                "message": message,
                "provider": "paystack",
                "providerStatus": response.status,
                "providerBody": result,
                "providerRaw": raw,
                "bankCode": bank_code,
                "bankName": bank_name,
                "accountNumberLast4": account_number[-4:],
            }), 400
        return jsonify({
            "ok": True,
            "provider": "paystack",
            "bankName": bank_name,
            "bankCode": bank_code,
            "bank_code": bank_code,
            "accountNumber": account_number,
            "account_number": account_number,
            "accountName": account_name,
            "verifiedAccountName": account_name,
            "userId": decoded.get("uid", ""),
        })
    except HTTPError as exc:
        raw = ""
        result = {}
        try:
            raw = exc.read().decode("utf-8")
            result = json.loads(raw or "{}")
        except Exception:
            result = {}
        message = result.get("message") or result.get("error") or raw or "Paystack rejected the bank account verification request"
        if isinstance(message, str) and ("error-1010" in message.lower() or "browser_signature_banned" in message.lower() or "cloudflare" in message.lower()):
            message = "Paystack blocked the backend request signature. Please contact support while we retry with updated server headers."
        backend_log("bank.verify.paystack.http_error", {
            "status": exc.code,
            "message": message,
            "body": result,
            "raw": raw,
        })
        return jsonify({
            "ok": False,
            "message": message,
            "provider": "paystack",
            "providerStatus": exc.code,
            "providerBody": result,
            "providerRaw": raw,
            "bankCode": bank_code,
            "bankName": bank_name,
            "accountNumberLast4": account_number[-4:],
        }), 400
    except ValueError as exc:
        backend_log("bank.verify.paystack.error", {"error": str(exc)})
        return json_error(str(exc), 400)
    except Exception as exc:
        backend_log("bank.verify.paystack.exception", {"error": str(exc), "trace": traceback.format_exc()})
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


@app.post("/api/paystack/initialize-deposit")
def initialize_paystack_deposit():
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)

    data = request.get_json(silent=True) or {}
    amount = clean_money(data.get("amount"))
    currency = str(data.get("currency") or "NGN").upper().strip()
    customer_email = str(data.get("email") or decoded.get("email") or "").strip()
    customer_name = str(data.get("customerName") or data.get("name") or customer_email or "ATV customer").strip()
    user_id = str(decoded.get("uid") or "").strip()

    if currency not in {"NGN", "GHS"}:
        return json_error("Paystack automatic deposit is for NGN and GHS only")
    if not paystack_deposit_secret_key(currency):
        if currency == "GHS":
            return json_error("GHS Paystack/Mobile Money is not enabled yet.", 503)
        return json_error("Missing PAYSTACK_SECRET_KEY", 503)
    if amount <= 0:
        return json_error("Enter a valid deposit amount")
    if not customer_email:
        return json_error("Customer email is required")

    reference = "ATV-DEP-" + user_id[:10] + "-" + str(int(time.time() * 1000))
    now_ms = int(time.time() * 1000)
    now_text = time.strftime("%Y-%m-%d %H:%M:%S")
    processing_fee = calculate_paystack_deposit_fee(amount, currency)
    total_amount = round(amount + processing_fee, 2)
    amount_kobo = int(round(total_amount * 100))
    callback_url = APP_BASE_URL + "/deposit.html?paystack_reference=" + urlparse.quote(reference)
    deposit_data = {
        "id": reference,
        "requestId": reference,
        "customerId": user_id,
        "user_id": user_id,
        "customerEmail": customer_email,
        "customerName": customer_name,
        "username": str(data.get("username") or ""),
        "currency": currency,
        "amount": amount,
        "depositAmount": amount,
        "processingFee": processing_fee,
        "totalAmountPayable": total_amount,
        "walletCreditAmount": amount,
        "amountKobo": amount_kobo,
        "status": "awaiting paystack payment",
        "type": "deposit",
        "paymentProvider": "paystack",
        "paymentStatus": "pending",
        "paymentVerificationRequired": True,
        "paymentVerified": False,
        "credited": False,
        "paystackReference": reference,
        "createdAt": now_text,
        "created_at": now_text,
        "createdAtMs": now_ms,
        "updatedAt": now_text,
    }

    paystack_channels = ["mobile_money", "card"] if currency == "GHS" else ["card", "bank", "ussd", "bank_transfer"]
    payload = {
        "email": customer_email,
        "amount": amount_kobo,
        "currency": currency,
        "reference": reference,
        "callback_url": callback_url,
        "channels": paystack_channels,
        "metadata": {
            "customerId": user_id,
            "orderId": reference,
            "type": "deposit",
            "platform": "ATV Exchange",
            "paymentChannel": "Ghana Mobile Money" if currency == "GHS" else "NGN checkout",
        },
    }

    try:
        db.collection("deposits").document(reference).set(deposit_data, merge=True)
        db.collection("walletRequests").document(reference).set({
            **deposit_data,
            "status": "Pending",
            "manualMomoDeposit": False,
        }, merge=True)
        backend_log("paystack.deposit.initialized", {"reference": reference, "amount": amount, "processingFee": processing_fee, "totalAmountPayable": total_amount, "amountKobo": amount_kobo, "currency": currency, "userId": user_id})
        result = http_json(
            "POST",
            "https://api.paystack.co/transaction/initialize",
            headers=paystack_deposit_headers(currency),
            body=payload,
        )
        backend_log("paystack.initialize.response", {"reference": reference, "response": result})
        payment_data = paystack_data(result)
        authorization_url = payment_data.get("authorization_url") or result.get("authorization_url")
        access_code = payment_data.get("access_code") or result.get("access_code")
        if not authorization_url:
            return json_error("Paystack did not return a checkout link", 502)
        db.collection("deposits").document(reference).set({
            "paystackInitializeResponse": result,
            "paystackAuthorizationUrl": authorization_url,
            "paystackAccessCode": access_code,
            "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        }, merge=True)
        return jsonify({
            "ok": True,
            "provider": "paystack",
            "reference": reference,
            "authorization_url": authorization_url,
            "access_code": access_code,
            "amount": amount,
            "processingFee": processing_fee,
            "totalAmountPayable": total_amount,
            "walletCreditAmount": amount,
            "currency": currency,
        })
    except ValueError as exc:
        backend_log("paystack.initialize.error", {"reference": reference, "error": str(exc)})
        return json_error(str(exc), 400)
    except Exception as exc:
        backend_log("paystack.initialize.exception", {"reference": reference, "error": str(exc), "trace": traceback.format_exc()})
        return json_error("Paystack deposit could not be initialized", 500)


@app.get("/api/paystack/verify/<reference>")
def verify_paystack_deposit(reference):
    try:
        result = verify_paystack_reference(reference)
        credit_result = credit_paystack_verified_deposit(reference, result)
        backend_log("paystack.verify.success", {"reference": reference, "credit": credit_result})
        return jsonify({"ok": True, "reference": reference, "verification": result, "credit": credit_result})
    except ValueError as exc:
        backend_log("paystack.verify.failed", {"reference": reference, "error": str(exc)})
        return json_error(str(exc), 400)
    except Exception as exc:
        backend_log("paystack.verify.exception", {"reference": reference, "error": str(exc), "trace": traceback.format_exc()})
        return json_error("Paystack verification failed", 500)


@app.get("/api/paystack/webhook")
def paystack_webhook_status():
    return jsonify({
        "ok": True,
        "service": "ATV Exchange Paystack Webhook",
        "method": "POST required for live webhook events",
        "configured": bool(paystack_secret_key()),
        "ghanaConfigured": bool(paystack_ghana_secret_key()),
        "webhookUrl": APP_BASE_URL + "/api/paystack/webhook",
    })


@app.post("/api/paystack/webhook")
def paystack_webhook():
    secrets = paystack_webhook_secrets()
    raw_body = request.get_data() or b""
    received_signature = request.headers.get("x-paystack-signature", "")
    if not secrets:
        backend_log("paystack.webhook.missing_secret", {})
        return json_error("Missing PAYSTACK_SECRET_KEY", 503)
    signature_valid = False
    for secret in secrets:
        expected_signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
        if hmac.compare_digest(received_signature, expected_signature):
            signature_valid = True
            break
    if not signature_valid:
        backend_log("paystack.webhook.invalid_signature", {"received": bool(received_signature)})
        return json_error("Invalid Paystack webhook signature", 401)
    backend_log("paystack.webhook.signature_valid", {"received": True})

    payload = request.get_json(silent=True) or {}
    backend_log("paystack.webhook.received", payload)
    event = str(payload.get("event") or "").lower()
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    reference = str(data.get("reference") or "").strip()
    if not reference:
        return json_error("Missing Paystack payment reference", 400)

    try:
        verification = verify_paystack_reference(reference)
        credit_result = credit_paystack_verified_deposit(reference, verification)
        backend_log("paystack.webhook.credited", {"reference": reference, "event": event, "credit": credit_result})
        return jsonify({"ok": True, "reference": reference, "credit": credit_result})
    except Exception as exc:
        backend_log("paystack.webhook.failed", {"reference": reference, "event": event, "error": str(exc), "trace": traceback.format_exc()})
        return json_error("Webhook verification failed: " + str(exc), 400)


@app.post("/api/flutterwave/create-payment")
def create_flutterwave_payment():
    return json_error("Flutterwave deposit is disabled. Use Paystack deposit only.", 410)
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


def api_master_key():
    key = os.environ.get("ATV_API_MASTER_KEY", "").strip()
    if not key:
        key = os.environ.get("FLW_SECRET_KEY", "") or os.environ.get("PAYSTACK_SECRET_KEY", "") or SERVICE_ACCOUNT_PATH
    return key.encode("utf-8")


def api_now_text():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def api_secret_hash(secret):
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def api_encrypt_secret(secret):
    raw = secret.encode("utf-8")
    key = hashlib.sha256(api_master_key()).digest()
    encrypted = bytes(raw[i] ^ key[i % len(key)] for i in range(len(raw)))
    return base64.urlsafe_b64encode(encrypted).decode("utf-8")


def api_decrypt_secret(value):
    encrypted = base64.urlsafe_b64decode(value.encode("utf-8"))
    key = hashlib.sha256(api_master_key()).digest()
    raw = bytes(encrypted[i] ^ key[i % len(key)] for i in range(len(encrypted)))
    return raw.decode("utf-8")


def api_key_preview(api_key):
    if not api_key:
        return ""
    return api_key[:8] + "..." + api_key[-6:]


def api_client_ip():
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or ""


def normalize_api_permissions(values):
    allowed = {"read_transactions", "create_payout", "confirm_deposit", "check_order_status", "webhook_access"}
    return [item for item in values if item in allowed]


def normalize_ip_list(values):
    if isinstance(values, str):
        values = values.replace(",", "\n").splitlines()
    if not isinstance(values, list):
        values = []
    clean = []
    for value in values:
        ip = str(value).strip()
        if ip and ip not in clean:
            clean.append(ip)
    return clean


def api_keys_collection():
    return db.collection("platformApiKeys")


def api_logs_collection():
    return db.collection("platformApiLogs")


def sanitize_api_key_doc(doc):
    data = doc.to_dict() or {}
    return {
        "id": doc.id,
        "name": data.get("name", ""),
        "apiKeyPreview": data.get("apiKeyPreview", ""),
        "permissions": data.get("permissions", []),
        "allowedIps": data.get("allowedIps", []),
        "status": data.get("status", "Disabled"),
        "notes": data.get("notes", ""),
        "createdAt": data.get("createdAt", ""),
        "lastUsedAt": data.get("lastUsedAt", ""),
        "updatedAt": data.get("updatedAt", ""),
    }


def write_api_log(api_doc_id, result, message, extra=None):
    payload = {
        "apiKeyId": api_doc_id,
        "path": request.path,
        "method": request.method,
        "ip": api_client_ip(),
        "result": result,
        "message": message,
        "createdAt": api_now_text(),
        "userAgent": request.headers.get("User-Agent", ""),
    }
    if extra:
        payload.update(extra)
    api_logs_collection().document().set(payload)


def verify_platform_api(required_permission):
    api_key = request.headers.get("X-ATV-API-Key", "").strip()
    signature = request.headers.get("X-ATV-Signature", "").strip()
    timestamp = request.headers.get("X-ATV-Timestamp", "").strip()
    if not api_key or not signature or not timestamp:
        raise PermissionError("API Key, signature and timestamp are required")
    try:
        ts = int(timestamp)
    except Exception:
        raise PermissionError("Invalid timestamp")
    if abs(int(time.time()) - ts) > 300:
        raise PermissionError("Request timestamp expired")

    matches = list(api_keys_collection().where("apiKeyHash", "==", api_secret_hash(api_key)).limit(1).stream())
    if not matches:
        write_api_log("", "denied", "Invalid API key")
        raise PermissionError("Invalid API key")
    doc = matches[0]
    data = doc.to_dict() or {}
    if data.get("status") != "Active":
        write_api_log(doc.id, "denied", "API key disabled")
        raise PermissionError("API key disabled")
    allowed_ips = data.get("allowedIps") or []
    client_ip = api_client_ip()
    if allowed_ips and client_ip not in allowed_ips:
        write_api_log(doc.id, "denied", "IP address not allowed", {"allowedIps": allowed_ips})
        raise PermissionError("IP address not allowed")
    permissions = data.get("permissions") or []
    if required_permission not in permissions:
        write_api_log(doc.id, "denied", "Permission denied", {"requiredPermission": required_permission})
        raise PermissionError("Permission denied")

    secret = api_decrypt_secret(data.get("secretEncrypted", ""))
    raw_body = request.get_data(as_text=True) or ""
    payload = timestamp + "." + request.method.upper() + "." + request.path + "." + raw_body
    expected = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        write_api_log(doc.id, "denied", "Invalid signature")
        raise PermissionError("Invalid signature")

    doc.reference.set({"lastUsedAt": api_now_text()}, merge=True)
    write_api_log(doc.id, "allowed", "Request allowed", {"requiredPermission": required_permission})
    return doc.id, data


@app.get("/api/admin/api-keys")
def list_platform_api_keys():
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)
    if not is_admin(decoded):
        return json_error("Admin access required", 403)

    keys = [sanitize_api_key_doc(doc) for doc in api_keys_collection().stream()]
    return jsonify({"ok": True, "keys": keys})


@app.post("/api/admin/api-keys/create")
def create_platform_api_key():
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)
    if not is_admin(decoded):
        return json_error("Admin access required", 403)

    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return json_error("API name is required", 400)
    permissions = normalize_api_permissions(data.get("permissions") or [])
    if not permissions:
        return json_error("Select at least one permission", 400)

    api_key = "atv_pk_" + secrets.token_urlsafe(24)
    secret_key = "atv_sk_" + secrets.token_urlsafe(36)
    webhook_secret = "atv_whsec_" + secrets.token_urlsafe(32)
    now = api_now_text()
    doc_id = str(uuid.uuid4())
    payload = {
        "name": name,
        "apiKeyHash": api_secret_hash(api_key),
        "apiKeyPreview": api_key_preview(api_key),
        "secretHash": api_secret_hash(secret_key),
        "secretEncrypted": api_encrypt_secret(secret_key),
        "webhookSecretHash": api_secret_hash(webhook_secret),
        "webhookSecretEncrypted": api_encrypt_secret(webhook_secret),
        "allowedIps": normalize_ip_list(data.get("allowedIps") or []),
        "permissions": permissions,
        "status": "Active" if str(data.get("status") or "Active") == "Active" else "Disabled",
        "notes": str(data.get("notes") or "").strip(),
        "createdAt": now,
        "updatedAt": now,
        "lastUsedAt": "",
        "createdBy": decoded.get("email", ""),
    }
    api_keys_collection().document(doc_id).set(payload)
    backend_log("platform_api.created", {"id": doc_id, "name": name, "createdBy": decoded.get("email", "")})
    return jsonify({
        "ok": True,
        "id": doc_id,
        "apiKey": api_key,
        "secretKey": secret_key,
        "webhookSecret": webhook_secret,
        "record": sanitize_api_key_doc(api_keys_collection().document(doc_id).get()),
    })


@app.route("/api/admin/api-keys/<key_id>", methods=["PATCH", "DELETE"])
def manage_platform_api_key(key_id):
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)
    if not is_admin(decoded):
        return json_error("Admin access required", 403)

    ref = api_keys_collection().document(key_id)
    doc = ref.get()
    if not doc.exists:
        return json_error("API key not found", 404)
    if request.method == "DELETE":
        ref.delete()
        backend_log("platform_api.deleted", {"id": key_id, "admin": decoded.get("email", "")})
        return jsonify({"ok": True, "deleted": True})

    data = request.get_json(silent=True) or {}
    update = {"updatedAt": api_now_text(), "updatedBy": decoded.get("email", "")}
    if "name" in data:
        update["name"] = str(data.get("name") or "").strip()
    if "status" in data:
        update["status"] = "Active" if str(data.get("status") or "") == "Active" else "Disabled"
    if "allowedIps" in data:
        update["allowedIps"] = normalize_ip_list(data.get("allowedIps") or [])
    if "permissions" in data:
        permissions = normalize_api_permissions(data.get("permissions") or [])
        if not permissions:
            return json_error("Select at least one permission", 400)
        update["permissions"] = permissions
    if "notes" in data:
        update["notes"] = str(data.get("notes") or "").strip()
    ref.set(update, merge=True)
    backend_log("platform_api.updated", {"id": key_id, "admin": decoded.get("email", "")})
    return jsonify({"ok": True, "record": sanitize_api_key_doc(ref.get())})


@app.get("/api/admin/api-logs")
def list_platform_api_logs():
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)
    if not is_admin(decoded):
        return json_error("Admin access required", 403)

    docs = api_logs_collection().order_by("createdAt", direction=firestore.Query.DESCENDING).limit(30).stream()
    logs = [{"id": doc.id, **(doc.to_dict() or {})} for doc in docs]
    return jsonify({"ok": True, "logs": logs})


@app.post("/api/v1/payouts/create")
def partner_create_payout():
    try:
        api_id, api_data = verify_platform_api("create_payout")
    except PermissionError as exc:
        return json_error(str(exc), 403)
    data = request.get_json(silent=True) or {}
    return jsonify({"ok": True, "message": "Payout request accepted", "apiKeyId": api_id, "status": "Pending", "payload": data})


@app.post("/api/v1/deposits/confirm")
def partner_confirm_deposit():
    try:
        api_id, api_data = verify_platform_api("confirm_deposit")
    except PermissionError as exc:
        return json_error(str(exc), 403)
    data = request.get_json(silent=True) or {}
    return jsonify({"ok": True, "message": "Deposit confirmation accepted", "apiKeyId": api_id, "status": "Received", "payload": data})


@app.get("/api/v1/transactions/<transaction_id>")
def partner_get_transaction(transaction_id):
    try:
        api_id, api_data = verify_platform_api("read_transactions")
    except PermissionError as exc:
        return json_error(str(exc), 403)
    doc = db.collection("transactions").document(transaction_id).get()
    if not doc.exists:
        return json_error("Transaction not found", 404)
    return jsonify({"ok": True, "transaction": {"id": doc.id, **(doc.to_dict() or {})}})


@app.get("/api/v1/orders/<order_id>/status")
def partner_get_order_status(order_id):
    try:
        api_id, api_data = verify_platform_api("check_order_status")
    except PermissionError as exc:
        return json_error(str(exc), 403)
    for collection in ["transactions", "deposits", "walletRequests"]:
        doc = db.collection(collection).document(order_id).get()
        if doc.exists:
            data = doc.to_dict() or {}
            return jsonify({"ok": True, "collection": collection, "id": doc.id, "status": data.get("status", "")})
    return json_error("Order not found", 404)


@app.post("/api/v1/webhooks/payment")
def partner_payment_webhook():
    try:
        api_id, api_data = verify_platform_api("webhook_access")
    except PermissionError as exc:
        return json_error(str(exc), 403)
    data = request.get_json(silent=True) or {}
    return jsonify({"ok": True, "message": "Webhook received", "apiKeyId": api_id, "received": True, "payload": data})


@app.get("/<path:filename>")
def public_file(filename):
    clean_name = filename.split("?", 1)[0].strip("/")
    if can_serve_public_file(clean_name):
        if clean_name == "style.css":
            clean_name = "styles.css"
        return send_from_directory(BASE_DIR, clean_name)
    abort(404)


