from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS
import firebase_admin
from firebase_admin import auth, credentials, firestore, messaging
import os
import time
import json
from urllib import request as urlrequest
from urllib import parse as urlparse
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin

app = Flask(__name__)
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
    "manifest.json",
    "sw.js",
    "firebase-messaging-sw.js",
    "icon.png",
}

ALLOWED_ORIGINS = [
    "https://atvexchange.pythonanywhere.com",
    "https://austintradeventures.github.io",
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
    "https://atvexchange.pythonanywhere.com"
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


def can_serve_public_file(filename):
    clean_name = filename.split("?", 1)[0].strip("/")
    if not clean_name or clean_name.startswith(".") or ".." in clean_name:
        return False
    if clean_name in PUBLIC_FILES:
        return True
    _, ext = os.path.splitext(clean_name)
    return ext.lower() in PUBLIC_EXTENSIONS and os.path.isfile(os.path.join(BASE_DIR, clean_name))


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "ATV Exchange Push Backend"})


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


@app.post("/verify-ngn-bank")
def verify_ngn_bank():
    try:
        decoded = require_signed_in_request()
    except PermissionError as exc:
        return json_error(str(exc), 401)

    data = request.get_json(silent=True) or {}
    account_number = str(data.get("accountNumber") or "").strip().replace(" ", "")
    bank_code = str(data.get("bankCode") or "").strip()
    bank_name = str(data.get("bankName") or "").strip()
    if not account_number.isdigit() or len(account_number) != 10:
        return json_error("Enter a valid 10-digit Nigerian account number")
    if not bank_code:
        return json_error("Bank code is required")

    paystack_secret = os.environ.get("PAYSTACK_SECRET_KEY", "").strip()
    flutterwave_secret = os.environ.get("FLUTTERWAVE_SECRET_KEY", "").strip()
    try:
        if paystack_secret:
            query = urlparse.urlencode({"account_number": account_number, "bank_code": bank_code})
            result = http_json(
                "GET",
                "https://api.paystack.co/bank/resolve?" + query,
                headers={"Authorization": "Bearer " + paystack_secret},
            )
            account_name = verified_name_from_response(result)
            if not account_name:
                return json_error("Bank account name could not be verified", 400)
            return jsonify({
                "ok": True,
                "provider": "paystack",
                "bankName": bank_name,
                "bankCode": bank_code,
                "accountNumber": account_number,
                "accountName": account_name,
                "verifiedAccountName": account_name,
                "userId": decoded.get("uid", ""),
            })

        if flutterwave_secret:
            result = http_json(
                "POST",
                "https://api.flutterwave.com/v3/accounts/resolve",
                headers={"Authorization": "Bearer " + flutterwave_secret},
                body={"account_number": account_number, "account_bank": bank_code},
            )
            account_name = verified_name_from_response(result)
            if not account_name:
                return json_error("Bank account name could not be verified", 400)
            return jsonify({
                "ok": True,
                "provider": "flutterwave",
                "bankName": bank_name,
                "bankCode": bank_code,
                "accountNumber": account_number,
                "accountName": account_name,
                "verifiedAccountName": account_name,
                "userId": decoded.get("uid", ""),
            })

        return json_error("Bank account verification is not configured on backend", 503)
    except ValueError as exc:
        return json_error(str(exc), 400)
    except Exception as exc:
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


@app.get("/")
def home():
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
        return send_from_directory(BASE_DIR, clean_name)
    abort(404)
