// Firebase Cloud Functions sender for ATV Exchange push notifications.
// This must be deployed from a Firebase Functions project. The browser app
// can save FCM tokens, but only this backend can send phone notifications
// while the app is closed.
//
// Required packages in functions/package.json:
//   firebase-admin
//   firebase-functions

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const ADMIN_EMAILS = [
  "Ezeaugustinemmaduabuchi@gmail.com",
  "ezeaugustinemmaduabuchi@gmail.com"
];

const DEFAULT_APP_BASE_URL = "https://atvexchange.pythonanywhere.com";

function appBaseUrl() {
  const configured = functions.config().app && functions.config().app.base_url;
  return (configured || DEFAULT_APP_BASE_URL).replace(/\/$/, "");
}

function absoluteLink(link) {
  if (!link) return `${appBaseUrl()}/exchange.html`;
  if (/^https?:\/\//i.test(link)) return link;
  return `${appBaseUrl()}/${String(link).replace(/^\.\//, "").replace(/^\//, "")}`;
}

function stringifyData(data) {
  const result = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    result[key] = typeof value === "string" ? value : String(value);
  });
  return result;
}

async function getTokensForUser(uid) {
  if (!uid) return [];

  const tokenSnap = await admin.firestore()
    .collection("users")
    .doc(uid)
    .collection("fcmTokens")
    .get();

  const tokens = [];
  tokenSnap.forEach((doc) => {
    const item = doc.data();
    if (item && item.token) tokens.push(item.token);
  });

  return tokens;
}

async function getAdminTokens() {
  const usersSnap = await admin.firestore()
    .collection("users")
    .where("email", "in", ADMIN_EMAILS)
    .get();

  const tokenSets = await Promise.all(
    usersSnap.docs.map((doc) => getTokensForUser(doc.id))
  );

  return [...new Set(tokenSets.flat())];
}

async function sendToTokens(tokens, title, body, link, data) {
  const uniqueTokens = [...new Set(tokens)].filter(Boolean);
  if (uniqueTokens.length === 0) {
    return { status: "no_tokens", successCount: 0, failureCount: 0 };
  }

  const resolvedLink = absoluteLink(link);
  const response = await admin.messaging().sendEachForMulticast({
    tokens: uniqueTokens,
    notification: { title, body },
    webpush: {
      fcmOptions: { link: resolvedLink },
      notification: {
        icon: `${appBaseUrl()}/icon.png`,
        badge: `${appBaseUrl()}/icon.png`,
        requireInteraction: true
      }
    },
    data: stringifyData({
      ...(data || {}),
      title,
      body,
      link: resolvedLink
    })
  });

  return {
    status: "sent",
    successCount: response.successCount,
    failureCount: response.failureCount
  };
}

exports.sendQueuedPushNotification = functions.firestore
  .document("pushNotifications/{notificationId}")
  .onCreate(async (snap) => {
    const job = snap.data();

    if (!job || !job.forUserId || !job.title || !job.body) {
      await snap.ref.set({
        status: "failed",
        error: "Missing forUserId, title, or body",
        processedAt: new Date().toISOString()
      }, { merge: true });
      return null;
    }

    const result = await sendToTokens(
      await getTokensForUser(job.forUserId),
      job.title,
      job.body,
      job.link || "exchange.html",
      job.data || {}
    );

    await snap.ref.set({
      ...result,
      processedAt: new Date().toISOString()
    }, { merge: true });

    return null;
  });

exports.sendAdminOrderNotification = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snap) => {
    const item = snap.data();

    if (!item || item.forRole !== "admin") return null;

    const recordId = item.recordId || item.depositId || item.requestId || item.orderId || "";
    const collection = item.collection || item.orderCollection || (item.depositId ? "deposits" : item.requestId ? "walletRequests" : "transactions");
    const link = item.link || (recordId ? `order-detail.html?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(recordId)}` : "dashboard.html");
    const title = item.title || "New ATV Exchange Order";
    const body = item.message || item.body || "A customer submitted a new order.";

    const result = await sendToTokens(
      await getAdminTokens(),
      title,
      body,
      link,
      {
        ...(item.data || {}),
        collection,
        recordId,
        orderCollection: collection,
        orderId: recordId,
        notificationId: snap.id
      }
    );

    await snap.ref.set({
      pushStatus: result.status,
      pushSuccessCount: result.successCount,
      pushFailureCount: result.failureCount,
      pushProcessedAt: new Date().toISOString()
    }, { merge: true });

    return null;
  });







