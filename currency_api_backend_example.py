from flask import Flask, jsonify, request
import firebase_admin
from firebase_admin import auth, credentials, firestore
import json
import os
from urllib.request import urlopen

app = Flask(__name__)

# Upload this JSON privately on PythonAnywhere. Never put it in your public site folder.
cred = credentials.Certificate("/home/ATVEXCHANGE/firebase-service-account.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

EXCHANGE_RATE_API_KEY = os.environ.get("EXCHANGE_RATE_API_KEY", "830180ba812787f094680fe0")


def get_user_id():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header.replace("Bearer ", "", 1)
    decoded = auth.verify_id_token(token)
    return decoded["uid"]


def money_field(currency):
    return "ngn" if currency == "NGN" else "ghs"


def fail_request(request_id, message, status_code=400):
    if request_id:
        db.collection("walletRequests").document(request_id).set({
            "status": "Failed",
            "apiMessage": message,
            "updatedAt": firestore.SERVER_TIMESTAMP
        }, merge=True)
    return jsonify({"confirmed": False, "status": "Failed", "message": message}), status_code


@firestore.transactional
def complete_wallet_action(transaction, data, user_id):
    action = data["action"]
    request_id = data["requestId"]
    currency = data["currency"]
    amount = float(data["amount"])
    field = money_field(currency)

    request_ref = db.collection("walletRequests").document(request_id)
    request_doc = request_ref.get(transaction=transaction)

    if request_doc.exists:
        request_data = request_doc.to_dict()
        owner_id = request_data.get("customerId") or request_data.get("senderId")
        if owner_id != user_id:
            return "Failed", "Request owner does not match signed-in user"
        if request_data.get("status") == "Successful":
            return "Successful", "Request was already processed."

    if action == "deposit":
        balance_ref = db.collection("balances").document(user_id)
        transaction.set(balance_ref, {
            field: firestore.Increment(amount),
            "updatedAt": firestore.SERVER_TIMESTAMP
        }, merge=True)

    elif action == "withdraw":
        balance_ref = db.collection("balances").document(user_id)
        balance_doc = balance_ref.get(transaction=transaction)
        current_balance = float((balance_doc.to_dict() or {}).get(field, 0)) if balance_doc.exists else 0
        if current_balance < amount:
            transaction.set(request_ref, {
                "status": "Failed",
                "apiMessage": "Insufficient balance",
                "updatedAt": firestore.SERVER_TIMESTAMP
            }, merge=True)
            return "Failed", "Insufficient balance"
        transaction.set(balance_ref, {
            field: firestore.Increment(-amount),
            "updatedAt": firestore.SERVER_TIMESTAMP
        }, merge=True)

    elif action == "internal-transfer":
        recipient_id = data.get("recipientId")
        if not recipient_id or recipient_id == user_id:
            transaction.set(request_ref, {
                "status": "Failed",
                "apiMessage": "Invalid recipient",
                "updatedAt": firestore.SERVER_TIMESTAMP
            }, merge=True)
            return "Failed", "Invalid recipient"

        sender_ref = db.collection("balances").document(user_id)
        receiver_ref = db.collection("balances").document(recipient_id)
        sender_doc = sender_ref.get(transaction=transaction)
        sender_balance = float((sender_doc.to_dict() or {}).get(field, 0)) if sender_doc.exists else 0

        if sender_balance < amount:
            transaction.set(request_ref, {
                "status": "Failed",
                "apiMessage": "Insufficient balance",
                "updatedAt": firestore.SERVER_TIMESTAMP
            }, merge=True)
            return "Failed", "Insufficient balance"

        transaction.set(sender_ref, {
            field: firestore.Increment(-amount),
            "updatedAt": firestore.SERVER_TIMESTAMP
        }, merge=True)
        transaction.set(receiver_ref, {
            field: firestore.Increment(amount),
            "updatedAt": firestore.SERVER_TIMESTAMP
        }, merge=True)

    else:
        transaction.set(request_ref, {
            "status": "Failed",
            "apiMessage": "Unknown action",
            "updatedAt": firestore.SERVER_TIMESTAMP
        }, merge=True)
        return "Failed", "Unknown action"

    transaction.set(request_ref, {
        "status": "Successful",
        "apiMessage": "Processed successfully",
        "processedAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP
    }, merge=True)
    return "Successful", "Processed successfully"


@app.post("/currency-api")
def currency_api():
    user_id = get_user_id()
    if not user_id:
        return jsonify({"confirmed": False, "status": "Failed", "message": "Unauthorized"}), 401

    data = request.get_json(force=True)
    action = data.get("action")
    request_id = data.get("requestId")
    currency = data.get("currency")

    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return fail_request(request_id, "Invalid amount")

    if not request_id:
        return jsonify({"confirmed": False, "status": "Failed", "message": "Missing request ID"}), 400
    if amount <= 0:
        return fail_request(request_id, "Amount must be greater than zero")
    if currency not in ["GHS", "NGN"]:
        return fail_request(request_id, "Invalid currency")
    if action not in ["deposit", "withdraw", "internal-transfer"]:
        return fail_request(request_id, "Invalid action")

    # TODO: Call your real payment/Currency API here first.
    # Only continue to complete_wallet_action when the provider confirms success.
    provider_confirmed = True
    if not provider_confirmed:
        return fail_request(request_id, "Provider did not confirm payment")

    transaction = db.transaction()
    status, message = complete_wallet_action(transaction, {
        **data,
        "amount": amount
    }, user_id)

    return jsonify({
        "confirmed": status == "Successful",
        "status": status,
        "message": message
    })


@app.get("/exchange-rates")
def exchange_rates():
    # Frontend calls this backend route so the API key is not placed in app.js.
    url = f"https://v6.exchangerate-api.com/v6/{EXCHANGE_RATE_API_KEY}/latest/USD"
    with urlopen(url, timeout=15) as response:
        data = json.loads(response.read().decode("utf-8"))

    rates = data.get("conversion_rates", {})
    return jsonify({
        "conversion_rates": {
            "GHS": rates.get("GHS"),
            "NGN": rates.get("NGN")
        },
        "time_last_update_utc": data.get("time_last_update_utc")
    })
