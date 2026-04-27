self.addEventListener("install", () => {
    console.log("SW Installed");
    self.skipWaiting();
});

self.addEventListener("activate", () => {
    console.log("SW Active");
});
