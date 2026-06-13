importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
apiKey: "AIzaSyBQiE6s-oBHwmFcBe_7ghcYb6hEZytTFXw",
authDomain: "atvexchange.firebaseapp.com",
projectId: "atvexchange",
storageBucket: "atvexchange.firebasestorage.app",
messagingSenderId: "329015821953",
appId: "1:329015821953:web:a4143f30b537e970432f80"
});

const messaging = firebase.messaging();
const CACHE_VERSION = "atv-exchange-no-cache-v20260613nomba1";

messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    if (payload.notification && !data.forceManualDisplay) {
        return;
    }
    const title = data.title || (payload.notification && payload.notification.title ? payload.notification.title : "ATV Exchange");
    const important = data.priority === "critical" || data.priority === "high";
    const options = {
        body: data.body || (payload.notification && payload.notification.body ? payload.notification.body : ""),
        icon: data.icon || "./icon.png",
        badge: data.badge || "./icon.png",
        tag: data.type || "atv-notification",
        renotify: true,
        requireInteraction: important,
        vibrate: important ? [220, 120, 220] : [120],
        data: {
            ...data,
            link: data.link || "./exchange.html"
        }
    };

    self.registration.getNotifications({ tag: options.tag }).then((notifications) => {
        notifications.forEach((notification) => notification.close());
        self.registration.showNotification(title, options);
    });
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    const targetUrl = data.link || data.click_action || "./exchange.html";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
            for (const client of clientsArr) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    client.focus();
                    client.navigate(targetUrl);
                    return;
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});

self.addEventListener("install", (e) => {
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;

    const url = new URL(e.request.url);
    const acceptsHtml = e.request.headers.get("accept") || "";

    if (e.request.mode === "navigate" || acceptsHtml.includes("text/html")) {
        if (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
            e.respondWith(fetch("./index.html?v=20260613nomba1", { cache: "no-store" }));
            return;
        }

        e.respondWith(fetch(e.request, { cache: "no-store" }));
        return;
    }

    if (url.pathname.endsWith("/icon.png") && e.request.destination === "document") {
        e.respondWith(fetch("./index.html?v=20260613nomba1", { cache: "no-store" }));
        return;
    }

    e.respondWith(
        fetch(e.request, { cache: "no-store" })
            .catch(() => caches.match(e.request))
    );
});










