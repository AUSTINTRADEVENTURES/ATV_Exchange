// FIREBASE CONFIG
const firebaseConfig = {
apiKey: "AIzaSyBQiE6s-oBHwmFcBe_7ghcYb6hEZytTFXw",
authDomain: "atvexchange.firebaseapp.com",
projectId: "atvexchange",
storageBucket: "atvexchange.firebasestorage.app",
messagingSenderId: "329015821953",
appId: "1:329015821953:web:a4143f30b537e970432f80"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage ? firebase.storage() : null;

// Replace this email with the Firebase login email that should see admin pages.
const adminEmails = [
"Ezeaugustinemmaduabuchi@gmail.com"
];

// MoMo Open API must be called from a backend because it needs secret credentials.
// Put your backend endpoint here when it is ready.
const momoSettings = {
requestToPayEndpoint: ""
};

const backendSettings = {
baseUrl: "https://www.atvexchange.net"
};

// Cloudinary unsigned upload settings for KYC documents.
// Create an unsigned upload preset in Cloudinary, then put your values here.
const cloudinarySettings = {
cloudName: "dmf7h49yl",
uploadPreset: "MYEXCGANGEAPP"
};

// Add your Firebase Web Push certificate key here:
// Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates.
const fcmVapidKey = "BHivfiaCiPHVmc4gosBYwJ84tsUjBUcBVKNKeUQhhiVatb7dnGBnQa7ttX53-lztoM6t0Xta-_KHQpJVriwfqx0";

const defaultRateSettings = {
rateCedis: 116.27907,
rateNaira: 120.48193,
costRateCedisToNaira: 116.27907,
costRateNairaToCedis: 120.48193,
cedisEnabled: true,
nairaEnabled: true,
momoEndpoint: "",
currencyApiEndpoint: ""
};

const countryIdTypes = {
"Ghana": [
{value:"ghana-card", label:"Ghana Card"},
{value:"passport", label:"International Passport"},
{value:"drivers-license", label:"Driver's License"},
{value:"voter-id", label:"Voter ID"}
],
"Nigeria": [
{value:"nin", label:"NIN / National ID"},
{value:"bvn", label:"BVN"},
{value:"passport", label:"International Passport"},
{value:"drivers-license", label:"Driver's License"},
{value:"voter-card", label:"Voter Card"}
],
"Kenya": [
{value:"national-id", label:"National ID"},
{value:"passport", label:"International Passport"},
{value:"drivers-license", label:"Driver's License"}
],
"South Africa": [
{value:"identity-number", label:"South African ID Number"},
{value:"passport", label:"Passport"},
{value:"business-registration", label:"Business Registration Number"}
],
"Uganda": [
{value:"national-id", label:"National ID"},
{value:"passport", label:"International Passport"},
{value:"drivers-license", label:"Driver's License"}
],
"Tanzania": [
{value:"national-id", label:"National ID"},
{value:"passport", label:"International Passport"},
{value:"drivers-license", label:"Driver's License"}
],
"Rwanda": [
{value:"national-id", label:"National ID"},
{value:"passport", label:"International Passport"},
{value:"drivers-license", label:"Driver's License"}
],
"Cameroon": [
{value:"national-id", label:"National ID"},
{value:"passport", label:"International Passport"},
{value:"drivers-license", label:"Driver's License"}
],
"Senegal": [
{value:"national-id", label:"National ID"},
{value:"passport", label:"International Passport"},
{value:"drivers-license", label:"Driver's License"}
],
"Cote d'Ivoire": [
{value:"national-id", label:"National ID"},
{value:"passport", label:"International Passport"},
{value:"drivers-license", label:"Driver's License"}
],
"United Kingdom": [
{value:"passport", label:"Passport"},
{value:"drivers-license", label:"Driver's License"},
{value:"residence-permit", label:"Residence Permit"}
],
"United States": [
{value:"passport", label:"Passport"},
{value:"drivers-license", label:"Driver's License"},
{value:"state-id", label:"State ID"}
],
"Other": [
{value:"passport", label:"Passport"},
{value:"national-id", label:"National ID"},
{value:"drivers-license", label:"Driver's License"}
]
};

let converted = 0;
let paymentReference = "";
let paymentConfirmed = false;
let allTransactions = [];
let allCustomers = [];
let myOrdersData = [];
let allKycProfiles = [];
let supportThreadsData = [];
let allWalletRequests = [];
let allDepositRequests = [];
let allWalletConversionsAdmin = [];
let allProfitOrders = [];
let selectedSupportThreadId = "";
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let rateSettings = {...defaultRateSettings};
let balancesHidden = false;
let activeBalanceCurrency = "GHS";
let liveBalances = {ghs:0, ngn:0};
let walletActionBusy = false;
let notificationBadgeUnsubscribes = [];
const appAssetVersion = "20260529verifyfix1";

function appLog(message, data){
console.log("[ATV]", message, data || "");
}

function delay(ms){
return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, fallbackValue, label){
return Promise.race([
promise,
delay(ms).then(()=>{
appLog("Timeout fallback used", label);
return fallbackValue;
})
]);
}

let pageLoaderVisibleAt = 0;
let pageLoaderTimer = null;
let pageLoaderShowing = false;
let pageLoaderFirstShowDone = false;

function ensurePageLoader(){
let loader = document.getElementById("atvPageLoader");
if(loader) return loader;
loader = document.createElement("div");
loader.id = "atvPageLoader";
loader.className = "atv-page-loader";
loader.innerHTML = `
<div class="atv-loader-card">
<div class="atv-loader-logo">ATV<span>EXCHANGE</span></div>
<div class="atv-loader-ring"></div>
<p id="atvLoaderText">Loading secure workspace...</p>
<button id="atvLoaderRetry" class="hidden" type="button">Retry</button>
</div>
`;
document.body.appendChild(loader);
let retry = document.getElementById("atvLoaderRetry");
if(retry) retry.onclick = ()=>window.location.reload();
return loader;
}

function showPageLoader(message, options){
if(document.getElementById("splashScreen") && getPageName() === "login.html") return;
let loader = ensurePageLoader();
let opts = options || {};
let mode = opts.mode || (pageLoaderFirstShowDone ? "mini" : "full");
if(pageLoaderShowing && !opts.force) return;
pageLoaderShowing = true;
pageLoaderFirstShowDone = true;
pageLoaderVisibleAt = Date.now();
loader.classList.remove("hidden", "failed", "mini");
if(mode === "mini") loader.classList.add("mini");
let text = document.getElementById("atvLoaderText");
let retry = document.getElementById("atvLoaderRetry");
if(text) text.innerText = message || "Loading secure workspace...";
if(retry) retry.classList.add("hidden");
if(pageLoaderTimer) clearTimeout(pageLoaderTimer);
pageLoaderTimer = setTimeout(()=>{
appLog("Loader timeout fallback");
hidePageLoader(true);
}, opts.timeout || 6500);
}

function hidePageLoader(force){
let loader = document.getElementById("atvPageLoader");
if(!loader) return;
if(pageLoaderTimer) clearTimeout(pageLoaderTimer);
let elapsed = Date.now() - pageLoaderVisibleAt;
let wait = force ? 0 : Math.max(0, 160 - elapsed);
setTimeout(()=>{
loader.classList.add("hidden");
pageLoaderShowing = false;
}, wait);
}

function failPageLoader(message){
let loader = ensurePageLoader();
if(pageLoaderTimer) clearTimeout(pageLoaderTimer);
loader.classList.remove("hidden");
loader.classList.add("failed");
pageLoaderShowing = true;
let text = document.getElementById("atvLoaderText");
let retry = document.getElementById("atvLoaderRetry");
if(text) text.innerText = message || "Could not load this page. Check your connection and try again.";
if(retry) retry.classList.remove("hidden");
pageLoaderTimer = setTimeout(()=>hidePageLoader(true), 5500);
}

function setupAssetFallbacks(){
document.querySelectorAll("img").forEach(img=>{
if(img.dataset.atvFallbackReady) return;
img.dataset.atvFallbackReady = "1";
img.addEventListener("error", ()=>{
let badge = document.createElement("span");
badge.className = "asset-fallback-icon";
badge.textContent = "ATV";
badge.setAttribute("role", "img");
badge.setAttribute("aria-label", img.alt || "ATV Exchange");
img.replaceWith(badge);
}, {once:true});
});
}

function showLoginAfterSplash(delayMs){
setTimeout(()=>{
if(document.getElementById("splashScreen")) splashScreen.classList.add("hidden");
if(document.getElementById("loginCard")) loginCard.classList.remove("hidden");
hidePageLoader();
appLog("Login shown after splash");
}, delayMs || 900);
}

async function ensureDefaultUserProfile(){
if(!currentUser) return null;

let defaultProfile = {
userId: currentUser.uid,
name: currentUser.displayName || currentUser.email || "Customer",
email: currentUser.email || "",
phone: "",
tier: "Tier 1",
accountTier: 1,
accountTierLabel: "Basic",
accountStatus: "active",
kycStatus: "Not submitted",
kycApproved: false,
kycLocked: false,
updatedAt: new Date().toLocaleString()
};

try{
let doc = await withTimeout(db.collection("users").doc(currentUser.uid).get(), 2500, null, "profile get");
if(doc && doc.exists) return doc.data();

await withTimeout(db.collection("users").doc(currentUser.uid).set(defaultProfile,{merge:true}), 2500, null, "profile create");
return defaultProfile;
}catch(error){
appLog("Profile fallback because Firebase profile failed", error.message);
return defaultProfile;
}
}

auth.onAuthStateChanged(async user=>{
currentUser = user;
isAdmin = user ? adminEmails.map(email => email.toLowerCase()).includes((user.email || "").toLowerCase()) : false;

let page = getPageName();
showPageLoader("Loading "+(page.replace(".html","") || "page")+"...", {mode:"full"});
appLog("Auth state changed", {signedIn: !!user, page});

if(!user && page !== "login.html" && page !== "signup.html"){
appLog("No user on protected page; redirecting to login");
window.location.replace("login.html");
return;
}

if(user){
try{
let statusDoc = await db.collection("users").doc(user.uid).get();
let statusProfile = statusDoc.exists ? statusDoc.data() || {} : {};
if(isAccountBanned(statusProfile)){
await auth.signOut();
if(document.getElementById("loginStatus")) loginStatus.innerText = "This account has been banned. Please contact support.";
alert("This account has been banned. Please contact support.");
if(page !== "login.html") window.location.replace("login.html");
return;
}
}catch(error){
appLog("Account status check skipped", error.message);
}
}

if(user && (page === "login.html" || page === "signup.html")){
appLog("User signed in on auth page; opening dashboard");
window.location.replace("exchange.html");
return;
}

if(!user && page === "login.html"){
showLoginAfterSplash(900);
return;
}

if(!(await guardSensitivePage(page))) return;

ensureLoggedInUserTransferUid();
showAdminButtons();
updatePushDashboardCard();
ensureSubPageBackButton(page);
setupMoneyInputs();
setupAssetFallbacks();
loadBalanceVisibilityPreference();

try{
if(page === "exchange.html") await withTimeout(loadHomePage(), 5000, null, "home page");
if(page === "convert.html") await withTimeout(loadConvertPage(), 5000, null, "convert page");
if(page === "profile.html") await withTimeout(loadProfilePage(), 5000, null, "profile page");
if(page === "settings.html") await withTimeout(loadSettingsPage(), 5000, null, "settings page");
if(page === "notifications.html") await withTimeout(loadNotificationsPage(), 5000, null, "notifications page");
if(page === "notification-settings.html") await withTimeout(loadNotificationSettingsPage(), 5000, null, "notification settings page");
if(page === "payment-method.html") await withTimeout(loadPaymentMethodPage(), 5000, null, "payment method page");
if(page === "add-payment-method.html") await withTimeout(loadAddPaymentMethodPage(), 5000, null, "add payment method page");
if(page === "security.html") await withTimeout(loadSecurityPage(), 5000, null, "security page");
if(page === "withdrawal-pin.html") await withTimeout(loadWithdrawalPinPage(), 5000, null, "withdrawal pin page");
if(page === "kyc.html") await withTimeout(loadKycPage(), 5000, null, "kyc page");
if(page === "payment.html") await withTimeout(loadPaymentPage(), 5000, null, "payment page");
if(page === "wallet-convert.html") await withTimeout(loadWalletConvertPage(), 5000, null, "wallet convert page");
if(page === "deposit.html") await withTimeout(loadDepositPage(), 5000, null, "deposit page");
if(page === "transfer.html") await withTimeout(loadTransferPage(), 5000, null, "transfer page");
if(page === "withdraw.html") await withTimeout(loadWithdrawPage(), 5000, null, "withdraw page");
if(page === "orders.html") loadMyOrdersPage();
if(page === "order-detail.html") await withTimeout(loadOrderDetailPage(), 5000, null, "order detail page");
if(page === "success.html") loadSuccessPage();
if(page === "support.html") loadSupportPage();
if(page === "dashboard.html") await requireAdmin(loadDashboard);
if(page === "profit.html") await requireAdmin(loadProfitDashboard);
if(page === "customers.html") await requireAdmin(loadCustomersPage);
if(page === "kyc-admin.html") await requireAdmin(loadKycReviewPage);
if(page === "rates.html") await requireAdmin(loadRatesPage);
if(page === "announcements.html") await requireAdmin(loadAnnouncementsPage);
if(page === "support-admin.html") await requireAdmin(loadSupportAdminPage);
if(page === "support-chat-admin.html") await requireAdmin(loadSupportAdminChatPage);
if(page === "deposit-orders.html") await requireAdmin(()=>loadAdminOrderListPage("deposits"));
if(page === "convert-orders.html") await requireAdmin(()=>loadAdminOrderListPage("converts"));
if(page === "swap-orders.html") await requireAdmin(()=>loadAdminOrderListPage("swaps"));
if(page === "withdrawal-orders.html") await requireAdmin(()=>loadAdminOrderListPage("withdrawals"));
if(page === "utility-bill-approvals.html") await requireAdmin(()=>loadAdminOrderListPage("utility"));
if(page === "admin-notifications.html") await requireAdmin(loadAdminNotificationsPage);
if(page === "transaction-history.html") await requireAdmin(()=>loadAdminOrderListPage("history"));
setupForegroundMessaging();
setupFirestoreNotificationPopups();
setupNotificationBadgeListener();
setupAssetFallbacks();
trackLoginDevice();
appLog("Page route finished", page);
hidePageLoader();
}catch(error){
appLog("Page route failed", error.message);
if(page === "exchange.html"){
renderDefaultHomeState(error.message);
hidePageLoader();
}else{
failPageLoader("Could not load this page: "+error.message);
}
}
});

function getPageName(){
let page = window.location.pathname.split("/").pop();
return page || "index.html";
}

function goToPage(page){
showPageLoader("Opening page...", {mode:"mini", timeout:3500});
window.location.href = page;
}

function togglePasswordVisibility(inputId, button){
let input = document.getElementById(inputId);
if(!input) return;
let showing = input.type === "text";
input.type = showing ? "password" : "text";
if(button){
button.innerHTML = "&#128065;";
button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
}
}

function ensureSubPageBackButton(page){
let noBackPages = ["index.html","login.html","signup.html","exchange.html","dashboard.html"];
if(noBackPages.includes(page) || document.querySelector(".back-btn")) return;
let adminPages = ["profit.html","rates.html","customers.html","announcements.html","deposit-orders.html","convert-orders.html","swap-orders.html","withdrawal-orders.html","utility-bill-approvals.html","transaction-history.html"];
let backTarget = page === "order-detail.html" ? (isAdmin ? "dashboard.html" : "orders.html") : page.includes("admin") || adminPages.includes(page) ? "dashboard.html" : "exchange.html";
let wrapper = document.createElement("div");
wrapper.className = "auto-back-wrap";
wrapper.innerHTML = `<button class="back-btn" type="button">Back</button>`;
wrapper.querySelector("button").onclick = ()=>goToPage(backTarget);
let appRoot = document.querySelector(".app") || document.body;
appRoot.insertBefore(wrapper, appRoot.firstChild);
}

function escapeHtml(value){
return String(value || "")
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#039;");
}

function openTransactionSuccess(payload){
let data = {
title: "Transaction Successful",
message: "Your transaction has been completed successfully.",
type: "",
reference: "",
amount: "",
status: "Completed",
details: [],
orderCollection: "",
orderId: "",
createdAt: new Date().toLocaleString(),
...payload
};
localStorage.setItem("atvSuccessPayload", JSON.stringify(data));
window.location.href = "success.html";
}

function loadSuccessPage(){
let box = document.getElementById("successBox");
if(!box) return;

let payload = {};
try{
payload = JSON.parse(localStorage.getItem("atvSuccessPayload") || "{}");
}catch(error){
payload = {};
}

let details = Array.isArray(payload.details) ? payload.details : [];
let detailRows = details.map(item => `
<div><span>${item.label}</span><b>${item.value || "Not provided"}</b></div>
`).join("");
let orderButton = payload.orderCollection && payload.orderId
? `<button class="outline-btn" onclick="goToOrderDetail('${payload.orderCollection}','${payload.orderId}')">View Transaction Details</button>`
: "";
let successReceipt = buildReceiptDownloadData({
collection: payload.orderCollection || "transactions",
id: payload.orderId || payload.reference || "success",
title: payload.reference || payload.orderId || "Transaction",
type: payload.type || "Transaction",
transactionId: payload.transactionId || payload.reference || payload.orderId || "",
status: payload.status || "Completed",
amount: payload.amount || "",
received: firstOrderValue(payload, ["received","amountReceived","amountReceiving"]),
rate: firstOrderValue(payload, ["rate","exchangeRate","rateUsed"]),
sender: payload.sender || payload.senderName || currentProfile && currentProfile.name || currentUser && currentUser.email || "",
recipient: payload.recipient || payload.recipientName || payload.settlementAccountName || "",
customer: currentProfile && currentProfile.name || currentUser && currentUser.email || "",
date: payload.createdAt || new Date().toLocaleString()
});
window.currentSuccessReceiptDownload = successReceipt;

box.innerHTML = `
<div class="success-done-mark">DONE</div>
<h1>${payload.title || "Transaction Successful"}</h1>
<p>${payload.message || "Your transaction has been completed successfully."}</p>
<div class="receipt-id-strip">Receipt ID: <b>${escapeHtml(successReceipt.receiptId)}</b></div>
<div class="flow-summary-grid success-summary-grid">
<div><span>Type</span><b>${payload.type || "Transaction"}</b></div>
<div><span>Reference</span><b>${payload.reference || payload.orderId || "Not provided"}</b></div>
<div><span>Amount</span><b>${payload.amount || "Not provided"}</b></div>
<div><span>Status</span><b>${payload.status || "Completed"}</b></div>
${detailRows}
</div>
<div class="success-actions">
<button onclick="downloadSuccessReceiptImage()">Download Receipt</button>
<button class="outline-btn" onclick="shareSuccessReceiptImage()">Share Receipt</button>
${orderButton}
<button onclick="goToPage('orders.html')">Transaction History</button>
<button onclick="goToPage('exchange.html')">Back to Dashboard</button>
</div>
`;
}

function simpleHash(text){
let hash = 0;
let value = String(text || "");
for(let i = 0; i < value.length; i++){
hash = ((hash << 5) - hash) + value.charCodeAt(i);
hash |= 0;
}
return Math.abs(hash).toString().padStart(8, "0").slice(0, 10);
}

function receiptDateCode(value){
let date = value ? new Date(value) : new Date();
if(Number.isNaN(date.getTime())) date = new Date();
let yyyy = date.getFullYear();
let mm = String(date.getMonth() + 1).padStart(2, "0");
let dd = String(date.getDate()).padStart(2, "0");
return `${yyyy}${mm}${dd}`;
}

function uniqueReceiptId(collection, id, dateValue){
return "ATV-"+receiptDateCode(dateValue)+"-"+simpleHash([collection, id, dateValue].join("-"));
}

function isSuccessfulReceiptStatus(status){
let value = String(status || "").toLowerCase();
return value.includes("completed") || value.includes("successful") || value.includes("credited") || value === "approved";
}

function buildReceiptDownloadData(data){
let dateValue = data.date || data.completedAt || data.createdAt || new Date().toLocaleString();
let reference = data.reference || data.id || data.title || "";
let transactionId = data.transactionId || data.paymentReference || reference;
return {
receiptId: data.receiptId || uniqueReceiptId(data.collection || "transactions", reference, dateValue),
brand: "ATV Exchange",
title: data.title || reference || "Transaction",
type: data.type || "Transaction",
reference,
transactionId,
status: data.status || "Completed",
amount: data.amount || "",
received: data.received || "",
rate: data.rate || "",
sender: data.sender || data.customer || "",
recipient: data.recipient || "",
customer: data.customer || data.sender || "",
date: dateValue
};
}

function truncateCanvasText(ctx, text, maxWidth){
let value = String(text || "Not provided");
if(ctx.measureText(value).width <= maxWidth) return value;
while(value.length > 4 && ctx.measureText(value+"...").width > maxWidth){
value = value.slice(0, -1);
}
return value.length > 4 ? value+"..." : value;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
let value = String(text || "Not provided");
let words = value.split(/\s+/);
let lines = [];
let current = "";

words.forEach(word=>{
let test = current ? current+" "+word : word;
if(ctx.measureText(test).width <= maxWidth){
current = test;
}else{
if(current) lines.push(current);
current = word;
}
});
if(current) lines.push(current);

if(lines.length > maxLines){
lines = lines.slice(0, maxLines);
let last = lines[lines.length - 1];
while(last.length > 4 && ctx.measureText(last+"...").width > maxWidth){
last = last.slice(0, -1);
}
lines[lines.length - 1] = last+"...";
}

lines.forEach((line, index)=>ctx.fillText(line, x, y + (index * lineHeight)));
return lines.length;
}

function drawReceiptLine(ctx, label, value, x, y){
ctx.fillStyle = "#6b7280";
ctx.font = "22px Arial";
ctx.fillText(label, x, y);
ctx.fillStyle = "#101828";
ctx.font = "bold 22px Arial";
ctx.textAlign = "left";
wrapCanvasText(ctx, value, 410, y, 392, 28, 2);
ctx.textAlign = "left";
}

function buildReceiptCanvas(data){
let receipt = buildReceiptDownloadData(data || {});
let canvas = document.createElement("canvas");
canvas.width = 940;
canvas.height = 1320;
let ctx = canvas.getContext("2d");

ctx.fillStyle = "#f4f7f5";
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.fillStyle = "#07120d";
ctx.fillRect(40, 40, 860, 1240);

let gradient = ctx.createLinearGradient(40, 40, 900, 250);
gradient.addColorStop(0, "#0b3d27");
gradient.addColorStop(1, "#16C784");
ctx.fillStyle = gradient;
ctx.fillRect(40, 40, 860, 230);

ctx.fillStyle = "#ffffff";
ctx.font = "bold 42px Arial";
ctx.fillText("ATV Exchange", 88, 112);
ctx.font = "24px Arial";
ctx.fillText("Transaction Receipt", 88, 154);

ctx.fillStyle = "#d9fff0";
ctx.font = "bold 22px Arial";
ctx.fillText(receipt.receiptId, 88, 214);

ctx.fillStyle = "#ffffff";
ctx.font = "bold 28px Arial";
ctx.textAlign = "right";
ctx.fillText(receipt.status, 850, 112);
ctx.textAlign = "left";

ctx.fillStyle = "#ffffff";
ctx.fillRect(88, 315, 764, 850);
ctx.strokeStyle = "#e5eee8";
ctx.lineWidth = 2;
ctx.strokeRect(88, 315, 764, 850);

ctx.fillStyle = "#16C784";
ctx.beginPath();
ctx.arc(470, 405, 54, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = "#ffffff";
ctx.lineWidth = 10;
ctx.beginPath();
ctx.moveTo(440, 406);
ctx.lineTo(462, 428);
ctx.lineTo(505, 380);
ctx.stroke();

ctx.fillStyle = "#101828";
ctx.font = "bold 34px Arial";
ctx.textAlign = "center";
ctx.fillText("Transaction Successful", 470, 505);
ctx.textAlign = "left";

let y = 590;
let rows = [
["Type", receipt.type],
["Transaction ID", receipt.transactionId],
["Amount Sent", receipt.amount],
["Amount Received", receipt.received],
["Rate", receipt.rate],
["Sender", receipt.sender],
["Recipient", receipt.recipient],
["Date", receipt.date]
];
rows.forEach(row=>{
drawReceiptLine(ctx, row[0], row[1], 128, y);
y += 78;
ctx.strokeStyle = "#edf2ef";
ctx.beginPath();
ctx.moveTo(128, y - 38);
ctx.lineTo(812, y - 38);
ctx.stroke();
});

ctx.fillStyle = "#6b7280";
ctx.font = "20px Arial";
ctx.textAlign = "center";
ctx.fillText("Support: ATV Exchange Support", 470, 1164);
ctx.fillText(truncateCanvasText(ctx, "Receipt ID: "+receipt.receiptId, 680), 470, 1196);
ctx.fillText("Keep this receipt for your records.", 470, 1228);
ctx.textAlign = "left";
return {canvas, receipt};
}

function canvasToBlob(canvas){
return new Promise(resolve => canvas.toBlob(resolve, "image/png", 0.92));
}

function downloadReceiptImage(data){
let built = buildReceiptCanvas(data || {});
let canvas = built.canvas;
let receipt = built.receipt;

let link = document.createElement("a");
link.download = receipt.receiptId+".png";
link.href = canvas.toDataURL("image/png");
document.body.appendChild(link);
link.click();
link.remove();
}

async function shareReceiptImage(data){
let built = buildReceiptCanvas(data || {});
let receipt = built.receipt;
let blob = await canvasToBlob(built.canvas);
if(!blob) return downloadReceiptImage(data);
let file = new File([blob], receipt.receiptId+".png", {type:"image/png"});
if(navigator.canShare && navigator.canShare({files:[file]}) && navigator.share){
await navigator.share({
title: "ATV Exchange Receipt",
text: "ATV Exchange receipt "+receipt.receiptId,
files: [file]
});
return;
}
downloadReceiptImage(data);
showToast("Sharing is not supported on this browser, so the receipt was downloaded.");
}

function downloadSuccessReceiptImage(){
downloadReceiptImage(window.currentSuccessReceiptDownload || {});
}

function downloadCurrentOrderReceipt(){
downloadReceiptImage(window.currentOrderReceiptDownload || {});
}

function shareSuccessReceiptImage(){
shareReceiptImage(window.currentSuccessReceiptDownload || {});
}

function shareCurrentOrderReceipt(){
shareReceiptImage(window.currentOrderReceiptDownload || {});
}

async function refreshPage(){
try{
if("caches" in window){
let keys = await caches.keys();
await Promise.all(keys.map(key => caches.delete(key)));
}

if("serviceWorker" in navigator){
let registration = await navigator.serviceWorker.getRegistration();
if(registration) await registration.update();
}
}catch(error){
appLog("Refresh cache cleanup skipped", error.message);
}

window.location.reload();
}

function renderDefaultHomeState(reason){
appLog("Rendering default dashboard state", reason);
if(document.getElementById("homeRateText")){
homeRateText.innerText = format(defaultRateSettings.rateCedis)+" / "+format(defaultRateSettings.rateNaira);
}
if(document.getElementById("homeCustomerName")){
homeCustomerName.innerText = currentUser ? (currentUser.email || "Customer") : "Customer";
}
if(document.getElementById("homeKycBadge")){
homeKycBadge.innerText = "Profile pending";
homeKycBadge.className = "badge pending";
}
setHomeBalances(0,0);
if(document.getElementById("homeRecentTransactions")){
homeRecentTransactions.innerHTML = "No recent transactions yet";
}
}

function showAdminButtons(){
if(document.getElementById("dashboardBtn")) dashboardBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("profitBtn")) profitBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("customersBtn")) customersBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("kycBtn")) kycBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("ratesBtn")) ratesBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("supportAdminBtn")) supportAdminBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("adminHomeBtn")) adminHomeBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("adminQuickPanel")) adminQuickPanel.classList.toggle("hidden", !isAdmin);
}

function toggleMoreMenu(){
if(!document.getElementById("moreMenu")) return;
moreMenu.classList.toggle("hidden");
}

function showNotifications(){
if(!currentUser) return alert("Login first");

let existing = document.getElementById("notificationPanel");
if(existing){
existing.remove();
return;
}

let panel = document.createElement("div");
panel.id = "notificationPanel";
panel.className = "notification-panel";
panel.innerHTML = `
<div class="section-title">
<h3>Notifications</h3>
<button class="text-btn" onclick="showNotifications()">Close</button>
</div>
<div class="notification-filters">
<button class="active" data-filter="all">All</button>
<button data-filter="orders">Orders</button>
<button data-filter="kyc">KYC</button>
<button data-filter="payments">Payments</button>
<button data-filter="security">Security</button>
<button data-filter="support">Support</button>
<button data-filter="system">System</button>
</div>
<div id="notificationList">Loading...</div>
`;
document.body.appendChild(panel);

loadNotificationRows().then(rows=>{
let activeFilter = "all";

if(rows.length === 0){
notificationList.innerHTML = "No notifications yet";
return;
}

function renderNotifications(){
let filtered = rows.filter(item => activeFilter === "all" || notificationGroup(item) === activeFilter);
notificationList.innerHTML = filtered.length ? filtered.slice(0, 60).map(item => {
let target = notificationTarget(item);
let group = notificationGroup(item);
let priority = item.priority || "medium";
return `
<div class="notification-item ${notificationIsReadByMe(item) ? "" : "unread"} priority-${priority}" data-id="${escapeHtml(item.id)}" data-collection="${escapeHtml(target.collection)}" data-target-id="${escapeHtml(target.id)}" data-link="${escapeHtml(target.link)}">
<button class="notification-open" type="button">
<span class="notification-meta">${group.toUpperCase()} &bull; ${priority}</span>
<b>${escapeHtml(item.title || "Notification")}</b>
<p>${escapeHtml(item.message || item.body || "")}</p>
<small>${escapeHtml(item.createdAt || "")}</small>
</button>
<button class="notification-delete" type="button" title="Delete">Delete</button>
</div>
`;
}).join("") : '<div class="admin-empty">No notifications in this category</div>';

notificationList.querySelectorAll(".notification-open").forEach(button=>{
button.onclick = ()=>{
let item = button.closest(".notification-item");
openNotificationTarget(item.dataset.collection, item.dataset.targetId, item.dataset.link);
};
});
notificationList.querySelectorAll(".notification-delete").forEach(button=>{
button.onclick = async (event)=>{
event.stopPropagation();
let item = button.closest(".notification-item");
await db.collection("notifications").doc(item.dataset.id).set({
deletedFor: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
deletedAt: new Date().toLocaleString()
},{merge:true});
item.remove();
};
});
}

renderNotifications();
panel.querySelectorAll(".notification-filters button").forEach(button=>{
button.onclick = ()=>{
activeFilter = button.dataset.filter;
panel.querySelectorAll(".notification-filters button").forEach(btn=>btn.classList.toggle("active", btn === button));
renderNotifications();
};
});

let unreadUpdates = rows.filter(item => !notificationIsReadByMe(item)).map(item => {
let update = item.forRole === "customer" && !item.userId
? {readBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid), readAt:new Date().toLocaleString()}
: {read:true, readAt:new Date().toLocaleString()};
return db.collection("notifications").doc(item.id).set(update,{merge:true});
});
return Promise.all(unreadUpdates);
})
.catch(error=>{
notificationList.innerHTML = "Could not load notifications: "+error.message;
});
}

function notificationTarget(item){
let data = item.data || item.metadata || {};
if(item.depositId || data.depositId) return {collection:"deposits", id:item.depositId || data.depositId, link:""};
if(item.requestId || data.requestId) return {collection:"walletRequests", id:item.requestId || data.requestId, link:""};
if(item.transactionDocId || data.transactionDocId) return {collection:"transactions", id:item.transactionDocId || data.transactionDocId, link:""};
if(item.transactionId || data.transactionId) return {collection:"transactions", id:item.transactionId || data.transactionId, link:""};
if(item.orderId || data.orderId) return {collection:"transactions", id:item.orderId || data.orderId, link:""};
return {collection:"", id:"", link:item.actionLink || item.link || data.link || ""};
}

function notificationGroup(item){
let type = String(item.type || "").toLowerCase();
if(type.includes("order") || type.includes("convert") || type.includes("transfer") || type.includes("swap")) return "orders";
if(type.includes("kyc") || type.includes("id-card") || type.includes("utility")) return "kyc";
if(type.includes("deposit") || type.includes("withdraw") || type.includes("payment") || type.includes("receipt") || type.includes("balance")) return "payments";
if(type.includes("security") || type.includes("login") || type.includes("password") || type.includes("suspicious")) return "security";
if(type.includes("support")) return "support";
return "system";
}

async function loadNotificationRows(){
let queries = [
db.collection("notifications").where("userId","==",currentUser.uid).get(),
db.collection("notifications").where("forUserId","==",currentUser.uid).get(),
db.collection("notifications").where("forRole","==","customer").get()
];
if(isAdmin){
queries.push(db.collection("notifications").where("role","==","admin").get());
queries.push(db.collection("notifications").where("forRole","==","admin").get());
}

let snaps = await Promise.all(queries.map(query => query.catch(error => {
appLog("Notification query skipped", error.message);
return null;
})));
let map = new Map();
snaps.forEach(snap=>{
if(!snap) return;
snap.forEach(doc=>{
let item = {id:doc.id, ...doc.data()};
let deletedFor = item.deletedFor || [];
if(Array.isArray(deletedFor) && deletedFor.includes(currentUser.uid)) return;
map.set(doc.id, item);
});
});

return Array.from(map.values()).sort((a,b)=>notificationTimeValue(b) - notificationTimeValue(a));
}

function notificationTimeValue(item){
if(item.createdAtMs) return Number(item.createdAtMs);
if(item.createdAt && item.createdAt.toMillis) return item.createdAt.toMillis();
let parsed = Date.parse(item.createdAt || item.createdLabel || item.date || "");
return Number.isFinite(parsed) ? parsed : 0;
}

function notificationIsReadByMe(item){
if(item.forRole === "customer" && !item.userId){
let readBy = item.readBy || [];
return Array.isArray(readBy) && readBy.includes(currentUser.uid);
}
return Boolean(item.read);
}

function openNotificationTarget(collection, id, link){
if(collection && id) return goToOrderDetail(collection, id);
if(link) return goToPage(link);
showNotifications();
}

function getPushStatusElement(){
return document.getElementById("pushStatus");
}

function setPushStatus(message){
let status = getPushStatusElement();
if(status) status.innerText = message;
}

function pushLocalKey(suffix){
return currentUser ? "atvPush_"+suffix+"_"+currentUser.uid : "";
}

function getSavedPushToken(){
let key = pushLocalKey("token");
return key ? localStorage.getItem(key) || "" : "";
}

function markPushEnabledLocally(token){
if(!currentUser) return;
if(token) localStorage.setItem(pushLocalKey("token"), token);
localStorage.setItem(pushLocalKey("everEnabled"), "1");
localStorage.setItem(pushLocalKey("enabled"), "1");
updatePushDashboardCard();
}

function markPushDisabledLocally(){
if(!currentUser) return;
localStorage.removeItem(pushLocalKey("token"));
localStorage.setItem(pushLocalKey("enabled"), "0");
localStorage.setItem(pushLocalKey("everEnabled"), "1");
updatePushDashboardCard();
}

function updatePushDashboardCard(){
let card = document.getElementById("enablePushCard");
if(!card) return;
card.classList.add("hidden");
}

async function hydratePushStatusFromFirestore(){
if(!currentUser) return;
try{
let snap = await db.collection("users").doc(currentUser.uid).collection("fcmTokens").get();
let hasEnabledToken = false;
snap.forEach(doc=>{
let data = doc.data() || {};
if(data.token && data.enabled !== false) hasEnabledToken = true;
});
if(hasEnabledToken){
localStorage.setItem(pushLocalKey("everEnabled"), "1");
localStorage.setItem(pushLocalKey("enabled"), "1");
refreshPushServiceWorkerRegistration();
}
if("Notification" in window && Notification.permission === "granted"){
localStorage.setItem(pushLocalKey("everEnabled"), "1");
}
updatePushDashboardCard();
}catch(error){
appLog("Push status hydrate skipped", error.message);
}
}

async function refreshPushServiceWorkerRegistration(){
if(!currentUser || !("serviceWorker" in navigator) || !("Notification" in window)) return;
if(Notification.permission !== "granted") return;
try{
let messaging = await getMessagingInstance();
if(!messaging) return;
let registration = await navigator.serviceWorker.register("./sw.js?v=20260529verifyfix1");
await registration.update();
let token = await messaging.getToken({
vapidKey: fcmVapidKey,
serviceWorkerRegistration: registration
});
if(!token) return;
await db.collection("users").doc(currentUser.uid).collection("fcmTokens").doc(tokenDocId(token)).set({
token,
uid: currentUser.uid,
email: currentUser.email || "",
device: navigator.userAgent || "",
enabled: true,
preferences: getNotificationPreferenceValues(true),
lastUpdated: new Date().toLocaleString()
},{merge:true});
markPushEnabledLocally(token);
}catch(error){
appLog("Push service worker refresh skipped", error.message);
}
}

function hasMessagingConfig(){
return !!(firebaseConfig.messagingSenderId && firebaseConfig.appId);
}

async function getMessagingInstance(){
if(!firebase.messaging) return null;

if(firebase.messaging.isSupported){
let supported = await firebase.messaging.isSupported();
if(!supported) return null;
}

return firebase.messaging();
}

function tokenDocId(token){
let hash = 0;
for(let i = 0; i < token.length; i++){
hash = ((hash << 5) - hash) + token.charCodeAt(i);
hash |= 0;
}
return "token-"+Math.abs(hash);
}

async function enablePushNotifications(){
if(!currentUser) return alert("Login first");
setPushStatus("Checking notification support...");
if(!("Notification" in window)){
setPushStatus("This browser does not support notifications.");
return alert("This browser does not support notifications.");
}
if(!("serviceWorker" in navigator)){
setPushStatus("Service worker is required for push notifications.");
return alert("Service worker is required for push notifications.");
}
if(!window.isSecureContext){
setPushStatus("Notifications require HTTPS. Open the live HTTPS app, not a plain HTTP page.");
return alert("Notifications require HTTPS. Open the live HTTPS app, not a plain HTTP page.");
}
if(!fcmVapidKey || fcmVapidKey.includes("PASTE_")){
setPushStatus("Add your Firebase Web Push VAPID key in app.js first.");
return alert("Add your Firebase Web Push VAPID key in app.js first.");
}
if(!hasMessagingConfig()){
setPushStatus("Missing Firebase messagingSenderId/appId. Add the full Firebase web app config from Firebase Console.");
return alert("Missing Firebase messagingSenderId/appId. Go to Firebase Console > Project settings > Your apps, copy the full web app config, and add messagingSenderId and appId in app.js and firebase-messaging-sw.js.");
}

let messaging = await getMessagingInstance();
if(!messaging){
setPushStatus("Firebase Messaging is not supported on this browser.");
return alert("Firebase Messaging is not supported on this browser.");
}

try{
setPushStatus("Requesting notification permission...");
let permission = await Notification.requestPermission();
if(permission !== "granted"){
setPushStatus("Notifications were not enabled. Browser permission was not granted.");
if(document.getElementById("pushEnabledToggle")) pushEnabledToggle.checked = false;
return;
}

setPushStatus("Registering notification service worker...");
let registration = await navigator.serviceWorker.register("./sw.js?v=20260529verifyfix1");
await registration.update();

setPushStatus("Creating this device notification token...");
let token = await messaging.getToken({
vapidKey: fcmVapidKey,
serviceWorkerRegistration: registration
});

if(!token) throw new Error("No FCM token returned");

await db.collection("users").doc(currentUser.uid).collection("fcmTokens").doc(tokenDocId(token)).set({
token,
uid: currentUser.uid,
email: currentUser.email || "",
device: navigator.userAgent || "",
enabled: true,
preferences: getNotificationPreferenceValues(true),
createdAt: new Date().toLocaleString(),
lastUpdated: new Date().toLocaleString()
},{merge:true});

await db.collection("users").doc(currentUser.uid).set({
notificationSettings: getNotificationPreferenceValues(true),
updatedAt: new Date().toLocaleString()
},{merge:true});

markPushEnabledLocally(token);
updatePushDashboardCard();
await sendNotificationSelfTest(registration);
setupFirestoreNotificationPopups();
showToast("Notifications enabled");
showMobileNotificationPopup("Notifications Ready", "This phone is connected to ATV Exchange alerts.", {link:"exchange.html"});
setPushStatus("Notifications enabled on this device. PythonAnywhere will send phone alerts when the backend is live.");
loadNotificationSettings();
}catch(error){
setPushStatus("Could not enable notifications: "+error.message);
if(document.getElementById("pushEnabledToggle")) pushEnabledToggle.checked = false;
alert("Could not enable notifications: "+error.message);
}
}

async function sendNotificationSelfTest(registration){
try{
if(registration && registration.showNotification && "Notification" in window && Notification.permission === "granted"){
await registration.showNotification("ATV Exchange", {
body: "Notifications are active on this device.",
icon: "./icon.png",
badge: "./icon.png",
data: {link:"exchange.html"}
});
}
}catch(error){
appLog("Notification self-test skipped", error.message);
}
}

function defaultNotificationPreferences(){
return {
pushEnabled: localStorage.getItem(pushLocalKey("enabled")) === "1",
sound: true,
vibration: true,
announcements: true,
rateUpdates: true
};
}

function getNotificationPreferenceValues(pushEnabledOverride){
let pushEnabled = typeof pushEnabledOverride === "boolean"
? pushEnabledOverride
: document.getElementById("pushEnabledToggle") ? pushEnabledToggle.checked : localStorage.getItem(pushLocalKey("enabled")) === "1";
return {
pushEnabled,
sound: document.getElementById("notificationSoundToggle") ? notificationSoundToggle.checked : true,
vibration: document.getElementById("notificationVibrationToggle") ? notificationVibrationToggle.checked : true,
announcements: document.getElementById("announcementAlertsToggle") ? announcementAlertsToggle.checked : true,
rateUpdates: document.getElementById("rateAlertsToggle") ? rateAlertsToggle.checked : true
};
}

async function loadNotificationSettings(){
if(!currentUser || !document.getElementById("pushEnabledToggle")) return;
let prefs = defaultNotificationPreferences();
try{
let doc = await db.collection("users").doc(currentUser.uid).get();
let data = doc.exists ? doc.data() || {} : {};
prefs = {...prefs, ...(data.notificationSettings || {})};
let token = getSavedPushToken();
if(token){
let tokenDoc = await db.collection("users").doc(currentUser.uid).collection("fcmTokens").doc(tokenDocId(token)).get();
if(tokenDoc.exists){
let tokenData = tokenDoc.data() || {};
prefs = {...prefs, ...(tokenData.preferences || {}), pushEnabled: tokenData.enabled !== false};
localStorage.setItem(pushLocalKey("enabled"), tokenData.enabled === false ? "0" : "1");
}
}
}catch(error){
appLog("Notification settings load skipped", error.message);
}

pushEnabledToggle.checked = Boolean(prefs.pushEnabled);
notificationSoundToggle.checked = prefs.sound !== false;
notificationVibrationToggle.checked = prefs.vibration !== false;
announcementAlertsToggle.checked = prefs.announcements !== false;
rateAlertsToggle.checked = prefs.rateUpdates !== false;
let permissionText = "Notification" in window ? Notification.permission : "unsupported";
let statusText = prefs.pushEnabled ? "Notifications are enabled on this device." : "Notifications are disabled on this device.";
if(permissionText === "denied") statusText = "Browser permission is denied. Enable notifications from your browser or phone app settings.";
if(permissionText === "default") statusText += " Browser permission has not been granted yet.";
setPushStatus(statusText+" Permission: "+permissionText+".");
updatePushDashboardCard();
}

async function saveNotificationSettings(){
if(!currentUser) return alert("Login first");
let prefs = getNotificationPreferenceValues();
try{
await db.collection("users").doc(currentUser.uid).set({
notificationSettings: prefs,
updatedAt: new Date().toLocaleString()
},{merge:true});
let token = getSavedPushToken();
if(token){
await db.collection("users").doc(currentUser.uid).collection("fcmTokens").doc(tokenDocId(token)).set({
enabled: prefs.pushEnabled,
preferences: prefs,
lastUpdated: new Date().toLocaleString()
},{merge:true});
}
localStorage.setItem(pushLocalKey("enabled"), prefs.pushEnabled ? "1" : "0");
localStorage.setItem(pushLocalKey("everEnabled"), "1");
setPushStatus("Notification settings saved.");
showToast("Notification settings saved");
updatePushDashboardCard();
}catch(error){
setPushStatus("Could not save notification settings: "+error.message);
alert("Could not save notification settings: "+error.message);
}
}

async function togglePushFromSettings(){
if(!document.getElementById("pushEnabledToggle")) return;
if(pushEnabledToggle.checked){
await enablePushNotifications();
}else{
await disablePushNotifications();
}
updatePushDashboardCard();
}

async function disablePushNotifications(){
if(!currentUser) return;
try{
let token = getSavedPushToken();
if(token){
await db.collection("users").doc(currentUser.uid).collection("fcmTokens").doc(tokenDocId(token)).set({
enabled: false,
lastUpdated: new Date().toLocaleString()
},{merge:true});
try{
let messaging = await getMessagingInstance();
if(messaging && messaging.deleteToken) await messaging.deleteToken(token);
}catch(error){
appLog("FCM delete token skipped", error.message);
}
}
markPushDisabledLocally();
await db.collection("users").doc(currentUser.uid).set({
notificationSettings: {...defaultNotificationPreferences(), pushEnabled:false},
updatedAt: new Date().toLocaleString()
},{merge:true});
if(document.getElementById("pushEnabledToggle")) pushEnabledToggle.checked = false;
setPushStatus("Push notifications disabled for this device.");
showToast("Notifications disabled");
}catch(error){
setPushStatus("Could not disable notifications: "+error.message);
alert("Could not disable notifications: "+error.message);
}
}

function setupForegroundMessaging(){
if(setupForegroundMessaging.started || !firebase.messaging) return;
setupForegroundMessaging.started = true;

Promise.resolve(firebase.messaging.isSupported ? firebase.messaging.isSupported() : true)
.then(supported=>{
if(!supported || !hasMessagingConfig()) return;

let messaging = firebase.messaging();
messaging.onMessage(payload=>{
let title = payload.notification && payload.notification.title ? payload.notification.title : "ATV Exchange";
let body = payload.notification && payload.notification.body ? payload.notification.body : (payload.data && payload.data.body ? payload.data.body : "");
showToast(title+": "+body);
showMobileNotificationPopup(title, body, payload.data || {});

if(document.visibilityState === "visible" && "Notification" in window && Notification.permission === "granted"){
new Notification(title, {
body,
icon: "./icon.png",
data: payload.data || {}
});
}
});
})
.catch(error=>{
appLog("Foreground messaging skipped", error.message);
});
}

function setupFirestoreNotificationPopups(){
if(!currentUser) return;
let listenerKey = currentUser.uid+"-"+(isAdmin ? "admin" : "customer");
if(window.notificationPopupUserId === listenerKey && window.notificationUnsubscribes) return;
if(window.notificationUnsubscribes) window.notificationUnsubscribes.forEach(unsubscribe=>unsubscribe && unsubscribe());

window.notificationPopupUserId = listenerKey;
window.notificationUnsubscribes = [];
let seenIds = new Set();

function listenForPopup(query, label){
let firstSnapshot = true;
let unsubscribe = query.onSnapshot(snapshot=>{
snapshot.docChanges().forEach(change=>{
let item = {id: change.doc.id, ...change.doc.data()};
if(change.type !== "added" && change.type !== "modified") return;
if(seenIds.has(item.id)) return;
seenIds.add(item.id);
if(firstSnapshot || notificationIsReadByMe(item)) return;

let title = item.title || "ATV Exchange";
let body = item.message || item.body || "You have a new update.";
showToast(title+": "+body);
showMobileNotificationPopup(title, body, item);

// Firestore already powers the in-app toast. Avoid a second browser notification
// when the FCM push for the same event also arrives.
});
firstSnapshot = false;
}, error=>{
appLog(label+" notification popup listener skipped", error.message);
});
window.notificationUnsubscribes.push(unsubscribe);
}

listenForPopup(db.collection("notifications").where("forUserId","==",currentUser.uid), "Customer");
listenForPopup(db.collection("notifications").where("userId","==",currentUser.uid), "Customer");
listenForPopup(db.collection("notifications").where("forRole","==","customer"), "Customer");
if(isAdmin){
listenForPopup(db.collection("notifications").where("forRole","==","admin"), "Admin");
listenForPopup(db.collection("notifications").where("role","==","admin"), "Admin");
}
}

function setupNotificationBadgeListener(){
if(!currentUser) return;
let listenerKey = currentUser.uid+"-"+(isAdmin ? "admin" : "customer");
if(window.notificationBadgeUserId === listenerKey && notificationBadgeUnsubscribes.length) return;
notificationBadgeUnsubscribes.forEach(unsubscribe=>unsubscribe && unsubscribe());
notificationBadgeUnsubscribes = [];
window.notificationBadgeUserId = listenerKey;

let items = new Map();
function refresh(){
let count = 0;
items.forEach(item=>{
let deletedFor = item.deletedFor || [];
if(Array.isArray(deletedFor) && deletedFor.includes(currentUser.uid)) return;
if(!notificationIsReadByMe(item)) count++;
});
updateNotificationBadge(count);
}

function listen(query){
let unsubscribe = query.onSnapshot(snapshot=>{
snapshot.docChanges().forEach(change=>{
if(change.type === "removed"){
items.delete(change.doc.id);
}else{
items.set(change.doc.id, {id:change.doc.id, ...change.doc.data()});
}
});
refresh();
}, error=>appLog("Notification badge listener skipped", error.message));
notificationBadgeUnsubscribes.push(unsubscribe);
}

listen(db.collection("notifications").where("forUserId","==",currentUser.uid));
listen(db.collection("notifications").where("userId","==",currentUser.uid));
listen(db.collection("notifications").where("forRole","==","customer"));
if(isAdmin){
listen(db.collection("notifications").where("forRole","==","admin"));
listen(db.collection("notifications").where("role","==","admin"));
}
}

function updateNotificationBadge(count){
document.querySelectorAll(".bell-btn").forEach(button=>{
let badge = button.querySelector(".notification-badge");
if(!badge){
badge = document.createElement("span");
badge.className = "notification-badge";
button.appendChild(badge);
}
badge.textContent = count > 99 ? "99+" : String(count);
badge.classList.toggle("hidden", count <= 0);
});
}

function showMobileNotificationPopup(title, body, data){
let existing = document.getElementById("mobileNotificationPopup");
if(existing) existing.remove();

let popup = document.createElement("button");
popup.type = "button";
popup.id = "mobileNotificationPopup";
popup.className = "mobile-notification-pop";
popup.innerHTML = `
<span class="mobile-notification-icon">!</span>
<span>
<b>${escapeHtml(title || "ATV Exchange")}</b>
<small>${escapeHtml(body || "You have a new update.")}</small>
</span>
`;

popup.onclick = ()=>{
popup.remove();
let collection = data && (data.collection || data.orderCollection);
let id = data && (data.recordId || data.orderId || data.id);
let link = data && data.link;
if(collection && id) return goToOrderDetail(collection, id);
if(link) return goToPage(link);
showNotifications();
};

document.body.appendChild(popup);
requestAnimationFrame(()=>popup.classList.add("show"));
setTimeout(()=>{
popup.classList.remove("show");
setTimeout(()=>popup.remove(), 260);
}, 7000);
}

function buildNotificationRecord(options){
let metadata = options.metadata || options.data || {};
let role = options.role || (options.userId ? "customer" : "admin");
let actionLink = options.actionLink || options.link || "";
return {
id: options.id || "",
userId: options.userId || "",
forUserId: options.userId || "",
role,
forRole: role === "admin" ? "admin" : "",
title: options.title || "ATV Exchange",
message: options.message || options.body || "",
type: options.type || "system",
priority: options.priority || "medium",
read: false,
createdAt: new Date().toLocaleString(),
createdAtMs: Date.now(),
actionLink,
link: actionLink,
senderId: options.senderId || (currentUser ? currentUser.uid : ""),
metadata,
data: metadata,
pushSent: false,
pushStatus: "pending"
};
}

async function createNotification(options){
let ref = db.collection("notifications").doc();
let record = buildNotificationRecord({...options, id:ref.id});
await ref.set(record);
return record;
}

async function updatePushResult(notificationId, result){
if(!notificationId) return;
await db.collection("notifications").doc(notificationId).set({
pushSent: Boolean(result && result.ok && result.successCount !== 0),
pushStatus: result && result.ok ? (result.status || "sent") : "failed",
pushResult: result || {},
pushTriedAt: new Date().toLocaleString()
},{merge:true}).catch(error=>appLog("Push status update skipped", error.message));
}

async function notifyUser(userId, type, title, message, link, data, priority){
if(!userId) return;
let record = await createNotification({
userId,
role:"customer",
type,
title,
message,
actionLink: link || "",
metadata: data || {},
priority: priority || "medium"
});
let result = await notifyBackendUser(userId, title, message, link, {...(data || {}), notificationId:record.id, type, priority:record.priority});
await updatePushResult(record.id, result);
return record;
}

async function notifyAdmin(type, title, message, link, data, priority){
let record = await createNotification({
role:"admin",
type,
title,
message,
actionLink: link || "",
metadata: data || {},
priority: priority || "high"
});
let result = await notifyBackendAdmins(title, message, link, {...(data || {}), notificationId:record.id, type, priority:record.priority});
await updatePushResult(record.id, result);
return record;
}

function amountLooksLarge(currency, amount){
let value = Number(amount || 0);
return (currency === "NGN" && value >= 1000000) || (currency === "GHS" && value >= 10000);
}

async function notifyLargeTransactionIfNeeded(currency, amount, link, data){
if(!amountLooksLarge(currency, amount)) return;
await notifyAdmin(
"large-transaction",
"Large transaction submitted",
(currentUser ? currentUser.email : "A customer")+" submitted "+currency+" "+format(amount)+".",
link,
data,
"high"
);
}

async function notifyFailedPaymentAttempt(reason, link, data){
await notifyAdmin(
"failed-payment",
"Failed payment attempt",
(currentUser ? currentUser.email : "A customer")+" had a failed payment/reference attempt: "+reason,
link || "dashboard.html",
data || {},
"high"
);
}

function simpleHash(value){
let hash = 0;
let text = String(value || "");
for(let i=0;i<text.length;i++){
hash = ((hash << 5) - hash) + text.charCodeAt(i);
hash |= 0;
}
return Math.abs(hash).toString(36);
}

async function trackLoginDevice(){
if(!currentUser) return;
try{
let deviceId = simpleHash((navigator.userAgent || "")+"|"+(navigator.platform || "")+"|"+(screen.width || "")+"x"+(screen.height || ""));
let key = "atvKnownDevice_"+currentUser.uid+"_"+deviceId;
if(localStorage.getItem(key)) return;
localStorage.setItem(key, "1");
await db.collection("users").doc(currentUser.uid).collection("devices").doc(deviceId).set({
deviceId,
userAgent:navigator.userAgent || "",
platform:navigator.platform || "",
screen:(screen.width || "")+"x"+(screen.height || ""),
lastLoginAt:new Date().toLocaleString()
},{merge:true});
await notifyUser(currentUser.uid, "security-login", "Security Alert", "Your ATV Exchange account was opened on a new device.", "profile.html", {deviceId}, "high");
await notifyAdmin("security-login", "User login from new device", (currentUser.email || "A customer")+" logged in from a new device.", "customers.html", {userId:currentUser.uid, deviceId}, "high");
}catch(error){
appLog("Login device tracking skipped", error.message);
}
}

async function getCurrentIdToken(){
if(!currentUser) throw new Error("Login first");
return currentUser.getIdToken();
}

function backendUrl(endpoint){
let base = (backendSettings.baseUrl || "").replace(/\/$/,"");
return base + endpoint;
}

async function callPushBackend(endpoint, payload){
if(!backendSettings.baseUrl) return {ok:false, skipped:true, message:"Push backend is not configured"};
try{
let idToken = await getCurrentIdToken();
let response = await fetch(backendUrl(endpoint), {
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":"Bearer "+idToken
},
body: JSON.stringify(payload || {})
});

let data = {};
try{
data = await response.json();
}catch(error){
data = {};
}

if(!response.ok){
let statusText = response.status ? "HTTP "+response.status : "";
throw new Error(data.message || ("Backend request failed "+statusText).trim());
}
return data;
}catch(error){
appLog("Push backend skipped", error.message);
let message = error.message || "Backend request failed";
if(message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("load failed") || message.toLowerCase().includes("networkerror")){
message = "Could not reach PythonAnywhere backend. Upload latest app.py, reload the PythonAnywhere Web app, and check CORS/domain settings.";
}
return {ok:false, error:message};
}
}

async function notifyBackendUser(userId, title, body, link, data){
if(!userId || !title || !body) return;
return callPushBackend("/send-notification", {
userId,
title,
body,
link: link || "exchange.html",
data: data || {}
});
}

async function notifyBackendAdmins(title, body, link, data){
if(!title || !body) return;
return callPushBackend("/send-admin-alert", {
title,
body,
link: link || "dashboard.html",
data: data || {}
});
}

async function sendNotificationBackend(userId, title, body, link, data){
return callPushBackend("/send-notification", {
userId,
title,
body,
link: link || "exchange.html",
data: data || {}
});
}

async function sendAdminAlertBackend(title, body, link, data){
return callPushBackend("/send-admin-alert", {
title,
body,
link: link || "dashboard.html",
data: data || {}
});
}

async function broadcastRateUpdate(title, body, link, data){
return callPushBackend("/broadcast-rate-update", {
title,
body,
link: link || "exchange.html",
data: data || {}
});
}

async function broadcastAnnouncement(title, body, link, data){
return callPushBackend("/broadcast-announcement", {
title,
body,
link: link || "exchange.html",
data: data || {}
});
}

async function sendBackendSelfTest(){
return callPushBackend("/send-self-test", {
title:"ATV Exchange Test",
body:"Your phone push notifications are working.",
link:"exchange.html",
data:{type:"test", priority:"high"}
});
}

function adminOrderNotification(collection, id, extra){
let link = orderDetailUrl(collection, id);
return {
collection,
recordId: id,
orderCollection: collection,
orderId: id,
link,
data: {
collection,
recordId: id,
orderCollection: collection,
orderId: id,
link,
...(extra || {})
}
};
}

function balancePreferenceKey(){
return currentUser ? "atvBalanceHidden_"+currentUser.uid : "atvBalanceHidden_guest";
}

function loadBalanceVisibilityPreference(){
balancesHidden = localStorage.getItem(balancePreferenceKey()) === "1";
}

function hiddenBalanceText(){
return "****";
}

function toggleBalance(){
balancesHidden = !balancesHidden;
localStorage.setItem(balancePreferenceKey(), balancesHidden ? "1" : "0");
updateBalanceVisibility();
}

function updateBalanceVisibility(){
["homeBalance","homeGhsBalance","homeNgnBalance"].forEach(id=>{
let el = document.getElementById(id);
if(!el) return;
if(!el.dataset.value) el.dataset.value = el.innerText;
el.innerText = balancesHidden ? hiddenBalanceText() : el.dataset.value;
});
renderActiveBalance();
}

async function getCustomerProfile(){
if(!currentUser) return null;

return ensureDefaultUserProfile();
}

function accountStatusValue(profile){
return String(profile && (profile.accountStatus || profile.status) || "active").trim().toLowerCase();
}

function isAccountBanned(profile){
let status = accountStatusValue(profile);
return status === "banned" || status === "ban";
}

function isAccountRestricted(profile){
let status = accountStatusValue(profile);
return status === "restricted" || status === "suspended";
}

function sensitiveActionMessage(){
return "Your account is restricted. You can view your dashboard, but this action is disabled. Please contact support.";
}

async function ensureAccountCanUseSensitiveAction(actionName){
currentProfile = currentProfile || await getCustomerProfile();
if(isAccountBanned(currentProfile)){
await auth.signOut();
alert("This account has been banned. Please contact support.");
window.location.replace("login.html");
return false;
}
if(isAccountRestricted(currentProfile)){
alert(sensitiveActionMessage());
return false;
}
return true;
}

async function guardSensitivePage(page){
let sensitivePages = ["withdraw.html","transfer.html","convert.html","wallet-convert.html","add-payment-method.html"];
if(!currentUser || !sensitivePages.includes(page)) return true;
let profile = await getCustomerProfile();
currentProfile = profile;
if(isAccountRestricted(profile)){
alert(sensitiveActionMessage());
window.location.replace("exchange.html");
return false;
}
if(isAccountBanned(profile)){
await auth.signOut();
alert("This account has been banned. Please contact support.");
window.location.replace("login.html");
return false;
}
return true;
}

function profileFullName(profile){
return [profile && profile.firstName, profile && profile.middleName, profile && (profile.lastName || profile.surname)]
.filter(Boolean)
.join(" ")
|| profile && profile.name
|| "";
}

function accountTierLabel(profile){
if(isCustomerKycApproved(profile)) return "Verified";
let label = profile && (profile.accountTierLabel || profile.tier) || "Basic";
return String(label).toLowerCase() === "tier 1" ? "Basic" : label;
}

function vipEligibleFromBalance(balance){
return Number(balance && balance.ghs || 0) > 20000 || Number(balance && balance.ngn || 0) > 2000000;
}

async function updateVipPrivilegeFromBalance(balance){
if(!currentUser) return;
let eligible = vipEligibleFromBalance(balance);
let profile = currentProfile || await getCustomerProfile();
let hasVip = profile && profile.vipLevel === "VIP1";
let autoDowngrade = profile && profile.vipAutoDowngrade === true;
if(eligible && !hasVip){
await db.collection("users").doc(currentUser.uid).set({
vipLevel: "VIP1",
vipSince: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
},{merge:true});
currentProfile = {...(profile || {}), vipLevel:"VIP1"};
updateTierBadges(currentProfile, balance);
}else if(!eligible && hasVip && autoDowngrade){
await db.collection("users").doc(currentUser.uid).set({
vipLevel: "",
vipRemovedAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
},{merge:true});
currentProfile = {...(profile || {}), vipLevel:""};
updateTierBadges(currentProfile, balance);
}
}

function updateTierBadges(profile, balance){
let tier = accountTierLabel(profile);
let vip = (profile && profile.vipLevel === "VIP1") || vipEligibleFromBalance(balance || liveBalances);
["homeTierBadge","profileTierBadge"].forEach(id=>{
let el = document.getElementById(id);
if(el) el.innerText = tier;
});
["homeVipBadge","profileVipBadge"].forEach(id=>{
let el = document.getElementById(id);
if(el) el.classList.toggle("hidden", !vip);
});
}

function isProfileComplete(profile){
return profile &&
((profile.firstName && profile.lastName) || profile.name) &&
profile.phone &&
profile.email &&
profile.country &&
profile.address;
}

function isKycSubmitted(profile){
if(isCustomerKycApproved(profile)) return true;
return profile &&
profile.idType &&
profile.idNumber &&
(profile.idVerificationUrl || profile.kycDocumentUrl) &&
profile.proofOfAddressUrl;
}

function isKycApproved(profile){
let status = normalizeKycStatus(profile);
return isAdmin || status === "approved" || profile && profile.kycApproved === true;
}

function isCustomerKycApproved(profile){
let status = normalizeKycStatus(profile);
return Boolean(profile && (status === "approved" || profile.kycApproved === true));
}

function isKycLocked(profile){
return Boolean(profile && (profile.kycLocked === true || isCustomerKycApproved(profile)));
}

function getKycStatus(profile){
if(!profile) return "Not submitted";
if(profile.kycApproved === true) return "Approved";
return profile.kycStatus || "Not submitted";
}

function normalizeKycStatus(profile){
return String(profile && profile.kycStatus ? profile.kycStatus : "")
.trim()
.toLowerCase();
}

function renderKycPageState(profile){
let approved = isCustomerKycApproved(profile);
let locked = isKycLocked(profile);
let status = getKycStatus(profile);
let rejected = normalizeKycStatus(profile) === "rejected";
let formWrap = document.getElementById("kycFormWrap");
let verifiedCard = document.getElementById("kycVerifiedCard");

if(formWrap) formWrap.classList.toggle("hidden", approved || (locked && !rejected));
if(verifiedCard) verifiedCard.classList.toggle("hidden", !(approved || (locked && !rejected)));
if((approved || (locked && !rejected)) && document.getElementById("kycVerifiedTitle")){
kycVerifiedTitle.innerText = approved ? "KYC Verified" : "Verification Locked";
}
if((approved || (locked && !rejected)) && document.getElementById("kycVerifiedMessage")){
kycVerifiedMessage.innerText = approved ? "Your identity verification is approved and locked. You do not need to submit KYC again." : "Your KYC status is "+status+". Contact support if you need help.";
}
if((approved || (locked && !rejected)) && document.getElementById("kycVerifiedMeta")){
let reviewedAt = profile.kycReviewedAt ? "Approved on "+profile.kycReviewedAt : "Approved permanently";
kycVerifiedMeta.innerText = approved ? reviewedAt : (profile.suspensionReason || profile.kycUnlockReason || "");
}
}

function loadCountryOptions(){
if(!document.getElementById("profileCountry")) return;

let html = '<option value="">Select Country</option>';

Object.keys(countryIdTypes).forEach(country=>{
html += `<option value="${country}">${country}</option>`;
});

profileCountry.innerHTML = html;
}

function updateIdTypes(selectedIdType, countryOverride){
let idTypeSelect = document.getElementById("idType");
if(!idTypeSelect) return;

let country = countryOverride || "Other";
let kycCountrySelect = document.getElementById("kycCountry");
let profileCountrySelect = document.getElementById("profileCountry");
if(kycCountrySelect && kycCountrySelect.value){
country = kycCountrySelect.value;
}else if(profileCountrySelect && profileCountrySelect.value){
country = profileCountrySelect.value;
}else if(currentProfile && currentProfile.country){
country = currentProfile.country;
}

let types = countryIdTypes[country] || countryIdTypes.Other || [
{value:"passport", label:"Passport"},
{value:"national-id", label:"National ID"},
{value:"drivers-license", label:"Driver's License"}
];

let html = '<option value="">Select ID Type</option>';

types.forEach(item=>{
html += `<option value="${item.value}">${item.label}</option>`;
});

idTypeSelect.innerHTML = html;

if(selectedIdType){
idTypeSelect.value = selectedIdType;
}
}

async function requireAdmin(callback){
if(!isAdmin){
alert("Admin only");
window.location.href = "exchange.html";
return;
}

return await callback();
}

function login(){
if(!email.value) return alert("Enter email");
if(!password.value) return alert("Enter password");

setLoading("loginBtn", true, "Logging in...");
auth.signInWithEmailAndPassword(email.value,password.value)
.then(async credential=>{
let userDoc = await db.collection("users").doc(credential.user.uid).get();
let profile = userDoc.exists ? userDoc.data() || {} : {};
if(isAccountBanned(profile)){
await auth.signOut();
throw new Error("This account has been banned. Please contact support.");
}
appLog("Login success; redirecting to dashboard");
window.location.replace("exchange.html");
})
.catch(error=>{
if(document.getElementById("loginStatus")){
loginStatus.innerText = error.message;
}else{
alert(error.message);
}
setLoading("loginBtn", false);
});
}

async function forgotPassword(){
let emailInput = document.getElementById("email");
let emailAddress = emailInput ? emailInput.value.trim() : "";
if(!emailAddress){
emailAddress = prompt("Enter your account email address:");
if(!emailAddress) return;
emailAddress = emailAddress.trim();
}

try{
await auth.sendPasswordResetEmail(emailAddress);
let message = "Password reset link sent to "+emailAddress+". Check your inbox or spam folder.";
if(document.getElementById("loginStatus")) loginStatus.innerText = message;
alert(message);
}catch(error){
let message = "Could not send password reset email: "+error.message;
if(document.getElementById("loginStatus")) loginStatus.innerText = message;
alert(message);
}
}

function register(){
let firstName = regFirstName.value.trim();
let middleName = regMiddleName.value.trim();
let lastName = regLastName.value.trim();
let emailAddress = regEmail.value.trim();
let phone = regPhone.value.trim();
let passwordValue = regPassword.value;
let verifyPasswordValue = regVerifyPassword.value;

if(!firstName) return alert("Enter first name");
if(!lastName) return alert("Enter last/surname");
if(!emailAddress) return alert("Enter email address");
if(!phone) return alert("Enter phone number");
if(!passwordValue) return alert("Enter password");
if(passwordValue !== verifyPasswordValue) return alert("Password and verify password must match");

setLoading("registerBtn", true, "Creating...");
let fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
let defaultUsername = emailAddress.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);

auth.createUserWithEmailAndPassword(emailAddress,passwordValue)
.then(async credential=>{
let userData = {
userId: credential.user.uid,
firstName,
middleName,
lastName,
surname: lastName,
name: fullName,
fullName,
username: defaultUsername,
email: emailAddress,
phone,
country: "",
tier: "Basic",
accountTier: 1,
accountTierLabel: "Basic",
accountStatus: "active",
kycStatus: "Not submitted",
kycApproved: false,
kycLocked: false,
createdAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
};

let transferUid = await createInitialCustomerRecords(credential.user, userData);
currentUser = credential.user;
await notifyUser(credential.user.uid, "welcome", "Welcome to ATV Exchange", "Your Tier 1 account has been created successfully. Your ATV UID is "+transferUid+".", "exchange.html", {userId:credential.user.uid, transferUid}, "medium");
await notifyAdmin("new-user", "New customer registered", fullName+" created a new ATV Exchange account.", "customers.html", {userId:credential.user.uid, email:emailAddress}, "high");
window.location.replace("exchange.html");
})
.catch(error=>{
if(document.getElementById("loginStatus")){
loginStatus.innerText = error.message;
}else{
alert(error.message);
}
setLoading("registerBtn", false);
});
}

function logout(){
auth.signOut().then(()=>{
window.location.href = "login.html";
});
}

function format(num){
return Number(num).toLocaleString(undefined,{
minimumFractionDigits:2,
maximumFractionDigits:2
});
}

function cleanMoneyString(value){
let text = String(value || "").replace(/,/g, "").replace(/[^\d.]/g, "");
let parts = text.split(".");
let whole = parts.shift() || "";
let decimal = parts.length ? parts.join("") : "";
whole = whole.replace(/^0+(?=\d)/, "");
decimal = decimal.slice(0, 2);
return decimal || text.includes(".") ? whole+"."+decimal : whole;
}

function moneyInputValue(inputOrId){
let input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
if(!input) return 0;
let raw = input.dataset && input.dataset.rawValue ? input.dataset.rawValue : cleanMoneyString(input.value);
let value = Number(raw);
return Number.isFinite(value) ? value : 0;
}

function formatMoneyDisplay(raw, forceDecimals){
let clean = cleanMoneyString(raw);
if(clean === "." || clean === "") return "";
let hasDecimal = clean.includes(".");
let parts = clean.split(".");
let whole = parts[0] || "0";
let decimal = parts[1] || "";
let wholeFormatted = Number(whole || 0).toLocaleString();
if(forceDecimals) return wholeFormatted+"."+decimal.padEnd(2, "0").slice(0, 2);
if(hasDecimal) return wholeFormatted+"."+decimal;
return wholeFormatted;
}

function formatAmountInput(input, callbackName){
if(!input) return;
let clean = cleanMoneyString(input.value);
input.dataset.rawValue = clean;
input.value = formatMoneyDisplay(clean, false);
if(callbackName && typeof window[callbackName] === "function") window[callbackName]();
}

function finalizeAmountInput(input, callbackName){
if(!input) return;
let clean = cleanMoneyString(input.value);
input.dataset.rawValue = clean;
input.value = formatMoneyDisplay(clean, true);
if(callbackName && typeof window[callbackName] === "function") window[callbackName]();
}

function setupMoneyInputs(){
[
["depositAmount","updateDepositAmountPreview"],
["withdrawAmount","updateWithdrawPreview"],
["amount","updateResult"],
["walletConvertAmount","updateWalletConvertPreview"],
["transferAmount",""]
].forEach(([id, callback])=>{
let input = document.getElementById(id);
if(!input || input.dataset.moneyFormatterReady === "true") return;
input.dataset.moneyFormatterReady = "true";
input.setAttribute("inputmode", "decimal");
input.setAttribute("autocomplete", "off");
if(!input.getAttribute("oninput")){
input.addEventListener("input", ()=>formatAmountInput(input, callback));
}
input.addEventListener("blur", ()=>finalizeAmountInput(input, callback));
});
}

function formatRate(num){
return Number(num || 0).toLocaleString(undefined,{
minimumFractionDigits:3,
maximumFractionDigits:6
});
}

function formatPercent(num){
return Number(num || 0).toLocaleString(undefined,{
minimumFractionDigits:2,
maximumFractionDigits:2
})+"%";
}

function positiveNumber(value){
let number = Number(value || 0);
return number > 0 ? number : 0;
}

function normalizeWalletStatus(status){
let value = String(status || "Pending").toLowerCase();
if(value === "paid") return "Paid";
if(value === "successful" || value === "success" || value === "completed") return "Successful";
if(value === "processing") return "Processing";
if(value === "failed" || value === "failure") return "Failed";
return "Pending";
}

function walletStatusClass(status){
let normalized = normalizeWalletStatus(status);
if(normalized === "Successful" || normalized === "Paid") return "completed";
if(normalized === "Failed") return "paid";
if(normalized === "Processing") return "paid";
return "pending";
}

function depositStatusLabel(status){
let value = String(status || "pending").toLowerCase();
if(value === "created") return "Created";
if(value === "payment submitted") return "Payment Submitted";
if(value === "verification") return "Deposit Verification";
if(value === "processing") return "Deposit Processing";
if(value === "credited") return "Credited";
if(value === "approved") return "Approved";
if(value === "rejected") return "Rejected";
return "Pending";
}

function depositStatusClass(status){
let value = String(status || "pending").toLowerCase();
if(value === "credited" || value === "approved") return "completed";
if(value === "rejected") return "paid";
return "pending";
}

function normalizeDepositTransactionId(value){
return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function depositDocId(transactionId){
return "MTN-"+normalizeDepositTransactionId(transactionId);
}

function paymentReferenceDocId(referenceValue){
return normalizeDepositTransactionId(referenceValue);
}

function duplicateReferenceMessage(){
return "This transaction ID/reference has already been used. Please submit a unique payment reference.";
}

function cleanPhone(value){
return String(value || "").replace(/\D/g, "");
}

function generateTransferUid(){
let length = Math.random() < 0.5 ? 9 : 10;
let first = String(Math.floor(Math.random() * 9) + 1);
let rest = "";
if(window.crypto && window.crypto.getRandomValues){
let bytes = new Uint8Array(length - 1);
window.crypto.getRandomValues(bytes);
rest = Array.from(bytes).map(byte => String(byte % 10)).join("");
}else{
for(let i = 1; i < length; i++) rest += String(Math.floor(Math.random() * 10));
}
return first + rest;
}

async function ensureCustomerTransferUid(userId, profileData){
if(!userId) return "";
let existing = String((profileData && (profileData.transferUid || profileData.atvUid)) || "").trim();
let publicRef = db.collection("publicUsers").doc(userId);
if(/^[0-9]{9,10}$/.test(existing)){
let nameValue = profileData && profileData.name || currentUser && currentUser.email || "";
let fullNameValue = profileFullName(profileData || {}) || nameValue;
let usernameValue = String(profileData && profileData.username || "").trim().toLowerCase();
let emailValue = profileData && profileData.email || currentUser && currentUser.email || "";
let updates = [
publicRef.set({
userId,
transferUid:existing,
transferUidLower:existing,
name: fullNameValue,
fullName: fullNameValue,
nameLower: String(fullNameValue || "").toLowerCase(),
username: usernameValue,
usernameLower: usernameValue,
email: emailValue,
emailLower: String(emailValue || "").toLowerCase(),
updatedAt:new Date().toLocaleString()
},{merge:true})
];
let uidRef = db.collection("transferUIDs").doc(existing);
let uidDoc = await uidRef.get();
if(!uidDoc.exists){
updates.push(uidRef.set({
uid: existing,
userId,
name: nameValue,
nameLower: String(nameValue || "").toLowerCase(),
email: emailValue,
emailLower: String(emailValue || "").toLowerCase(),
repairedAt: new Date().toLocaleString()
}));
}
await Promise.all(updates);
return existing;
}

for(let attempt = 0; attempt < 25; attempt++){
let transferUid = generateTransferUid();
let userRef = db.collection("users").doc(userId);
let uidRef = db.collection("transferUIDs").doc(transferUid);
try{
return await db.runTransaction(async transaction=>{
let userDoc = await transaction.get(userRef);
let currentData = userDoc.exists ? userDoc.data() || {} : {};
let currentUid = String(currentData.transferUid || currentData.atvUid || "").trim();
if(/^[0-9]{9,10}$/.test(currentUid)) return currentUid;
let uidDoc = await transaction.get(uidRef);
if(uidDoc.exists) throw new Error("TRANSFER_UID_COLLISION");

let nameValue = currentData.name || profileData && profileData.name || currentUser && currentUser.email || "";
let fullNameValue = profileFullName(currentData) || profileFullName(profileData || {}) || nameValue;
let usernameValue = String(currentData.username || profileData && profileData.username || "").trim().toLowerCase();
let emailValue = currentData.email || profileData && profileData.email || currentUser && currentUser.email || "";
transaction.set(uidRef, {
uid: transferUid,
userId,
name: fullNameValue,
fullName: fullNameValue,
nameLower: String(fullNameValue || "").toLowerCase(),
username: usernameValue,
usernameLower: usernameValue,
email: emailValue,
emailLower: String(emailValue || "").toLowerCase(),
createdAt: new Date().toLocaleString()
});
transaction.set(userRef, {
transferUid,
atvUid: transferUid,
transferUidLocked: true,
updatedAt: new Date().toLocaleString()
},{merge:true});
transaction.set(publicRef, {
userId,
transferUid,
transferUidLower: transferUid,
name: fullNameValue,
fullName: fullNameValue,
nameLower: String(fullNameValue || "").toLowerCase(),
username: usernameValue,
usernameLower: usernameValue,
email: emailValue,
emailLower: String(emailValue || "").toLowerCase(),
updatedAt: new Date().toLocaleString()
},{merge:true});
return transferUid;
});
}catch(error){
if(String(error.message || "").includes("TRANSFER_UID_COLLISION")) continue;
throw error;
}
}
throw new Error("Could not generate a unique ATV UID. Please try again.");
}

async function createInitialCustomerRecords(user, userData){
for(let attempt = 0; attempt < 25; attempt++){
let transferUid = generateTransferUid();
try{
await db.runTransaction(async transaction=>{
let uidRef = db.collection("transferUIDs").doc(transferUid);
let uidDoc = await transaction.get(uidRef);
if(uidDoc.exists) throw new Error("TRANSFER_UID_COLLISION");
transaction.set(uidRef, {
uid: transferUid,
userId: user.uid,
name: userData.name || "",
fullName: userData.fullName || userData.name || "",
nameLower: String(userData.name || "").toLowerCase(),
username: userData.username || "",
usernameLower: String(userData.username || "").toLowerCase(),
email: userData.email || "",
emailLower: String(userData.email || "").toLowerCase(),
createdAt: new Date().toLocaleString()
});
transaction.set(db.collection("users").doc(user.uid), {
...userData,
transferUid,
atvUid: transferUid,
transferUidLocked: true
},{merge:true});
transaction.set(db.collection("publicUsers").doc(user.uid), {
userId: user.uid,
transferUid,
transferUidLower: transferUid,
name: userData.name || "",
fullName: userData.fullName || userData.name || "",
nameLower: String(userData.name || "").toLowerCase(),
username: userData.username || "",
usernameLower: String(userData.username || "").toLowerCase(),
email: userData.email || "",
emailLower: String(userData.email || "").toLowerCase(),
phone: userData.phone || "",
phoneClean: cleanPhone(userData.phone || ""),
updatedAt: new Date().toLocaleString()
},{merge:true});
});
return transferUid;
}catch(error){
if(String(error.message || "").includes("TRANSFER_UID_COLLISION")) continue;
throw error;
}
}
throw new Error("Could not create a unique ATV UID. Please try again.");
}

async function adminEnsureTransferUidForCustomer(userId, data){
let existing = String((data && (data.transferUid || data.atvUid)) || "").trim();
if(/^[0-9]{9,10}$/.test(existing)) return existing;
if(!isAdmin) return "";
for(let attempt = 0; attempt < 25; attempt++){
let transferUid = generateTransferUid();
try{
await db.runTransaction(async transaction=>{
let uidRef = db.collection("transferUIDs").doc(transferUid);
let uidDoc = await transaction.get(uidRef);
if(uidDoc.exists) throw new Error("TRANSFER_UID_COLLISION");
let nameValue = data.name || [data.firstName, data.middleName, data.lastName || data.surname].filter(Boolean).join(" ") || "";
let usernameValue = String(data.username || "").trim().toLowerCase();
let emailValue = data.email || "";
transaction.set(uidRef, {
uid: transferUid,
userId,
name: nameValue,
fullName: nameValue,
nameLower: String(nameValue || "").toLowerCase(),
username: usernameValue,
usernameLower: usernameValue,
email: emailValue,
emailLower: String(emailValue || "").toLowerCase(),
createdAt: new Date().toLocaleString(),
createdBy: currentUser.uid
});
transaction.set(db.collection("users").doc(userId), {
transferUid,
atvUid: transferUid,
transferUidLocked: true,
updatedAt: new Date().toLocaleString()
},{merge:true});
transaction.set(db.collection("publicUsers").doc(userId), {
userId,
transferUid,
transferUidLower: transferUid,
name: nameValue,
fullName: nameValue,
nameLower: String(nameValue || "").toLowerCase(),
username: usernameValue,
usernameLower: usernameValue,
email: emailValue,
emailLower: String(emailValue || "").toLowerCase(),
phone: data.phone || "",
phoneClean: cleanPhone(data.phone || ""),
updatedAt: new Date().toLocaleString()
},{merge:true});
});
return transferUid;
}catch(error){
if(String(error.message || "").includes("TRANSFER_UID_COLLISION")) continue;
throw error;
}
}
return "";
}

function getDepositPaymentDetails(currency){
if(currency === "NGN"){
return {
network: "OPay Microfinance Bank",
accountNumber: "6141832148",
businessName: "AUSTIN TRADE VINTAGE",
accountHolderName: "AUSTIN TRADE VINTAGE"
};
}

return {
network: "MTN Mobile Money",
accountNumber: "0555736233",
businessName: "God Of Jecob",
accountHolderName: "JECOB ANDOR ITORKUSU"
};
}

function updateDepositPaymentInstructions(){
if(!document.getElementById("depositPaymentInstructions")) return;

let currency = depositCurrency.value;
let details = getDepositPaymentDetails(currency);

if(currency === "NGN"){
depositPaymentInstructions.innerHTML = `
<b>NGN Bank Deposit Instructions</b>
<p>Send payment to OPay account:</p>
<h2>${details.accountNumber}</h2>
<p><b>Bank:</b> ${details.network}</p>
<p><b>Account Name:</b> ${details.accountHolderName}</p>
`;
return;
}

depositPaymentInstructions.innerHTML = `
<b>GHS MoMo Deposit Instructions</b>
<p>Send payment to MTN MoMo number:</p>
<h2>${details.accountNumber}</h2>
<p><b>Business Name:</b> ${details.businessName}</p>
<p><b>Account Holder:</b> ${details.accountHolderName}</p>
`;
}

function setLoading(buttonId, isLoading, loadingText){
let btn = document.getElementById(buttonId);
if(!btn) return;
if(!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;
btn.disabled = isLoading;
btn.classList.toggle("loading", isLoading);
btn.innerText = isLoading ? loadingText : btn.dataset.originalText;
}

function showToast(message){
let toast = document.getElementById("appToast");
if(!toast){
toast = document.createElement("div");
toast.id = "appToast";
toast.className = "toast";
document.body.appendChild(toast);
}
toast.innerText = message;
toast.classList.add("show");
setTimeout(()=>toast.classList.remove("show"), 2600);
}

function createRequestId(prefix){
return prefix+"-"+currentUser.uid+"-"+Date.now();
}

async function getCustomerBalance(userId){
let doc = await db.collection("balances").doc(userId).get();
if(!doc.exists) return {ghs:0, ngn:0};
let data = doc.data();
return {
ghs:Number(data.ghs || 0),
ngn:Number(data.ngn || 0)
};
}

async function hasEnoughBalance(userId, currency, amountValue){
let balance = await getCustomerBalance(userId);
let field = currency === "NGN" ? "ngn" : "ghs";
return Number(balance[field] || 0) >= amountValue;
}

async function loadRateSettings(){
let doc = await withTimeout(db.collection("settings").doc("rates").get(), 2500, null, "rate settings");

if(doc && doc.exists){
rateSettings = {...defaultRateSettings, ...doc.data()};
}else{
rateSettings = {...defaultRateSettings};
}

momoSettings.requestToPayEndpoint = rateSettings.momoEndpoint || "";
return rateSettings;
}

async function loadHomePage(){
appLog("Loading home page");
await loadRateSettings();
await hydratePushStatusFromFirestore();

if(document.getElementById("homeRateText")){
homeRateText.innerText = format(rateSettings.rateCedis)+" / "+format(rateSettings.rateNaira);
}

let profile = await withTimeout(getCustomerProfile(), 3000, null, "home profile");
currentProfile = profile || currentProfile;

if(profile && document.getElementById("homeCustomerName")){
homeCustomerName.innerText = profileFullName(profile) || profile.username || currentUser.email;
homeKycBadge.innerText = isKycApproved(profile) ? "Verified Account" : "KYC "+(profile.kycStatus || "Pending");
homeKycBadge.className = isKycApproved(profile) ? "badge completed" : "badge pending";
updateTierBadges(profile, liveBalances);
}else if(document.getElementById("homeCustomerName")){
homeCustomerName.innerText = currentUser.email || "Customer";
homeKycBadge.innerText = "Complete Profile/KYC";
}

try{
loadHomeRecentTransactions();
}catch(error){
appLog("Recent transactions failed", error.message);
if(document.getElementById("homeRecentTransactions")) homeRecentTransactions.innerHTML = "No recent transactions yet";
}
}

async function loadConvertPage(){
await loadRateSettings();
if(document.getElementById("homeRateText")){
homeRateText.innerText = "GHS -> NGN "+format(rateSettings.rateCedis)+" | NGN -> GHS "+format(rateSettings.rateNaira);
}
showConvertStep(1);
if(document.getElementById("type") && document.getElementById("amount")){
updateResult();
}
}

function showConvertStep(step){
if(document.getElementById("convertStep1")) convertStep1.classList.toggle("hidden", step !== 1);
if(document.getElementById("convertStep2")) convertStep2.classList.toggle("hidden", step !== 2);
if(document.getElementById("convertStepCount")) convertStepCount.innerText = "Step "+step+" of 6";
if(document.getElementById("convertStepTitle")) convertStepTitle.innerText = step === 1 ? "Currency Selection" : "Amount Entry";
if(document.getElementById("convertTrack1")) convertTrack1.classList.toggle("active", step >= 1);
if(document.getElementById("convertTrack2")) convertTrack2.classList.toggle("active", step >= 2);
}

function goToConvertAmountStep(){
if(!document.getElementById("type") || !type.value) return alert("Select currency direction");
showConvertStep(2);
setTimeout(()=>{
if(document.getElementById("amount")) amount.focus();
}, 120);
}

function loadHomeRecentTransactions(){
if(!document.getElementById("homeRecentTransactions")) return;

loadLiveBalance();

getUnifiedHistory().then(rows=>{
let pendingRows = rows.filter(item=>{
let status = String(item.status || "").toLowerCase();
return status.includes("pending") || status.includes("created") || status.includes("awaiting") || status.includes("processing") || status.includes("submitted");
});
if(document.getElementById("homePendingOrders")){
let pendingTotal = pendingRows.reduce((sum,item)=>sum + Number(item.amount || 0), 0);
homePendingOrders.innerHTML = pendingRows.length
? `You have ${pendingRows.length} pending order${pendingRows.length === 1 ? "" : "s"}<br><span>Total value: ${format(pendingTotal)}</span>`
: "No pending orders right now.";
}

rows = rows.slice(0, 5);

if(rows.length === 0){
homeRecentTransactions.innerHTML = "No recent transactions yet";
return;
}

let html = "";

rows.forEach(item=>{
html += `
<div class="mini-row">
<div>
<b>${historyTitle(item)}</b>
<span>${historyDate(item)}</span>
</div>
<b>${historyAmount(item)}</b>
<span class="badge ${historyStatusClass(item.status)}">${historyStatusLabel(item.status)}</span>
</div>
`;
});

homeRecentTransactions.innerHTML = html;
}).catch(error=>{
homeRecentTransactions.innerHTML = "Could not load recent transactions: "+error.message;
});
}

function loadLiveBalance(){
if(!document.getElementById("homeBalance")) return;

db.collection("balances").doc(currentUser.uid)
.onSnapshot(doc=>{
if(!doc.exists){
setHomeBalances(0,0);
return;
}

let data = doc.data();
setHomeBalances(Number(data.ghs || 0), Number(data.ngn || 0));
},error=>{
setHomeBalances(0,0);
});
}

function setHomeBalances(ghsBalance, ngnBalance){
liveBalances = {ghs:ghsBalance, ngn:ngnBalance};
updateVipPrivilegeFromBalance(liveBalances).catch(error=>appLog("VIP update skipped", error.message));
updateTierBadges(currentProfile, liveBalances);
let ghsText = "GHS "+format(ghsBalance);
let ngnText = "\u20A6"+format(ngnBalance);

if(document.getElementById("homeGhsBalance")){
homeGhsBalance.dataset.value = ghsText;
homeGhsBalance.innerText = balancesHidden ? hiddenBalanceText() : ghsText;
}

if(document.getElementById("homeNgnBalance")){
homeNgnBalance.dataset.value = ngnText;
homeNgnBalance.innerText = balancesHidden ? hiddenBalanceText() : ngnText;
}

renderActiveBalance();
}

function switchBalanceCurrency(currency){
activeBalanceCurrency = currency === "NGN" ? "NGN" : "GHS";
renderActiveBalance();
}

function renderActiveBalance(){
if(!document.getElementById("homeBalance")) return;

let mainText = "";

if(activeBalanceCurrency === "NGN"){
mainText = "\u20A6"+format(liveBalances.ngn);
if(document.getElementById("balanceCardLabel")) balanceCardLabel.innerText = "NGN Available Balance";
if(document.getElementById("ghsBalanceBox")) ghsBalanceBox.classList.add("hidden");
if(document.getElementById("ngnBalanceBox")) ngnBalanceBox.classList.remove("hidden");
}else{
mainText = "GHS "+format(liveBalances.ghs);
if(document.getElementById("balanceCardLabel")) balanceCardLabel.innerText = "GHS Available Balance";
if(document.getElementById("ghsBalanceBox")) ghsBalanceBox.classList.remove("hidden");
if(document.getElementById("ngnBalanceBox")) ngnBalanceBox.classList.add("hidden");
}

homeBalance.dataset.value = mainText;
homeBalance.innerText = balancesHidden ? hiddenBalanceText() : mainText;
if(document.getElementById("balanceToggleBtn")){
balanceToggleBtn.innerHTML = "&#128065;";
balanceToggleBtn.setAttribute("aria-label", balancesHidden ? "Reveal balance" : "Hide balance");
balanceToggleBtn.setAttribute("title", balancesHidden ? "Reveal balance" : "Hide balance");
balanceToggleBtn.classList.toggle("is-hidden", balancesHidden);
}
if(document.getElementById("ghsBalanceTab")) ghsBalanceTab.classList.toggle("active", activeBalanceCurrency === "GHS");
if(document.getElementById("ngnBalanceTab")) ngnBalanceTab.classList.toggle("active", activeBalanceCurrency === "NGN");
}

let walletConvertState = {
direction: "GHS_TO_NGN",
balances: {ghs:0, ngn:0},
preview: null
};

async function loadWalletConvertPage(){
await loadRateSettings();
showWalletConvertStep(1);
db.collection("balances").doc(currentUser.uid).onSnapshot(doc=>{
let data = doc.exists ? doc.data() : {};
walletConvertState.balances = {
ghs:Number(data.ghs || 0),
ngn:Number(data.ngn || 0)
};
updateWalletConvertPreview();
},error=>{
if(document.getElementById("walletConvertBalanceBox")) walletConvertBalanceBox.innerText = "Could not load balance: "+error.message;
});
}

function showWalletConvertStep(step){
["walletConvertStep1","walletConvertStep2","walletConvertStep3","walletConvertStep4","walletConvertStep5"].forEach(id=>{
let el = document.getElementById(id);
if(el) el.classList.toggle("hidden", id !== "walletConvertStep"+step);
});
let titles = {
1:"Select Conversion Direction",
2:"Enter Conversion Amount",
3:"Conversion Summary",
4:"Processing",
5:"Completed"
};
if(document.getElementById("walletConvertStepCount")) walletConvertStepCount.innerText = "Step "+step+" of 5";
if(document.getElementById("walletConvertStepTitle")) walletConvertStepTitle.innerText = titles[step] || "";
for(let i = 1; i <= 5; i++){
let track = document.getElementById("walletConvertTrack"+i);
if(track) track.classList.toggle("active", i <= step);
}
if(step === 2) updateWalletConvertPreview();
}

function selectWalletConvertDirection(direction){
walletConvertState.direction = direction === "NGN_TO_GHS" ? "NGN_TO_GHS" : "GHS_TO_NGN";
if(document.getElementById("walletGhsToNgnBtn")) walletGhsToNgnBtn.classList.toggle("active", walletConvertState.direction === "GHS_TO_NGN");
if(document.getElementById("walletNgnToGhsBtn")) walletNgnToGhsBtn.classList.toggle("active", walletConvertState.direction === "NGN_TO_GHS");
updateWalletConvertPreview();
}

function getWalletConvertPreview(){
let direction = walletConvertState.direction;
let amountValue = moneyInputValue("walletConvertAmount");
let sourceCurrency = direction === "GHS_TO_NGN" ? "GHS" : "NGN";
let destinationCurrency = direction === "GHS_TO_NGN" ? "NGN" : "GHS";
let sourceField = direction === "GHS_TO_NGN" ? "ghs" : "ngn";
let destinationField = direction === "GHS_TO_NGN" ? "ngn" : "ghs";
let available = Number(walletConvertState.balances[sourceField] || 0);
let rate = direction === "GHS_TO_NGN" ? Number(rateSettings.rateCedis || 0) : Number(rateSettings.rateNaira || 0);
let received = direction === "GHS_TO_NGN" ? amountValue * rate : (rate ? amountValue / rate : 0);
let marketRate = direction === "GHS_TO_NGN" ? Number(rateSettings.costRateCedisToNaira || rate) : Number(rateSettings.costRateNairaToCedis || rate);
let spread = marketRate - rate;
let profitMade = amountValue * spread;

return {
direction,
amountValue,
sourceCurrency,
destinationCurrency,
sourceField,
destinationField,
available,
rate,
received,
marketRate,
spread,
profitMade,
previousGhs: Number(walletConvertState.balances.ghs || 0),
previousNgn: Number(walletConvertState.balances.ngn || 0)
};
}

function updateWalletConvertPreview(){
if(!document.getElementById("walletConvertPreview")) return;
let preview = getWalletConvertPreview();
walletConvertState.preview = preview;
let afterSource = preview.available - preview.amountValue;
let destinationBefore = Number(walletConvertState.balances[preview.destinationField] || 0);
let afterDestination = destinationBefore + preview.received;

if(document.getElementById("walletConvertBalanceBox")){
walletConvertBalanceBox.innerHTML = `
<div class="flow-summary-grid">
<div><span>Available GHS</span><b>GHS ${format(walletConvertState.balances.ghs)}</b></div>
<div><span>Available NGN</span><b>NGN ${format(walletConvertState.balances.ngn)}</b></div>
<div><span>Rate</span><b>${formatRate(preview.rate)}</b></div>
</div>
`;
}

walletConvertPreview.innerHTML = `
<div><b>Available balance:</b> ${preview.sourceCurrency} ${format(preview.available)}</div>
<div><b>You convert:</b> ${preview.sourceCurrency} ${format(preview.amountValue || 0)}</div>
<div><b>You receive:</b> ${preview.destinationCurrency} ${format(preview.received || 0)}</div>
<div><b>Rate used:</b> ${formatRate(preview.rate)}</div>
<div><b>Charges/spread:</b> ${formatRate(preview.spread)}</div>
<div><b>After conversion:</b> ${preview.sourceCurrency} ${format(afterSource || 0)} | ${preview.destinationCurrency} ${format(afterDestination || 0)}</div>
`;
}

function goToWalletConvertSummary(){
let preview = getWalletConvertPreview();
if(!preview.amountValue || preview.amountValue <= 0) return alert("Enter amount to convert");
if(preview.amountValue > preview.available) return alert("Amount is higher than available "+preview.sourceCurrency+" balance");
if(!preview.rate) return alert("Exchange rate is not available");

let newGhs = preview.direction === "GHS_TO_NGN" ? preview.previousGhs - preview.amountValue : preview.previousGhs + preview.received;
let newNgn = preview.direction === "GHS_TO_NGN" ? preview.previousNgn + preview.received : preview.previousNgn - preview.amountValue;

walletConvertSummary.innerHTML = `
<div class="flow-summary-grid">
<div><span>Balance Before</span><b>GHS ${format(preview.previousGhs)}<br>NGN ${format(preview.previousNgn)}</b></div>
<div><span>Converting</span><b>${preview.sourceCurrency} ${format(preview.amountValue)}</b></div>
<div><span>Rate Used</span><b>${formatRate(preview.rate)}</b></div>
<div><span>Receiving</span><b>${preview.destinationCurrency} ${format(preview.received)}</b></div>
<div><span>Balance After</span><b>GHS ${format(newGhs)}<br>NGN ${format(newNgn)}</b></div>
</div>
`;
showWalletConvertStep(3);
}

async function confirmWalletConversion(){
if(walletActionBusy) return;
if(!(await ensureAccountCanUseSensitiveAction("wallet conversion"))) return;
let preview = getWalletConvertPreview();
if(!preview.amountValue || preview.amountValue <= 0) return alert("Enter amount to convert");
if(preview.amountValue > preview.available) return alert("Insufficient balance");

walletActionBusy = true;
showWalletConvertStep(4);
let conversionId = "WCV-"+Date.now();
let balanceRef = db.collection("balances").doc(currentUser.uid);
let conversionRef = db.collection("walletConversions").doc(conversionId);
let txRef = db.collection("transactions").doc(conversionId);

try{
await db.runTransaction(async transaction=>{
let balanceDoc = await transaction.get(balanceRef);
let balance = balanceDoc.exists ? balanceDoc.data() : {};
let previousGhs = Number(balance.ghs || 0);
let previousNgn = Number(balance.ngn || 0);
let sourceBalance = preview.sourceField === "ghs" ? previousGhs : previousNgn;
if(sourceBalance < preview.amountValue) throw new Error("Insufficient balance");

let newGhs = preview.direction === "GHS_TO_NGN" ? previousGhs - preview.amountValue : previousGhs + preview.received;
let newNgn = preview.direction === "GHS_TO_NGN" ? previousNgn + preview.received : previousNgn - preview.amountValue;
let now = new Date().toLocaleString();
let log = {
conversionId,
customerId: currentUser.uid,
customerEmail: currentUser.email || "",
direction: preview.direction,
type: "wallet-conversion",
sourceCurrency: preview.sourceCurrency,
destinationCurrency: preview.destinationCurrency,
amount: preview.amountValue,
converted: preview.received,
rateUsed: preview.rate,
marketRate: preview.marketRate,
spread: preview.spread,
profitMade: preview.profitMade,
previousBalances: {ghs: previousGhs, ngn: previousNgn},
newBalances: {ghs: newGhs, ngn: newNgn},
status: "Completed",
createdAt: now,
completedAt: now,
date: now
};

transaction.set(balanceRef, {
ghs: newGhs,
ngn: newNgn,
updatedAt: now
},{merge:true});
transaction.set(conversionRef, log);
transaction.set(txRef, {
...log,
orderID: conversionId,
paymentProvider: "Internal Wallet",
paymentReference: conversionId
});
});

let receiptDoc = await conversionRef.get();
renderWalletConvertReceipt(receiptDoc.exists ? receiptDoc.data() : {conversionId});
showWalletConvertStep(5);
showToast("Conversion successful");
openTransactionSuccess({
title: "Swap Successful",
message: "Your wallet balance swap has been completed instantly.",
type: "Wallet Swap",
reference: conversionId,
amount: preview.sourceCurrency+" "+format(preview.amountValue)+" -> "+preview.destinationCurrency+" "+format(preview.received),
status: "Completed",
orderCollection: "walletConversions",
orderId: conversionId,
details: [
{label:"Rate Used", value:formatRate(preview.rate)},
{label:"From Wallet", value:preview.sourceCurrency},
{label:"To Wallet", value:preview.destinationCurrency}
]
});
}catch(error){
await conversionRef.set({
conversionId,
customerId: currentUser.uid,
customerEmail: currentUser.email || "",
direction: preview.direction,
type: "wallet-conversion",
sourceCurrency: preview.sourceCurrency,
destinationCurrency: preview.destinationCurrency,
amount: preview.amountValue,
converted: preview.received,
rateUsed: preview.rate,
marketRate: preview.marketRate,
spread: preview.spread,
profitMade: 0,
status: "Failed",
failureReason: error.message,
createdAt: new Date().toLocaleString()
},{merge:true});
alert("Conversion failed: "+error.message);
showWalletConvertStep(2);
}finally{
walletActionBusy = false;
}
}

function renderWalletConvertReceipt(item){
if(!document.getElementById("walletConvertReceipt")) return;
walletConvertReceipt.innerHTML = `
<div class="flow-summary-grid">
<div><span>Reference</span><b>${item.conversionId || ""}</b></div>
<div><span>Converted</span><b>${item.sourceCurrency || ""} ${format(item.amount || 0)}</b></div>
<div><span>Received</span><b>${item.destinationCurrency || ""} ${format(item.converted || 0)}</b></div>
<div><span>New GHS</span><b>GHS ${format(item.newBalances ? item.newBalances.ghs : 0)}</b></div>
<div><span>New NGN</span><b>NGN ${format(item.newBalances ? item.newBalances.ngn : 0)}</b></div>
<div><span>Completed</span><b>${item.completedAt || item.createdAt || ""}</b></div>
</div>
`;
}

async function updateResult(){
await loadRateSettings();

let amountValue = moneyInputValue("amount");
let typeValue = type.value;

if(!amountValue || amountValue <= 0){
converted = 0;
result.innerText = "";
return;
}

if(typeValue==="cedis"){
if(!rateSettings.cedisEnabled){
converted = 0;
result.innerText = "Cedis -> Naira is currently unavailable";
return;
}

converted = amountValue * Number(rateSettings.rateCedis);
result.innerHTML = `
<div><b>You send:</b> GHS ${format(amountValue)}</div>
<div><b>You receive:</b> NGN ${format(converted)}</div>
<div><b>Exchange rate:</b> 1 GHS = ${formatRate(rateSettings.rateCedis)} NGN</div>
<div><b>Charges:</b> GHS 0.00</div>
`;
}else{
if(!rateSettings.nairaEnabled){
converted = 0;
result.innerText = "Naira -> Cedis is currently unavailable";
return;
}

converted = amountValue / Number(rateSettings.rateNaira);
result.innerHTML = `
<div><b>You send:</b> NGN ${format(amountValue)}</div>
<div><b>You receive:</b> GHS ${format(converted)}</div>
<div><b>Exchange rate:</b> 1 GHS = ${formatRate(rateSettings.rateNaira)} NGN</div>
<div><b>Charges:</b> NGN 0.00</div>
`;
}
}

async function saveExchangeAndContinue(){
if(!(await ensureAccountCanUseSensitiveAction("convert"))) return;
let amountValue = moneyInputValue("amount");

if(!amountValue || amountValue <= 0) return alert("Enter a valid amount");

await updateResult();
if(converted <= 0) return alert("This exchange direction is currently unavailable");

let draft = {
type: type.value,
amount: amountValue,
converted,
rateCedis: Number(rateSettings.rateCedis),
rateNaira: Number(rateSettings.rateNaira),
costRateCedisToNaira: Number(rateSettings.costRateCedisToNaira),
costRateNairaToCedis: Number(rateSettings.costRateNairaToCedis)
};

localStorage.setItem("exchangeDraft", JSON.stringify(draft));
localStorage.removeItem("activeConvertOrderId");
window.location.href = "payment.html";
}

function getDraft(){
let draft = localStorage.getItem("exchangeDraft");
if(!draft) return null;
return JSON.parse(draft);
}

async function loadProfilePage(){
loadCountryOptions();
let profile = await getCustomerProfile();
currentProfile = profile || currentProfile;

if(profile){
let transferUid = await ensureCustomerTransferUid(currentUser.uid, profile);
profile.transferUid = transferUid;
if(document.getElementById("profileTransferUidCard")){
profileTransferUidCard.classList.remove("hidden");
profileTransferUid.innerText = transferUid || "Unavailable";
}
profileFirstName.value = profile.firstName || "";
profileMiddleName.value = profile.middleName || "";
profileLastName.value = profile.lastName || profile.surname || "";
if(document.getElementById("profileUsername")) profileUsername.value = profile.username || "";
profilePhone.value = profile.phone || "";
profileEmail.value = profile.email || currentUser.email || "";
profileCountry.value = profile.country || "";
profileAddress.value = profile.address || "";
let fullName = profileFullName(profile) || "Not set";
let joined = profile.createdAt || profile.createdAtLabel || "Not available";
let status = isAccountRestricted(profile) ? "Restricted" : isAccountBanned(profile) ? "Banned" : "Active";
if(document.getElementById("profileFullNameText")) profileFullNameText.innerText = fullName;
if(document.getElementById("profilePhoneText")) profilePhoneText.innerText = profile.phone || "Not set";
if(document.getElementById("profileEmailText")) profileEmailText.innerText = profile.email || currentUser.email || "Not set";
if(document.getElementById("profileUsernameText")) profileUsernameText.innerText = profile.username || "Not set";
if(document.getElementById("profileCountryText")) profileCountryText.innerText = profile.country || "Not set";
if(document.getElementById("profileDateJoinedText")) profileDateJoinedText.innerText = joined;
if(document.getElementById("profileAccountStatusText")) profileAccountStatusText.innerText = status;
updateTierBadges(profile, liveBalances);
if(document.getElementById("preferredPaymentMethod")) preferredPaymentMethod.value = profile.preferredPaymentMethod || "";
if(document.getElementById("paymentProvider")) paymentProvider.value = profile.paymentProvider || "";
if(document.getElementById("paymentAccountName")) paymentAccountName.value = profile.paymentAccountName || "";
if(document.getElementById("paymentAccountNumber")) paymentAccountNumber.value = profile.paymentAccountNumber || "";
profileStatus.innerText = "Profile loaded. Account tier: "+accountTierLabel(profile)+". KYC status: "+(profile.kycStatus || "Not submitted");
showProfileNextStep(profile);
}else{
profileEmail.value = currentUser.email || "";
profileStatus.innerText = "Create your profile before placing an order.";
if(document.getElementById("profileNextStep")){
profileNextStep.innerHTML = 'After saving your profile, continue to <a class="link" href="kyc.html">KYC Verification</a>.';
}
loadNotificationSettings();
}
}

async function copyMyTransferUid(){
let uid = document.getElementById("profileTransferUid") ? profileTransferUid.innerText.trim() : "";
if(!/^[0-9]{9,10}$/.test(uid)) return alert("ATV UID is not ready yet. Reload profile.");
try{
await navigator.clipboard.writeText(uid);
showToast("UID copied");
}catch(error){
prompt("Copy your ATV UID", uid);
}
}

function showProfileNextStep(profile){
if(!document.getElementById("profileNextStep")) return;

let status = getKycStatus(profile);
let normalizedStatus = normalizeKycStatus(profile);

if(isCustomerKycApproved(profile)){
profileNextStep.innerHTML = '<a class="button-link" href="exchange.html">Start Exchange</a>';
}else if(normalizedStatus === "rejected"){
profileNextStep.innerHTML = 'Your KYC was rejected. Go to <a class="link" href="kyc.html">KYC Verification</a> to submit again, or contact support.';
}else{
profileNextStep.innerHTML = 'Your current KYC status is "'+status+'". Continue to <a class="link" href="kyc.html">KYC Verification</a> or <a class="link" href="support.html">contact support</a>.';
}
}

async function loadSettingsPage(){
currentProfile = await getCustomerProfile();
}

async function loadNotificationSettingsPage(){
await loadNotificationSettings();
}

async function loadNotificationsPage(){
if(!document.getElementById("notificationsPageList")) return;
let activeFilter = "all";
let rows = await loadNotificationRows();

function render(){
let filtered = rows.filter(item => activeFilter === "all" || notificationGroup(item) === activeFilter);
notificationsPageList.innerHTML = filtered.length ? filtered.map(item=>{
let target = notificationTarget(item);
let priority = item.priority || "medium";
return `
<div class="notification-item ${notificationIsReadByMe(item) ? "" : "unread"} priority-${priority}" data-id="${escapeHtml(item.id)}" data-collection="${escapeHtml(target.collection)}" data-target-id="${escapeHtml(target.id)}" data-link="${escapeHtml(target.link)}">
<button class="notification-open" type="button">
<span class="notification-meta">${notificationGroup(item).toUpperCase()} &bull; ${priority}</span>
<b>${escapeHtml(item.title || "Notification")}</b>
<p>${escapeHtml(item.message || item.body || "")}</p>
<small>${escapeHtml(item.createdAt || "")}</small>
</button>
<button class="notification-delete" type="button">Delete</button>
</div>
`;
}).join("") : '<div class="admin-empty">No notifications in this category</div>';

notificationsPageList.querySelectorAll(".notification-open").forEach(button=>{
button.onclick = ()=>{
let item = button.closest(".notification-item");
openNotificationTarget(item.dataset.collection, item.dataset.targetId, item.dataset.link);
};
});
notificationsPageList.querySelectorAll(".notification-delete").forEach(button=>{
button.onclick = async event=>{
event.stopPropagation();
let item = button.closest(".notification-item");
await db.collection("notifications").doc(item.dataset.id).set({
deletedFor: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
deletedAt: new Date().toLocaleString()
},{merge:true});
item.remove();
};
});
}

render();
document.querySelectorAll(".page-filters button").forEach(button=>{
button.onclick = ()=>{
activeFilter = button.dataset.filter;
document.querySelectorAll(".page-filters button").forEach(btn=>btn.classList.toggle("active", btn === button));
render();
};
});

await Promise.all(rows.filter(item => !notificationIsReadByMe(item)).map(item=>{
let update = item.forRole === "customer" && !item.userId
? {readBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid), readAt:new Date().toLocaleString()}
: {read:true, readAt:new Date().toLocaleString()};
return db.collection("notifications").doc(item.id).set(update,{merge:true});
}));
}

async function loadPaymentMethodPage(){
let profile = await getCustomerProfile();
let label = buildPaymentMethodLabel(profile);
if(document.getElementById("paymentMethodSummary")){
paymentMethodSummary.innerHTML = label ? `
<div class="flow-summary-grid">
<div><span>Method</span><b>${escapeHtml(profile.preferredPaymentMethod || "")}</b></div>
<div><span>Provider</span><b>${escapeHtml(profile.paymentProvider || "")}</b></div>
<div><span>Account Name</span><b>${escapeHtml(profile.paymentAccountName || "")}</b></div>
<div><span>Account Number</span><b>${escapeHtml(profile.paymentAccountNumber || "")}</b></div>
</div>
` : 'No payment method saved yet. <a class="link" href="add-payment-method.html">Add payment method</a>';
}
}

async function loadAddPaymentMethodPage(){
let profile = await getCustomerProfile();
if(!profile) return;
if(document.getElementById("preferredPaymentMethod")) preferredPaymentMethod.value = profile.preferredPaymentMethod || "";
if(document.getElementById("paymentProvider")) paymentProvider.value = profile.paymentProvider || "";
if(document.getElementById("paymentAccountName")) paymentAccountName.value = profile.paymentAccountName || "";
if(document.getElementById("paymentAccountNumber")) paymentAccountNumber.value = profile.paymentAccountNumber || "";
}

async function savePaymentMethod(){
if(!currentUser) return alert("Login first");
if(!(await ensureAccountCanUseSensitiveAction("payment method"))) return;
if(!preferredPaymentMethod.value) return alert("Select payment method");
if(!paymentProvider.value.trim()) return alert("Enter provider or bank name");
if(!paymentAccountName.value.trim()) return alert("Enter account name");
if(!paymentAccountNumber.value.trim()) return alert("Enter account or wallet number");

await db.collection("users").doc(currentUser.uid).set({
preferredPaymentMethod: preferredPaymentMethod.value,
paymentProvider: paymentProvider.value.trim(),
paymentAccountName: paymentAccountName.value.trim(),
paymentAccountNumber: paymentAccountNumber.value.trim(),
updatedAt: new Date().toLocaleString()
},{merge:true});
if(document.getElementById("paymentMethodStatus")) paymentMethodStatus.innerText = "Payment method saved.";
showToast("Payment method saved");
}

async function loadSecurityPage(){
if(document.getElementById("securityStatus")) securityStatus.innerText = "Signed in as "+(currentUser.email || "customer");
}

async function sendCurrentUserPasswordReset(){
if(!currentUser || !currentUser.email) return alert("No email found for this account");
try{
await auth.sendPasswordResetEmail(currentUser.email);
if(document.getElementById("securityStatus")) securityStatus.innerText = "Password reset link sent to "+currentUser.email;
await notifyUser(currentUser.uid, "security-password", "Password Reset Requested", "A password reset link was sent to your email.", "security.html", {}, "high");
}catch(error){
if(document.getElementById("securityStatus")) securityStatus.innerText = error.message;
alert(error.message);
}
}

async function loadWithdrawalPinPage(){
if(document.getElementById("withdrawalPinStatus")){
let params = new URLSearchParams(window.location.search);
withdrawalPinStatus.innerText = params.get("forgot") === "1"
? "Create a new PIN. Your old PIN will be replaced after saving."
: "Choose a PIN you can remember. Do not share it.";
}
}

function pinHash(value){
let hash = 5381;
let text = String(value || "");
for(let i=0;i<text.length;i++) hash = ((hash << 5) + hash) + text.charCodeAt(i);
return Math.abs(hash).toString(36);
}

async function saveWithdrawalPin(){
let pin = withdrawalPin.value.trim();
let confirmPin = withdrawalPinConfirm.value.trim();
if(!/^[0-9]{4,6}$/.test(pin)) return alert("PIN must be 4-6 numbers");
if(pin !== confirmPin) return alert("PIN confirmation does not match");
let nowText = new Date().toLocaleString();
await db.collection("users").doc(currentUser.uid).collection("security").doc("withdrawalPin").set({
withdrawalPinSet: true,
withdrawalPinHash: pinHash(currentUser.uid+"-"+pin),
withdrawalPinUpdatedAt: nowText
},{merge:true});
await db.collection("users").doc(currentUser.uid).set({
withdrawalPinSet: true,
withdrawalPinHash: firebase.firestore.FieldValue.delete(),
withdrawalPinUpdatedAt: nowText
},{merge:true});
withdrawalPin.value = "";
withdrawalPinConfirm.value = "";
if(document.getElementById("withdrawalPinStatus")) withdrawalPinStatus.innerText = "Withdrawal PIN saved.";
showToast("Withdrawal PIN saved");
}

function forgotWithdrawalPin(){
if(!confirm("Forgot your withdrawal PIN?\n\nYou can create a new PIN while signed in. For your safety, never share this PIN with support or anyone else.")) return;
goToPage("withdrawal-pin.html?forgot=1");
}

function promptForWithdrawalPin(reason){
return new Promise(resolve=>{
let existing = document.getElementById("pinVerifyOverlay");
if(existing) existing.remove();
let overlay = document.createElement("div");
overlay.id = "pinVerifyOverlay";
overlay.className = "pin-verify-overlay";
overlay.innerHTML = `
<div class="pin-verify-card">
<button class="pin-close" type="button" aria-label="Close">&times;</button>
<span class="public-kicker">Security Check</span>
<h3>Enter Withdrawal PIN</h3>
<p>${escapeHtml(reason || "Confirm this transaction with your private PIN.")}</p>
<div class="password-field"><input id="pinVerifyInput" type="password" inputmode="numeric" maxlength="6" placeholder="4-6 digit PIN"><button type="button" onclick="togglePasswordVisibility('pinVerifyInput', this)" aria-label="Show PIN">&#128065;</button></div>
<div id="pinVerifyError" class="help"></div>
<button id="pinVerifyContinue" type="button">Continue</button>
<button id="pinVerifyForgot" class="secondary-link" type="button">Forgot PIN?</button>
</div>
`;
document.body.appendChild(overlay);
let input = document.getElementById("pinVerifyInput");
let close = overlay.querySelector(".pin-close");
let continueBtn = document.getElementById("pinVerifyContinue");
let forgotBtn = document.getElementById("pinVerifyForgot");
function finish(value){
overlay.remove();
resolve(value);
}
close.onclick = ()=>finish("");
forgotBtn.onclick = ()=>{
overlay.remove();
forgotWithdrawalPin();
resolve("");
};
continueBtn.onclick = ()=>{
let value = input.value.trim();
if(!/^[0-9]{4,6}$/.test(value)){
pinVerifyError.innerText = "Enter your 4-6 digit PIN";
return;
}
finish(value);
};
input.addEventListener("keydown", event=>{
if(event.key === "Enter") continueBtn.click();
if(event.key === "Escape") finish("");
});
setTimeout(()=>input.focus(), 80);
});
}

async function getWithdrawalPinRecord(){
let securityRef = db.collection("users").doc(currentUser.uid).collection("security").doc("withdrawalPin");
let securityDoc = await securityRef.get();
if(securityDoc.exists) return {source:"security", data:securityDoc.data() || {}};
let profile = currentProfile || await getCustomerProfile() || {};
if(profile.withdrawalPinSet && profile.withdrawalPinHash){
return {source:"legacy", data:profile};
}
return null;
}

async function requireWithdrawalPinVerification(reason){
if(!currentUser) return false;
let record = await getWithdrawalPinRecord();
if(!record || !record.data.withdrawalPinSet || !record.data.withdrawalPinHash){
alert("Set your withdrawal PIN first.");
goToPage("withdrawal-pin.html");
return false;
}
let pin = await promptForWithdrawalPin(reason);
if(!pin) return false;
let expectedHash = record.data.withdrawalPinHash;
let actualHash = pinHash(currentUser.uid+"-"+pin);
if(actualHash !== expectedHash){
alert("Incorrect withdrawal PIN");
return false;
}
if(record.source === "legacy"){
try{
let nowText = new Date().toLocaleString();
await db.collection("users").doc(currentUser.uid).collection("security").doc("withdrawalPin").set({
withdrawalPinSet: true,
withdrawalPinHash: expectedHash,
withdrawalPinUpdatedAt: record.data.withdrawalPinUpdatedAt || nowText,
migratedAt: nowText
},{merge:true});
await db.collection("users").doc(currentUser.uid).set({
withdrawalPinHash: firebase.firestore.FieldValue.delete()
},{merge:true});
}catch(error){
appLog("Withdrawal PIN legacy migration skipped", error.message);
}
}
return {ok:true, pin};
}

async function saveProfile(){
let firstName = profileFirstName.value.trim();
let middleName = profileMiddleName.value.trim();
let lastName = profileLastName.value.trim();
let username = document.getElementById("profileUsername") ? profileUsername.value.trim().toLowerCase() : "";
let fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

if(!firstName) return alert("Enter first name");
if(!lastName) return alert("Enter last/surname");
if(!profilePhone.value) return alert("Enter phone number");
if(!profileEmail.value) return alert("Enter email");
if(!profileCountry.value) return alert("Enter country");
if(!profileAddress.value) return alert("Enter address");
if(username && !/^[a-z0-9._-]{3,30}$/.test(username)) return alert("Username must be 3-30 characters and use only letters, numbers, dot, underscore, or dash");

let existingProfile = currentProfile || await getCustomerProfile() || {};
let preservedTier = isCustomerKycApproved(existingProfile) ? "Verified" : (existingProfile.accountTierLabel || existingProfile.tier || "Basic");
let profileData = {
userId: currentUser.uid,
firstName,
middleName,
lastName,
surname: lastName,
name: fullName,
fullName,
username,
phone: profilePhone.value,
email: profileEmail.value,
country: profileCountry.value,
address: profileAddress.value,
tier: preservedTier,
accountTier: isCustomerKycApproved(existingProfile) ? 2 : Number(existingProfile.accountTier || 1),
accountTierLabel: preservedTier,
updatedAt: new Date().toLocaleString()
};

let transferUid = await ensureCustomerTransferUid(currentUser.uid, {...existingProfile, ...profileData});
profileData.transferUid = transferUid;
profileData.atvUid = transferUid;
profileData.transferUidLocked = true;

if(document.getElementById("preferredPaymentMethod")) profileData.preferredPaymentMethod = preferredPaymentMethod.value;
if(document.getElementById("paymentProvider")) profileData.paymentProvider = paymentProvider.value;
if(document.getElementById("paymentAccountName")) profileData.paymentAccountName = paymentAccountName.value;
if(document.getElementById("paymentAccountNumber")) profileData.paymentAccountNumber = paymentAccountNumber.value;

await db.collection("users").doc(currentUser.uid).set(profileData,{merge:true});

await db.collection("publicUsers").doc(currentUser.uid).set({
userId: currentUser.uid,
transferUid,
transferUidLower: transferUid,
name: fullName,
fullName,
nameLower: fullName.toLowerCase(),
username,
usernameLower: username.toLowerCase(),
email: profileEmail.value,
emailLower: profileEmail.value.toLowerCase(),
phone: profilePhone.value,
phoneClean: cleanPhone(profilePhone.value),
updatedAt: new Date().toLocaleString()
},{merge:true});

currentProfile = await getCustomerProfile();
profileStatus.innerText = "Profile saved successfully.";
showProfileNextStep(currentProfile);
await notifyAdmin("profile-updated", "Customer profile updated", fullName+" updated profile details.", "customers.html", {userId:currentUser.uid, email:profileEmail.value}, "medium");
}

async function loadKycPage(){
currentProfile = await getCustomerProfile();

if(!currentProfile || !isProfileComplete(currentProfile)){
alert("Complete your customer profile before KYC verification");
window.location.href = "profile.html";
return;
}

renderKycPageState(currentProfile);

if(isCustomerKycApproved(currentProfile)){
if(document.getElementById("kycStatusBox")){
kycStatusBox.innerText = "KYC status: Approved";
}
showProfileNextStep(currentProfile);
return;
}

if(document.getElementById("kycCountry")){
let kycCountrySelect = document.getElementById("kycCountry");
let countryHtml = '<option value="">Select Country</option>';
Object.keys(countryIdTypes).forEach(country=>{
countryHtml += `<option value="${country}">${country}</option>`;
});
kycCountrySelect.innerHTML = countryHtml;
kycCountrySelect.value = currentProfile.country || "Other";
}
updateIdTypes(currentProfile.idType || "", currentProfile.country || "Other");
if(document.getElementById("idNumber")) idNumber.value = currentProfile.idNumber || "";
if(document.getElementById("proofOfAddressType")) proofOfAddressType.value = currentProfile.proofOfAddressType || "";
if(document.getElementById("kycStatusBox")){
kycStatusBox.innerText = "KYC status: "+getKycStatus(currentProfile);
}
showProfileNextStep(currentProfile);
}

async function saveKyc(){
let idTypeInput = document.getElementById("idType");
let idNumberInput = document.getElementById("idNumber");
let proofTypeInput = document.getElementById("proofOfAddressType");
let idFileInput = document.getElementById("idVerificationFile");
let proofFileInput = document.getElementById("proofOfAddressFile");
let statusBox = document.getElementById("kycStatusBox");
let submitBtn = document.getElementById("kycSubmitBtn");

if(!currentUser) return alert("Login first");
if(!idTypeInput || !idNumberInput || !proofTypeInput || !idFileInput || !proofFileInput){
return alert("KYC form is not ready. Refresh the page and try again.");
}

if(statusBox) statusBox.innerText = "";
if(submitBtn){
submitBtn.disabled = true;
submitBtn.classList.add("loading");
submitBtn.innerText = "Submitting...";
}

try{
let existingProfile = await getCustomerProfile();
if(isCustomerKycApproved(existingProfile) || (isKycLocked(existingProfile) && normalizeKycStatus(existingProfile) !== "rejected")){
alert("Your KYC is already approved or locked. Contact support if admin asked you to resubmit.");
return;
}

if(!idTypeInput.value) return alert("Select ID type");
if(!idNumberInput.value.trim()) return alert("Enter ID number");
if(!proofTypeInput.value.trim()) return alert("Enter proof of address document type");

let idVerificationUrl = existingProfile ? existingProfile.idVerificationUrl || existingProfile.kycDocumentUrl || "" : "";
let proofOfAddressUrl = existingProfile ? existingProfile.proofOfAddressUrl || "" : "";
let idFile = idFileInput.files && idFileInput.files[0];
let proofFile = proofFileInput.files && proofFileInput.files[0];

if(!idVerificationUrl && !idFile) return alert("Upload your ID verification document");
if(!proofOfAddressUrl && !proofFile) return alert("Upload your proof of address document");

if(idFile){
if(statusBox) statusBox.innerText = "Uploading ID verification...";
idVerificationUrl = await uploadToCloudinary(idFile);
}

if(proofFile){
if(statusBox) statusBox.innerText = "Uploading proof of address...";
proofOfAddressUrl = await uploadToCloudinary(proofFile);
}

if(statusBox) statusBox.innerText = "Saving KYC submission...";
await db.collection("users").doc(currentUser.uid).set({
idType: idTypeInput.value,
idNumber: idNumberInput.value.trim(),
idVerificationUrl,
kycDocumentUrl: idVerificationUrl,
proofOfAddressType: proofTypeInput.value.trim(),
proofOfAddressUrl,
kycStatus: "Submitted",
kycSubmittedAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
},{merge:true});

currentProfile = await getCustomerProfile();
if(statusBox) statusBox.innerText = "KYC submitted successfully. Admin will review it.";
showProfileNextStep(currentProfile);
await notifyUser(currentUser.uid, "kyc-submitted", "KYC Submitted", "Your KYC documents have been submitted for review.", "kyc.html", {status:"Submitted"}, "medium");
await notifyAdmin("kyc-submitted", "New KYC submitted by "+(currentProfile.name || currentUser.email), "A customer uploaded KYC documents for admin review.", "kyc-admin.html", {userId:currentUser.uid, idType:idTypeInput.value, idUploaded:Boolean(idVerificationUrl), proofUploaded:Boolean(proofOfAddressUrl)}, "high");
if(idVerificationUrl) await notifyAdmin("id-card-uploaded", "ID card uploaded", (currentProfile.name || currentUser.email)+" uploaded an ID document.", "kyc-admin.html", {userId:currentUser.uid, idType:idTypeInput.value}, "medium");
if(proofOfAddressUrl) await notifyAdmin("utility-bill-uploaded", "Proof of address uploaded", (currentProfile.name || currentUser.email)+" uploaded proof of address.", "kyc-admin.html", {userId:currentUser.uid, proofOfAddressType:proofTypeInput.value.trim()}, "medium");
}catch(error){
let message = "Could not submit KYC: "+error.message;
if(statusBox) statusBox.innerText = message;
alert(message);
}finally{
if(submitBtn){
submitBtn.disabled = false;
submitBtn.classList.remove("loading");
submitBtn.innerText = "Submit KYC Verification";
}
}
}

async function uploadToCloudinary(file, folderName){
if(!cloudinarySettings.cloudName || !cloudinarySettings.uploadPreset){
alert("Add your Cloudinary cloud name and unsigned upload preset in app.js first");
throw new Error("Missing Cloudinary settings");
}

let formData = new FormData();
formData.append("file", file);
formData.append("upload_preset", cloudinarySettings.uploadPreset);
formData.append("folder", folderName || "atv-exchange/kyc");

let response = await fetch("https://api.cloudinary.com/v1_1/"+cloudinarySettings.cloudName+"/auto/upload", {
method: "POST",
body: formData
});

if(!response.ok){
throw new Error("Cloudinary upload failed");
}

let data = await response.json();
return data.secure_url;
}

async function callCurrencyApi(action, payload){
let endpoint = rateSettings.currencyApiEndpoint || "";

if(!endpoint){
return {
confirmed:false,
status:"Pending",
message:"Currency API endpoint is not connected yet. Request saved for admin/backend processing."
};
}

let idToken = currentUser ? await currentUser.getIdToken() : "";
let response = await fetch(endpoint, {
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":"Bearer "+idToken
},
body:JSON.stringify({action, ...payload})
});

let data = {};
try{
data = await response.json();
}catch(error){
data = {};
}

if(!response.ok){
throw new Error(data.message || "Currency API request failed");
}

return data;
}

async function loadDepositPage(){
await loadRateSettings();
updateDepositPaymentInstructions();
showDepositStep(1);
let activeDepositId = localStorage.getItem("activeDepositOrderId");
if(activeDepositId){
listenToActiveDepositOrder(activeDepositId);
}
}

function showDepositStep(step){
["depositStep1","depositStep2","depositStep3","depositStep4","depositStep5"].forEach(id=>{
let el = document.getElementById(id);
if(el) el.classList.toggle("hidden", id !== "depositStep"+step);
});
let titles = {
1:"Select Deposit Currency",
2:"Enter Deposit Amount",
3:"Select Deposit Method",
4:"Payment Instruction",
5:"Waiting for Confirmation"
};
if(document.getElementById("depositStepCount")) depositStepCount.innerText = "Step "+step+" of 5";
if(document.getElementById("depositStepTitle")) depositStepTitle.innerText = titles[step] || "";
for(let i = 1; i <= 5; i++){
let track = document.getElementById("depositTrack"+i);
if(track) track.classList.toggle("active", i <= step);
}
}

function selectDepositCurrency(currency){
if(document.getElementById("depositCurrency")) depositCurrency.value = currency;
if(document.getElementById("depositGhsBtn")) depositGhsBtn.classList.toggle("active", currency === "GHS");
if(document.getElementById("depositNgnBtn")) depositNgnBtn.classList.toggle("active", currency === "NGN");
updateDepositPaymentInstructions();
updateDepositAmountPreview();
}

function updateDepositAmountPreview(){
if(!document.getElementById("depositAmountPreview")) return;
let currency = document.getElementById("depositCurrency") ? depositCurrency.value : "GHS";
let amountValue = moneyInputValue("depositAmount");
depositAmountPreview.innerHTML = `
<div class="flow-summary-grid">
<div><span>Currency</span><b>${currency}</b></div>
<div><span>Deposit Amount</span><b>${currency} ${format(amountValue || 0)}</b></div>
<div><span>Limit</span><b>No limit set</b></div>
</div>
`;
}

function goToDepositMethodStep(){
let amountValue = moneyInputValue("depositAmount");
if(!amountValue || amountValue <= 0) return alert("Enter a valid deposit amount");
let currency = depositCurrency.value;
if(document.getElementById("depositMethodPrimary")){
let isGhs = currency === "GHS";
depositMethodPrimary.querySelector("b").innerText = isGhs ? "MTN Mobile Money" : "OPay Bank Transfer";
depositMethodPrimaryText.innerText = isGhs ? "Active for GHS deposits" : "Active for NGN deposits";
}
showDepositStep(3);
}

function selectDepositMethod(method){
localStorage.setItem("depositMethod", method);
if(document.getElementById("depositMethodPrimary")) depositMethodPrimary.classList.add("active");
}

function depositSummary(order){
let method = order.currency === "GHS" ? "MTN Mobile Money" : "OPay Bank Transfer";
return `
<div class="flow-summary-grid">
<div><span>Order ID</span><b>${order.requestId || order.id}</b></div>
<div><span>Status</span><b>${depositCustomerStatusLabel(order.status)}</b></div>
<div><span>Amount</span><b>${order.currency} ${format(order.amount || 0)}</b></div>
<div><span>Method</span><b>${method}</b></div>
</div>
`;
}

function depositCustomerStatusLabel(status){
let value = String(status || "Created").toLowerCase();
if(value === "created") return "Created";
if(value === "payment submitted" || value === "pending") return "Payment Submitted";
if(value === "verification") return "Deposit Verification";
if(value === "processing") return "Deposit Processing";
if(value === "credited" || value === "approved") return "Wallet Credited Successfully";
if(value === "rejected") return "Deposit Rejected";
if(value.includes("expired")) return "Cancelled / Payment Time Expired";
return status || "Created";
}

async function createDepositOrder(){
let currency = depositCurrency.value;
let amountValue = moneyInputValue("depositAmount");
if(!amountValue || amountValue <= 0) return alert("Enter a valid deposit amount");

let profile = await getCustomerProfile();
let paymentDetails = getDepositPaymentDetails(currency);
let requestId = "DEP-"+Date.now();
let now = Date.now();
let deadline = now + 15 * 60 * 1000;
let depositData = {
id: requestId,
requestId,
customerId: currentUser.uid,
user_id: currentUser.uid,
customerEmail: currentUser.email,
customerName: profile ? profile.name : "",
username: profile ? (profile.username || "") : "",
currency,
amount: amountValue,
network: paymentDetails.network,
momoNumber: currency === "GHS" ? paymentDetails.accountNumber : "",
bankName: currency === "NGN" ? paymentDetails.network : "",
accountNumber: paymentDetails.accountNumber,
businessName: paymentDetails.businessName,
accountHolderName: paymentDetails.accountHolderName,
status: "created",
type: "deposit",
createdAt: new Date(now).toLocaleString(),
created_at: new Date(now).toLocaleString(),
createdAtMs: now,
paymentDeadlineAt: deadline,
paymentDeadlineLabel: new Date(deadline).toLocaleString(),
updatedAt: new Date(now).toLocaleString()
};

try{
await Promise.all([
db.collection("deposits").doc(requestId).set(depositData),
db.collection("walletRequests").doc(requestId).set({...depositData,type:"deposit",status:"Pending",manualMomoDeposit:true}),
db.collection("notifications").add({
forRole: "admin",
type: "deposit",
title: "New deposit order",
message: currentUser.email+" created "+currency+" "+format(amountValue)+" deposit order.",
depositId: requestId,
customerId: currentUser.uid,
createdAt: new Date(now).toLocaleString(),
read: false,
...adminOrderNotification("deposits", requestId, {type:"deposit", status:"created"})
})
]);
localStorage.setItem("activeDepositOrderId", requestId);
listenToActiveDepositOrder(requestId);
await notifyBackendAdmins(
"New deposit order",
currentUser.email+" created "+currency+" "+format(amountValue)+" deposit order.",
orderDetailUrl("deposits", requestId),
adminOrderNotification("deposits", requestId, {type:"deposit", status:"created"}).data
);
showToast("Deposit order created");
}catch(error){
if(document.getElementById("depositStatus")) depositStatus.innerText = "Could not create deposit: "+error.message;
alert("Could not create deposit: "+error.message);
}
}

function listenToActiveDepositOrder(id){
if(window.activeDepositUnsubscribe) window.activeDepositUnsubscribe();
window.activeDepositUnsubscribe = db.collection("deposits").doc(id).onSnapshot(doc=>{
if(!doc.exists) return;
renderDepositFlow({id:doc.id, ...doc.data()});
},error=>{
if(document.getElementById("depositStatus")) depositStatus.innerText = "Could not load deposit: "+error.message;
});
}

function renderDepositFlow(order){
if(!order) return;
if(document.getElementById("depositCurrency")) depositCurrency.value = order.currency || "GHS";
if(document.getElementById("depositOrderSummary")) depositOrderSummary.innerHTML = depositSummary(order);
if(document.getElementById("depositLiveStatus")) depositLiveStatus.innerHTML = depositSummary(order);
if(document.getElementById("depositPaymentInstructions")) updateDepositPaymentInstructions();

let status = String(order.status || "created").toLowerCase();
if(status === "created"){
showDepositStep(4);
startDepositCountdown(order);
return;
}
if(status === "rejected"){
showDepositStep(5);
if(document.getElementById("depositWaitingTitle")) depositWaitingTitle.innerText = "Deposit Rejected";
if(document.getElementById("depositWaitingMessage")) depositWaitingMessage.innerText = "Your deposit was rejected. Please review the reason below.";
if(document.getElementById("depositDoneIcon")) depositDoneIcon.innerText = "!";
if(document.getElementById("depositRejectionReason")){
depositRejectionReason.classList.remove("hidden");
depositRejectionReason.innerText = "Reason: "+(order.rejectionReason || "No reason provided");
}
return;
}
if(status === "credited" || status === "approved"){
showDepositStep(5);
if(document.getElementById("depositWaitingTitle")) depositWaitingTitle.innerText = "Wallet Credited Successfully";
if(document.getElementById("depositWaitingMessage")) depositWaitingMessage.innerText = "Your wallet balance has been updated.";
if(document.getElementById("depositDoneIcon")) depositDoneIcon.innerText = "DONE";
if(!window.depositSuccessRedirected){
window.depositSuccessRedirected = true;
setTimeout(()=>{
localStorage.removeItem("activeDepositOrderId");
openTransactionSuccess({
title: "Deposit Successful",
message: "Your wallet has been credited successfully.",
type: "Deposit",
reference: order.requestId || order.id,
amount: (order.currency || "")+" "+format(order.amount || 0),
status: "Completed",
orderCollection: "deposits",
orderId: order.id || order.requestId,
details: [
{label:"Sender Name", value:order.senderName || order.sender_name || ""},
{label:"Payment Reference", value:order.transactionId || order.transaction_id || ""},
{label:"Payment Method", value:order.network || order.bankName || "Manual Payment"}
]
});
}, 900);
}
return;
}
showDepositStep(5);
if(document.getElementById("depositWaitingTitle")) depositWaitingTitle.innerText = depositCustomerStatusLabel(order.status);
if(document.getElementById("depositWaitingMessage")) depositWaitingMessage.innerText = "Your deposit is being reviewed by admin.";
}

function startDepositCountdown(order){
if(window.depositCountdownTimer) clearInterval(window.depositCountdownTimer);
let tick = async ()=>{
let remaining = Number(order.paymentDeadlineAt || 0) - Date.now();
if(document.getElementById("depositCountdown")) depositCountdown.innerText = formatCountdown(remaining);
if(remaining <= 0){
clearInterval(window.depositCountdownTimer);
let fresh = await db.collection("deposits").doc(order.id).get();
let data = fresh.exists ? fresh.data() : {};
if(String(data.status || "").toLowerCase() === "created"){
await db.collection("deposits").doc(order.id).set({
status:"expired",
expiredAt:new Date().toLocaleString(),
updatedAt:new Date().toLocaleString()
},{merge:true});
}
}
};
tick();
window.depositCountdownTimer = setInterval(tick, 1000);
}

async function submitDeposit(){
if(walletActionBusy) return;
await loadRateSettings();

let currency = depositCurrency.value;
let amountValue = moneyInputValue("depositAmount");
let senderNameValue = depositSenderName.value.trim();
let transactionIdValue = normalizeDepositTransactionId(depositTransactionId.value);
let screenshotFile = depositScreenshot.files[0];
let senderLabel = currency === "NGN" ? "bank account name used for the transfer" : "sender name used for the MoMo payment";
let referenceLabel = currency === "NGN" ? "bank transfer reference" : "MoMo transaction ID / reference ID";

if(!amountValue || amountValue <= 0) return alert("Enter a valid deposit amount");
if(!senderNameValue) return alert("Enter the "+senderLabel);
if(!transactionIdValue || transactionIdValue.length < 4) return alert("Enter a valid "+referenceLabel);

walletActionBusy = true;
setLoading("depositBtn", true, "Submitting...");

let requestId = depositDocId(transactionIdValue);
let referenceId = paymentReferenceDocId(transactionIdValue);

try{
let profile = await getCustomerProfile();
let paymentDetails = getDepositPaymentDetails(currency);
let screenshotUrl = "";
if(screenshotFile){
screenshotUrl = await uploadToCloudinary(screenshotFile, "atv-exchange/deposits");
}

let depositData = {
id: requestId,
requestId,
customerId: currentUser.uid,
user_id: currentUser.uid,
customerEmail: currentUser.email,
customerName: profile ? profile.name : "",
username: profile ? (profile.username || "") : "",
currency,
amount: amountValue,
senderName: senderNameValue,
sender_name: senderNameValue,
transactionId: transactionIdValue,
transaction_id: transactionIdValue,
screenshot: screenshotUrl,
screenshotProof: screenshotUrl,
network: paymentDetails.network,
momoNumber: currency === "GHS" ? paymentDetails.accountNumber : "",
bankName: currency === "NGN" ? paymentDetails.network : "",
accountNumber: paymentDetails.accountNumber,
businessName: paymentDetails.businessName,
accountHolderName: paymentDetails.accountHolderName,
status: "pending",
type: "deposit",
createdAt: new Date().toLocaleString(),
created_at: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
};

let depositRef = db.collection("deposits").doc(requestId);
let walletRef = db.collection("walletRequests").doc(requestId);
let usedRef = db.collection("usedPaymentReferences").doc(referenceId);
let notificationRef = db.collection("notifications").doc();

await db.runTransaction(async transaction=>{
let usedDoc = await transaction.get(usedRef);
if(usedDoc.exists) throw new Error(duplicateReferenceMessage());

transaction.set(usedRef, {
reference: referenceId,
originalReference: transactionIdValue,
status: "processed",
orderType: "deposit",
paymentMethod: currency === "NGN" ? "opay-bank-transfer" : "mtn-momo",
customerId: currentUser.uid,
customerEmail: currentUser.email,
senderName: senderNameValue,
amount: amountValue,
currency,
linkedOrderId: requestId,
createdAt: new Date().toLocaleString()
});

transaction.set(depositRef, depositData);
transaction.set(walletRef, {
...depositData,
type:"deposit",
status:"Pending",
manualMomoDeposit: true
});
transaction.set(notificationRef, {
forRole: "admin",
type: "deposit",
title: "New "+currency+" deposit",
message: currentUser.email+" submitted "+currency+" "+format(amountValue)+" for admin confirmation.",
depositId: requestId,
customerId: currentUser.uid,
createdAt: new Date().toLocaleString(),
read: false,
...adminOrderNotification("deposits", requestId, {type:"deposit", status:"Pending"})
});
});

await notifyBackendAdmins(
"New "+currency+" deposit",
currentUser.email+" submitted "+currency+" "+format(amountValue)+" for admin confirmation.",
orderDetailUrl("deposits", requestId),
adminOrderNotification("deposits", requestId, {type:"deposit", status:"Pending"}).data
);

depositStatus.innerText = "Awaiting Admin Confirmation. Your deposit is pending review.";
depositAmount.value = "";
depositSenderName.value = "";
depositTransactionId.value = "";
depositScreenshot.value = "";
showToast("Deposit submitted");
}catch(error){
let message = error.message || "";
if(message.toLowerCase().includes("permission")){
message = "Could not submit deposit. If this transaction ID was already used, enter a new reference. Also make sure the latest Firestore rules are published.";
}
if(String(error.message || "").includes(duplicateReferenceMessage())){
await notifyFailedPaymentAttempt("Duplicate deposit transaction ID", "deposit.html", {type:"deposit", transactionId:transactionIdValue});
}
depositStatus.innerText = "Could not submit deposit: "+message;
alert("Could not submit deposit: "+message);
}finally{
walletActionBusy = false;
setLoading("depositBtn", false);
}
}

async function submitDepositPaymentProof(){
if(walletActionBusy) return;
let id = localStorage.getItem("activeDepositOrderId");
if(!id) return alert("Create deposit order first");
let senderNameValue = depositSenderName.value.trim();
let transactionIdValue = normalizeDepositTransactionId(depositTransactionId.value);
let screenshotFile = depositScreenshot.files[0];
if(!senderNameValue) return alert("Enter sender name");
if(!transactionIdValue || transactionIdValue.length < 4) return alert("Enter a valid transaction ID / reference ID");

walletActionBusy = true;
setLoading("depositBtn", true, "Submitting...");

try{
let depositRef = db.collection("deposits").doc(id);
let usedRef = db.collection("usedPaymentReferences").doc(paymentReferenceDocId(transactionIdValue));
let notificationRef = db.collection("notifications").doc();
let screenshotUrl = "";
if(screenshotFile){
screenshotUrl = await uploadToCloudinary(screenshotFile, "atv-exchange/deposits");
}

await db.runTransaction(async transaction=>{
let depositDoc = await transaction.get(depositRef);
if(!depositDoc.exists) throw new Error("Deposit order not found");
let deposit = depositDoc.data();
if(String(deposit.status || "").toLowerCase() !== "created") throw new Error("This deposit cannot accept payment proof now");
let usedDoc = await transaction.get(usedRef);
if(usedDoc.exists) throw new Error(duplicateReferenceMessage());

transaction.set(usedRef, {
reference: paymentReferenceDocId(transactionIdValue),
originalReference: transactionIdValue,
status: "processed",
orderType: "deposit",
paymentMethod: deposit.currency === "NGN" ? "opay-bank-transfer" : "mtn-momo",
customerId: currentUser.uid,
customerEmail: currentUser.email,
senderName: senderNameValue,
amount: Number(deposit.amount || 0),
currency: deposit.currency,
linkedOrderId: id,
createdAt: new Date().toLocaleString()
});
transaction.set(depositRef, {
senderName: senderNameValue,
sender_name: senderNameValue,
transactionId: transactionIdValue,
transaction_id: transactionIdValue,
screenshot: screenshotUrl,
screenshotProof: screenshotUrl,
status: "payment submitted",
paymentSubmittedAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
},{merge:true});
transaction.set(notificationRef, {
forRole: "admin",
type: "deposit",
title: "New deposit proof",
message: currentUser.email+" submitted "+deposit.currency+" "+format(deposit.amount || 0)+" for admin confirmation.",
depositId: id,
customerId: currentUser.uid,
createdAt: new Date().toLocaleString(),
read: false,
...adminOrderNotification("deposits", id, {type:"deposit", status:"payment submitted"})
});
});

await notifyBackendAdmins(
"New deposit proof",
currentUser.email+" submitted "+deposit.currency+" "+format(deposit.amount || 0)+" for admin confirmation.",
orderDetailUrl("deposits", id),
adminOrderNotification("deposits", id, {type:"deposit", status:"payment submitted"}).data
);

showDepositStep(5);
showToast("Deposit proof submitted");
}catch(error){
let message = error.message || "";
if(message.toLowerCase().includes("permission")) message = "Could not submit deposit proof. Make sure the latest Firestore rules are published.";
if(String(error.message || "").includes(duplicateReferenceMessage())){
await notifyFailedPaymentAttempt("Duplicate deposit proof transaction ID", orderDetailUrl("deposits", id), {type:"deposit", depositId:id, transactionId:transactionIdValue});
}
if(document.getElementById("depositPaymentStatus")) depositPaymentStatus.innerText = message;
alert(message);
}finally{
walletActionBusy = false;
setLoading("depositBtn", false);
}
}

function loadDepositHistory(){
if(!document.getElementById("depositHistory")) return;

db.collection("deposits")
.where("customerId","==",currentUser.uid)
.onSnapshot(snap=>{
let rows = [];
snap.forEach(doc=>{
rows.push({id:doc.id, ...doc.data()});
});
rows.sort((a,b)=>String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

if(rows.length === 0){
depositHistory.innerHTML = "No deposit history yet";
return;
}

let html = "";
rows.forEach(item=>{
html += `
<div class="tx-card wallet-card">
<div class="status ${depositStatusClass(item.status)}">${depositStatusLabel(item.status)}</div>
<div><b>Amount:</b> ${item.currency || ""} ${format(item.amount || 0)}</div>
<div><b>Sender:</b> ${item.senderName || ""}</div>
<div><b>Transaction ID:</b> ${item.transactionId || ""}</div>
<div><b>Date:</b> ${item.createdAt || ""}</div>
${item.status === "pending" ? `<div class="help">Awaiting Admin Confirmation</div>` : ""}
${item.status === "rejected" ? `<div class="help">Deposit Rejected</div>` : ""}
${item.screenshot ? `<a class="link" href="${item.screenshot}" target="_blank">View Screenshot Proof</a>` : ""}
</div>
`;
});

depositHistory.innerHTML = html;
},error=>{
depositHistory.innerHTML = "Could not load deposits: "+error.message;
});
}

async function loadTransferPage(){
await loadRateSettings();
await syncCurrentPublicUser();
await rebuildPublicUsersFromTransactions();
loadWalletHistory("internal-transfer", "transferHistory");
}

async function syncCurrentPublicUser(){
if(!currentUser) return;
let profile = await getCustomerProfile();
if(!profile) return;
let transferUid = await ensureCustomerTransferUid(currentUser.uid, profile);

let nameValue = profile.name || [profile.firstName, profile.middleName, profile.lastName || profile.surname].filter(Boolean).join(" ") || currentUser.email;
let fullNameValue = profileFullName(profile) || nameValue;
let usernameValue = String(profile.username || "").trim().toLowerCase();
let emailValue = String(profile.email || currentUser.email || "").trim();
let phoneValue = String(profile.phone || "").trim();

await db.collection("publicUsers").doc(currentUser.uid).set({
userId: currentUser.uid,
transferUid,
transferUidLower: transferUid,
name: fullNameValue,
fullName: fullNameValue,
nameLower: fullNameValue.toLowerCase(),
username: usernameValue,
usernameLower: usernameValue,
email: emailValue,
emailLower: emailValue.toLowerCase(),
phone: phoneValue,
phoneClean: cleanPhone(phoneValue),
updatedAt: new Date().toLocaleString()
},{merge:true});
}

async function ensureLoggedInUserTransferUid(){
if(!currentUser) return;
try{
let profile = await getCustomerProfile();
if(profile) await ensureCustomerTransferUid(currentUser.uid, profile);
}catch(error){
appLog("Logged-in UID ensure skipped", error.message);
}
}

async function rebuildPublicUsersFromTransactions(){
if(!currentUser) return;

try{
let snap = await withTimeout(db.collection("transactions").get(), 2500, null, "public user rebuild");
if(!snap) return;

let updates = [];
snap.forEach(doc=>{
let tx = doc.data();
let userId = tx.customerId || tx.senderId || "";
if(!userId || userId === currentUser.uid) return;

let nameValue = tx.senderName || tx.customerName || tx.customerEmail || "";
let emailValue = tx.customerEmail || tx.senderEmail || "";
let phoneValue = tx.senderPhone || "";

updates.push(db.collection("publicUsers").doc(userId).set({
userId,
name: nameValue,
nameLower: String(nameValue || "").toLowerCase(),
username: String(tx.username || "").toLowerCase(),
usernameLower: String(tx.username || "").toLowerCase(),
email: emailValue,
emailLower: String(emailValue || "").toLowerCase(),
phone: phoneValue,
phoneClean: cleanPhone(phoneValue),
updatedAt: new Date().toLocaleString()
},{merge:true}));
});

await Promise.all(updates.slice(0, 30));
}catch(error){
appLog("Public user rebuild skipped", error.message);
}
}

async function findRecipientUser(lookupValue){
let lookup = lookupValue.trim();
if(!lookup) return null;
let lookupLower = lookup.toLowerCase();
appLog("Searching recipient", {lookup});

if(!/^[0-9]{9,10}$/.test(lookup)){
let username = lookupLower.replace(/^@/, "");
if(!/^[a-z0-9._-]{3,30}$/.test(username)){
throw new Error("Enter a valid ATV UID or username");
}
let usernameSnap = await db.collection("publicUsers").where("usernameLower","==",username).limit(1).get();
let usernameResult = usernameSnap.empty ? null : {id:usernameSnap.docs[0].id, ...usernameSnap.docs[0].data()};
appLog("Recipient username search result", usernameResult ? {id:usernameResult.id, username:usernameResult.username} : null);
return usernameResult;
}

let uidDoc = await db.collection("transferUIDs").doc(lookup).get();
if(uidDoc.exists){
let uidData = uidDoc.data() || {};
let userId = uidData.userId || uidData.uidOwner || "";
if(!userId) return null;
let publicDoc = await db.collection("publicUsers").doc(userId).get();
if(publicDoc.exists) return {id:publicDoc.id, ...uidData, ...publicDoc.data(), transferUid:lookup};
return {id:userId, ...uidData, transferUid:lookup};
}

let snap = await db.collection("publicUsers").where("transferUid","==",lookup).limit(1).get();
let fallback = snap.empty ? null : {id:snap.docs[0].id, ...snap.docs[0].data()};
appLog("Recipient search result", fallback ? {id:fallback.id, email:fallback.email, username:fallback.username} : null);
return fallback;
}

async function submitInternalTransfer(){
if(walletActionBusy) return;
if(!(await ensureAccountCanUseSensitiveAction("transfer"))) return;
await loadRateSettings();
await syncCurrentPublicUser();

let currency = transferCurrency.value;
let amountValue = moneyInputValue("transferAmount");
let recipient = null;

try{
recipient = await findRecipientUser(recipientLookup.value);
}catch(error){
transferStatus.innerText = "Could not search recipient: "+error.message+". Publish the latest Firestore rules and try again.";
alert(transferStatus.innerText);
return;
}

if(!amountValue || amountValue <= 0) return alert("Enter a valid amount");
if(!recipient){
let message = "Recipient not found. Check the ATV UID or username. If this is an old account, ask the recipient to open Profile once so their UID activates.";
transferStatus.innerText = message;
return alert(message);
}
if(recipient.id === currentUser.uid) return alert("You cannot send money to yourself");
if(!(await hasEnoughBalance(currentUser.uid, currency, amountValue))) return alert("Insufficient "+currency+" balance");

let recipientName = profileFullName(recipient) || recipient.fullName || recipient.name || recipient.username || recipient.id;
let recipientUsername = recipient.username || "Not set";
let recipientUid = recipient.transferUid || recipient.uid || "";
if(document.getElementById("recipientPreview")){
recipientPreview.classList.remove("hidden");
recipientPreview.innerHTML = `
<b>Recipient found</b>
<span>Full name: ${escapeHtml(recipientName)}</span>
<span>Username: ${escapeHtml(recipientUsername)}</span>
<span>ATV UID: ${escapeHtml(recipientUid)}</span>
`;
}
if(!confirm("Confirm internal transfer\n\nFull name: "+recipientName+"\nUsername: "+recipientUsername+"\nATV UID: "+recipientUid+"\nAmount: "+currency+" "+format(amountValue)+"\n\nOnly continue if the recipient details are correct.")) return;
let pinCheck = await requireWithdrawalPinVerification("Enter your withdrawal PIN to approve this UID transfer.");
if(!pinCheck) return;

walletActionBusy = true;
setLoading("transferBtn", true, "Sending...");

let requestId = createRequestId("TRF");
let senderProfile = currentProfile || await getCustomerProfile() || {};
let senderName = profileFullName(senderProfile) || senderProfile.username || currentUser.email || "ATV user";
let payload = {
requestId,
senderId: currentUser.uid,
senderEmail: currentUser.email,
senderName,
recipientId: recipient.id,
recipientName,
recipientUsername,
recipientTransferUid: recipientUid,
currency,
amount: amountValue,
clientRequestKey: requestId
};

try{
let transferResult = await callPushBackend("/internal-transfer", {
...payload,
amount: amountValue,
currency,
withdrawalPin: pinCheck.pin
});
if(!transferResult || transferResult.ok === false) throw new Error((transferResult && (transferResult.message || transferResult.error)) || "Backend transfer failed");
requestId = transferResult.requestId || requestId;
recipientName = transferResult.recipientName || recipientName;
recipientUsername = transferResult.recipientUsername || recipientUsername;
recipientUid = transferResult.recipientTransferUid || recipientUid;

transferStatus.innerText = "Transfer successful.";
showToast("Transfer successful");
try{
let now = new Date().toLocaleString();
await Promise.all([
db.collection("notifications").add({
forUserId: currentUser.uid,
type: "internal-transfer",
title: "Transfer Sent",
message: "You sent "+currency+" "+format(amountValue)+" to "+recipientName+".",
transactionId: requestId,
createdAt: now,
read: false
}),
db.collection("notifications").add({
forUserId: recipient.id,
type: "internal-transfer",
title: "Transfer Received",
message: "You received "+currency+" "+format(amountValue)+" from "+senderName+".",
transactionId: requestId,
createdAt: now,
read: false
})
]);
}catch(notificationError){
appLog("Transfer notification history skipped", notificationError.message);
}
try{
await notifyBackendUser(recipient.id, "Transfer Received", "You received "+currency+" "+format(amountValue)+" from "+senderName+".", orderDetailUrl("walletRequests", requestId), {requestId, transactionId:requestId, type:"internal-transfer", currency, amount:amountValue});
await notifyAdmin("internal-transfer", "Internal transfer completed", senderName+" sent "+currency+" "+format(amountValue)+" to "+recipientName+".", orderDetailUrl("walletRequests", requestId), {requestId, senderId:currentUser.uid, recipientId:recipient.id, currency, amount:amountValue}, "medium");
await notifyLargeTransactionIfNeeded(currency, amountValue, orderDetailUrl("walletRequests", requestId), {requestId, type:"internal-transfer"});
}catch(pushError){
appLog("Transfer push notification skipped", pushError.message);
}
openTransactionSuccess({
title: "Transfer Successful",
message: "Your internal transfer has been sent successfully.",
type: "Internal Transfer",
reference: requestId,
amount: currency+" "+format(amountValue),
status: "Completed",
orderCollection: "walletRequests",
orderId: requestId,
details: [
{label:"Recipient", value:recipientName},
{label:"Recipient UID", value:recipient.transferUid || recipient.uid || ""},
{label:"Currency", value:currency}
]
});
}catch(error){
let message = error.message || "";
if(message.toLowerCase().includes("permission")){
message = "Transfer failed because of permission. Upload the latest app.js and app.py to PythonAnywhere, reload the web app, then try again.";
}else if(message.toLowerCase().includes("insufficient")){
message = "Insufficient balance.";
}
transferStatus.innerText = "Could not send money: "+message;
alert("Could not send money: "+message);
}finally{
walletActionBusy = false;
setLoading("transferBtn", false);
}
}

async function loadWithdrawPage(){
await loadRateSettings();
loadWalletHistory("withdraw", "withdrawHistory");
let profile = await getCustomerProfile();
currentProfile = profile;
window.withdrawState = window.withdrawState || {currency:"GHS", balances:{ghs:0, ngn:0}, activeRequestId:"", payoutVerified:false, payoutDetails:null};

selectWithdrawCurrency("GHS");
showWithdrawStep(1);

db.collection("balances").doc(currentUser.uid).onSnapshot(doc=>{
let data = doc.exists ? doc.data() : {};
window.withdrawState.balances = {
ghs: Number(data.ghs || 0),
ngn: Number(data.ngn || 0)
};
updateWithdrawPreview();
},error=>{
if(document.getElementById("withdrawBalancePreview")) withdrawBalancePreview.innerText = "Could not load balance: "+error.message;
});

let activeId = localStorage.getItem("activeWithdrawRequestId");
if(activeId) listenToActiveWithdrawRequest(activeId);
}

function buildPaymentMethodLabel(profile){
if(!profile || !profile.preferredPaymentMethod) return "";
return `${profile.preferredPaymentMethod} - ${profile.paymentProvider || ""} ${profile.paymentAccountNumber || ""}`.trim();
}

function showWithdrawStep(step){
for(let i=1;i<=5;i++){
let panel = document.getElementById("withdrawStep"+i);
if(panel) panel.classList.toggle("hidden", i !== step);
let track = document.getElementById("withdrawTrack"+i);
if(track) track.classList.toggle("active", i <= step);
}
let titles = {
1:"Select Withdrawal Currency",
2:"Enter Withdrawal Amount",
3:"Select Payment Method",
4:"Review Withdrawal",
5:"Live Withdrawal Status"
};
if(document.getElementById("withdrawStepCount")) withdrawStepCount.innerText = "Step "+step+" of 5";
if(document.getElementById("withdrawStepTitle")) withdrawStepTitle.innerText = titles[step] || "";
}

function selectWithdrawCurrency(currency){
let value = currency === "NGN" ? "NGN" : "GHS";
window.withdrawState = window.withdrawState || {currency:"GHS", balances:{ghs:0, ngn:0}};
window.withdrawState.currency = value;
if(document.getElementById("withdrawCurrency")) withdrawCurrency.value = value;
if(document.getElementById("withdrawGhsBtn")) withdrawGhsBtn.classList.toggle("active", value === "GHS");
if(document.getElementById("withdrawNgnBtn")) withdrawNgnBtn.classList.toggle("active", value === "NGN");
applyWithdrawCurrencyMethodRule(value);
updateWithdrawPreview();
}

function applyWithdrawCurrencyMethodRule(currency){
let isNgn = currency === "NGN";
if(document.getElementById("withdrawPaymentMethod")){
withdrawPaymentMethod.value = isNgn ? "Bank Transfer" : "MTN Mobile Money";
}
if(document.getElementById("withdrawProvider")){
withdrawProvider.innerHTML = isNgn ? nigerianBankOptionsHtml() : '<option value="MTN Mobile Money" data-code="MTN">MTN Mobile Money</option>';
}
if(document.getElementById("withdrawProviderLabel")) withdrawProviderLabel.innerText = isNgn ? "Bank Name" : "Network";
if(document.getElementById("withdrawAccountNumberLabel")) withdrawAccountNumberLabel.innerText = isNgn ? "Account Number" : "MoMo Number";
if(document.getElementById("withdrawAccountNameLabel")) withdrawAccountNameLabel.innerText = isNgn ? "Verified Account Name" : "Verified MoMo Name";
if(document.getElementById("withdrawAccountNumber")) withdrawAccountNumber.placeholder = isNgn ? "Enter 10-digit account number" : "Enter MTN MoMo number";
if(document.getElementById("withdrawAccountName")) withdrawAccountName.placeholder = isNgn ? "Verified bank account name will appear here" : "Verified MoMo name will appear here";
if(document.getElementById("withdrawVerifyBtn")) withdrawVerifyBtn.innerText = isNgn ? "Verify Bank Account" : "Verify MoMo Name";
if(document.getElementById("withdrawSavedMethodBox")){
withdrawSavedMethodBox.innerHTML = isNgn
? "<b>NGN rule:</b> Choose bank, enter account number, then verify the account name before withdrawal."
: "<b>GHS rule:</b> Enter MTN Mobile Money number, then verify the MoMo account name before withdrawal.";
}
resetWithdrawalVerification();
}

function nigerianBankOptionsHtml(){
let banks = [
["Access Bank","044"],
["Citibank Nigeria","023"],
["Ecobank Nigeria","050"],
["Fidelity Bank","070"],
["First Bank of Nigeria","011"],
["First City Monument Bank","214"],
["Guaranty Trust Bank","058"],
["Keystone Bank","082"],
["Kuda Microfinance Bank","50211"],
["Moniepoint Microfinance Bank","50515"],
["OPay Microfinance Bank","999992"],
["Polaris Bank","076"],
["Stanbic IBTC Bank","221"],
["Sterling Bank","232"],
["Union Bank of Nigeria","032"],
["United Bank for Africa","033"],
["Unity Bank","215"],
["Wema Bank","035"],
["Zenith Bank","057"]
];
return '<option value="">Select bank</option>'+banks.map(bank=>`<option value="${bank[0]}" data-code="${bank[1]}">${bank[0]}</option>`).join("");
}

function resetWithdrawalVerification(){
window.withdrawState = window.withdrawState || {};
window.withdrawState.payoutVerified = false;
window.withdrawState.payoutDetails = null;
if(document.getElementById("withdrawAccountName")) withdrawAccountName.value = "";
if(document.getElementById("withdrawVerifiedConfirm")) withdrawVerifiedConfirm.checked = false;
if(document.getElementById("withdrawVerificationStatus")) withdrawVerificationStatus.innerText = "Verify payout details before continuing.";
}

function selectedWithdrawProviderCode(){
let select = document.getElementById("withdrawProvider");
if(!select) return "";
let option = select.options[select.selectedIndex];
return option ? option.dataset.code || "" : "";
}

function updateWithdrawVerificationConfirm(){
if(!window.withdrawState || !window.withdrawState.payoutDetails) return;
window.withdrawState.payoutVerified = !!(document.getElementById("withdrawVerifiedConfirm") && withdrawVerifiedConfirm.checked);
}

async function verifyWithdrawalPayout(){
let currency = document.getElementById("withdrawCurrency") ? withdrawCurrency.value : "GHS";
let providerName = document.getElementById("withdrawProvider") ? withdrawProvider.value.trim() : "";
let providerCode = selectedWithdrawProviderCode();
let accountNumber = document.getElementById("withdrawAccountNumber") ? withdrawAccountNumber.value.trim().replace(/\s+/g,"") : "";
if(currency === "NGN" && !providerCode) return alert("Select bank name");
if(!accountNumber) return alert(currency === "NGN" ? "Enter account number" : "Enter MoMo number");
if(currency === "NGN" && !/^[0-9]{10}$/.test(accountNumber)) return alert("Enter a valid 10-digit Nigerian account number");
if(currency === "GHS" && !/^[0-9]{9,15}$/.test(accountNumber)) return alert("Enter a valid MTN MoMo number");

setLoading("withdrawVerifyBtn", true, "Verifying...");
if(document.getElementById("withdrawVerificationStatus")) withdrawVerificationStatus.innerText = "Verifying account name...";
try{
let endpoint = currency === "NGN" ? "/verify-ngn-bank" : "/verify-ghs-momo";
let result = await callPushBackend(endpoint, {
currency,
bankName: providerName,
bankCode: providerCode,
network: providerName,
accountNumber,
momoNumber: accountNumber
});
if(!result || result.ok === false) throw new Error((result && (result.message || result.error)) || "Verification failed");
let accountName = result.accountName || result.verifiedAccountName || result.momoName || "";
if(!accountName) throw new Error("Verification failed. Account name was not returned.");
let payoutDetails = {
currency,
paymentMethod: currency === "NGN" ? "Bank Transfer" : "MTN Mobile Money",
bankName: currency === "NGN" ? (result.bankName || providerName) : "",
bankCode: currency === "NGN" ? (result.bankCode || providerCode) : "",
network: currency === "GHS" ? "MTN Mobile Money" : "",
accountNumber,
momoNumber: currency === "GHS" ? accountNumber : "",
verifiedAccountName: accountName,
verifiedAt: new Date().toLocaleString(),
verificationProvider: result.provider || (currency === "NGN" ? "Paystack/Flutterwave" : "MoMo Name Enquiry")
};
window.withdrawState.payoutDetails = payoutDetails;
window.withdrawState.payoutVerified = false;
if(document.getElementById("withdrawAccountName")) withdrawAccountName.value = accountName;
if(document.getElementById("withdrawVerifiedConfirm")) withdrawVerifiedConfirm.checked = false;
if(document.getElementById("withdrawVerificationStatus")){
withdrawVerificationStatus.innerHTML = `<b>Verified:</b> ${escapeHtml(accountName)}. Tick confirmation to continue.`;
}
showToast("Account name verified");
}catch(error){
resetWithdrawalVerification();
let message = error.message || "Verification failed";
if(message.toLowerCase().includes("not configured")){
message = currency === "NGN"
? "Bank verification is not configured. Add PAYSTACK_SECRET_KEY or FLUTTERWAVE_SECRET_KEY on PythonAnywhere, then reload the Web app."
: "MoMo verification is not configured. Add GHANA_MOMO_VERIFY_URL on PythonAnywhere, then reload the Web app.";
}
if(message.toLowerCase().includes("pythonanywhere backend")){
message += " Test this URL after reload: "+backendSettings.baseUrl+"/diagnostics/payout-verification";
}
if(document.getElementById("withdrawVerificationStatus")) withdrawVerificationStatus.innerText = "Verification failed: "+message;
alert("Verification failed: "+message);
}finally{
setLoading("withdrawVerifyBtn", false);
}
}

function getWithdrawPreview(){
window.withdrawState = window.withdrawState || {currency:"GHS", balances:{ghs:0, ngn:0}};
let currency = document.getElementById("withdrawCurrency") ? withdrawCurrency.value : window.withdrawState.currency;
let amountValue = moneyInputValue("withdrawAmount");
let field = currency === "NGN" ? "ngn" : "ghs";
let available = Number(window.withdrawState.balances[field] || 0);
return {
currency,
amountValue,
available,
remaining: available - amountValue
};
}

function updateWithdrawPreview(){
if(!document.getElementById("withdrawBalancePreview")) return;
let preview = getWithdrawPreview();
withdrawBalancePreview.innerHTML = `
<div class="flow-summary-grid">
<div><span>Available Balance</span><b>${preview.currency} ${format(preview.available)}</b></div>
<div><span>Withdrawal Amount</span><b>${preview.currency} ${format(preview.amountValue || 0)}</b></div>
<div><span>Balance After Approval</span><b>${preview.currency} ${format(preview.remaining || 0)}</b></div>
</div>
`;
}

function fillWithdrawAll(){
let preview = getWithdrawPreview();
if(preview.available <= 0) return alert("No available "+preview.currency+" balance to withdraw.");
if(!confirm("Withdraw all available "+preview.currency+" balance?\n\nAmount: "+preview.currency+" "+format(preview.available))) return;
if(document.getElementById("withdrawAmount")){
withdrawAmount.dataset.rawValue = String(preview.available);
withdrawAmount.value = formatMoneyDisplay(preview.available, true);
}
updateWithdrawPreview();
}

function goToWithdrawMethodStep(){
let preview = getWithdrawPreview();
if(!preview.amountValue || preview.amountValue <= 0) return alert("Enter a valid withdrawal amount");
if(preview.amountValue > preview.available) return alert("Amount is higher than your available "+preview.currency+" balance");
showWithdrawStep(3);
}

function getWithdrawAccountDetails(){
let currency = document.getElementById("withdrawCurrency") ? withdrawCurrency.value : "GHS";
let payout = window.withdrawState && window.withdrawState.payoutDetails ? window.withdrawState.payoutDetails : null;
return {
paymentMethodValue: currency === "NGN" ? "Bank Transfer" : "MTN Mobile Money",
providerValue: payout ? (payout.bankName || payout.network || "") : (withdrawProvider.value || "").trim(),
providerCode: payout ? (payout.bankCode || "") : selectedWithdrawProviderCode(),
accountNameValue: payout ? payout.verifiedAccountName : "",
accountNumberValue: payout ? payout.accountNumber : (withdrawAccountNumber.value || "").trim(),
payoutDetails: payout,
payoutVerified: !!(window.withdrawState && window.withdrawState.payoutVerified)
};
}

function goToWithdrawReviewStep(){
let preview = getWithdrawPreview();
let account = getWithdrawAccountDetails();
if(!preview.amountValue || preview.amountValue <= 0) return alert("Enter a valid withdrawal amount");
if(preview.amountValue > preview.available) return alert("Insufficient "+preview.currency+" balance");
if(!account.providerValue) return alert("Enter bank or MoMo provider");
if(!account.accountNameValue) return alert("Verify payout account name first");
if(!account.accountNumberValue) return alert("Enter account or MoMo number");
if(!account.payoutDetails || !account.payoutVerified) return alert("Confirm the verified payout name before continuing");

withdrawSummary.innerHTML = `
<div class="flow-summary-grid">
<div><span>Wallet</span><b>${preview.currency}</b></div>
<div><span>Amount</span><b>${preview.currency} ${format(preview.amountValue)}</b></div>
<div><span>Available</span><b>${preview.currency} ${format(preview.available)}</b></div>
<div><span>${preview.currency === "NGN" ? "Bank Name" : "Network"}</span><b>${account.providerValue}</b></div>
<div><span>${preview.currency === "NGN" ? "Verified Account Name" : "Verified MoMo Name"}</span><b>${account.accountNameValue}</b></div>
<div><span>${preview.currency === "NGN" ? "Account Number" : "MoMo Number"}</span><b>${account.accountNumberValue}</b></div>
</div>
`;
showWithdrawStep(4);
}

async function submitWithdrawal(){
if(walletActionBusy) return;
if(!(await ensureAccountCanUseSensitiveAction("withdrawal"))) return;
await loadRateSettings();

let preview = getWithdrawPreview();
let account = getWithdrawAccountDetails();
if(!preview.amountValue || preview.amountValue <= 0) return alert("Enter a valid withdrawal amount");
if(!account.providerValue) return alert("Enter bank or MoMo provider");
if(!account.accountNameValue) return alert("Verify payout account name first");
if(!account.accountNumberValue) return alert("Enter account or MoMo number");
if(!account.payoutDetails || !account.payoutVerified) return alert("Confirm the verified payout name before continuing");
if(!(await hasEnoughBalance(currentUser.uid, preview.currency, preview.amountValue))) return alert("Insufficient "+preview.currency+" balance");
if(!confirm("Submit withdrawal request?\n\nAmount: "+preview.currency+" "+format(preview.amountValue)+"\nMethod: "+account.paymentMethodValue+"\nVerified name: "+account.accountNameValue+"\nAccount: "+account.accountNumberValue)) return;
let pinCheck = await requireWithdrawalPinVerification("Enter your withdrawal PIN to submit this withdrawal request.");
if(!pinCheck) return;

walletActionBusy = true;
setLoading("withdrawBtn", true, "Processing...");

let requestId = createRequestId("WDR");
let payload = {
requestId,
customerId: currentUser.uid,
customerEmail: currentUser.email,
currency: preview.currency,
amount: preview.amountValue,
paymentMethod: account.paymentMethodValue,
paymentProvider: account.providerValue,
paymentProviderCode: account.providerCode || "",
paymentAccountName: account.accountNameValue,
paymentAccountNumber: account.accountNumberValue,
payoutDetails: {
...account.payoutDetails,
amount: preview.amountValue,
userUid: currentUser.uid,
orderId: requestId
},
payoutVerificationStatus: "verified",
payoutVerified: true,
withdrawalPinVerified: true,
availableBalanceAtRequest: preview.available,
balanceAfterApproval: preview.available - preview.amountValue,
clientRequestKey: requestId
};

try{
let requestRef = db.collection("walletRequests").doc(requestId);
let notificationRef = db.collection("notifications").doc();
let now = new Date();
let batch = db.batch();
batch.set(requestRef, {
...payload,
type:"withdraw",
status:"Pending",
createdAt: now.toLocaleString(),
updatedAt: now.toLocaleString()
});
batch.set(notificationRef, {
forRole: "admin",
type: "withdraw",
title: "New withdrawal request",
message: currentUser.email+" requested "+preview.currency+" "+format(preview.amountValue)+" withdrawal.",
requestId,
customerId: currentUser.uid,
createdAt: now.toLocaleString(),
read: false,
...adminOrderNotification("walletRequests", requestId, {type:"withdraw", status:"Pending"})
});
await batch.commit();
localStorage.setItem("activeWithdrawRequestId", requestId);
listenToActiveWithdrawRequest(requestId);
await notifyBackendAdmins(
"New withdrawal request",
currentUser.email+" requested "+preview.currency+" "+format(preview.amountValue)+" withdrawal.",
orderDetailUrl("walletRequests", requestId),
adminOrderNotification("walletRequests", requestId, {type:"withdraw", status:"Pending"}).data
);
showWithdrawStep(5);
showToast("Withdrawal submitted");
}catch(error){
withdrawStatus.innerText = "Could not request withdrawal: "+error.message;
alert("Could not request withdrawal: "+error.message);
}finally{
walletActionBusy = false;
setLoading("withdrawBtn", false);
}
}

function listenToActiveWithdrawRequest(requestId){
if(!requestId) return;
db.collection("walletRequests").doc(requestId).onSnapshot(doc=>{
if(!doc.exists) return;
renderWithdrawLiveStatus({id:doc.id, ...doc.data()});
},error=>{
if(document.getElementById("withdrawLiveStatus")) withdrawLiveStatus.innerText = "Could not load withdrawal status: "+error.message;
});
}

function renderWithdrawLiveStatus(item){
if(!document.getElementById("withdrawLiveStatus")) return;
let status = normalizeWalletStatus(item.status);
let title = "Waiting for Admin Processing";
let message = "Your withdrawal request is in the admin queue.";
if(status === "Processing"){
title = "Withdrawal Processing";
message = "Admin is processing your payout now.";
}
if(status === "Successful" || status === "Paid"){
title = status === "Paid" ? "Withdrawal Paid" : "Withdrawal Completed";
message = "Your withdrawal has been completed.";
localStorage.removeItem("activeWithdrawRequestId");
if(!window.withdrawSuccessRedirected){
window.withdrawSuccessRedirected = true;
setTimeout(()=>{
openTransactionSuccess({
title: status === "Paid" ? "Withdrawal Paid" : "Withdrawal Successful",
message: "Your withdrawal has been completed successfully.",
type: "Withdrawal",
reference: item.requestId || item.id,
amount: (item.currency || "")+" "+format(item.amount || 0),
status: "Completed",
orderCollection: "walletRequests",
orderId: item.id || item.requestId,
details: [
{label:"Provider", value:item.paymentProvider || ""},
{label:"Account Name", value:item.paymentAccountName || ""},
{label:"Account Number", value:item.paymentAccountNumber || ""}
]
});
}, 900);
}
}
if(status === "Failed"){
title = "Withdrawal Rejected";
message = "Your withdrawal could not be completed.";
localStorage.removeItem("activeWithdrawRequestId");
}
if(document.getElementById("withdrawWaitingTitle")) withdrawWaitingTitle.innerText = title;
if(document.getElementById("withdrawWaitingMessage")) withdrawWaitingMessage.innerText = message;
if(document.getElementById("withdrawDoneIcon")) withdrawDoneIcon.innerText = (status === "Successful" || status === "Paid") ? "DONE" : (status === "Failed" ? "REJECTED" : "PENDING");
withdrawLiveStatus.innerHTML = `
<div class="flow-summary-grid">
<div><span>Reference</span><b>${item.requestId || item.id}</b></div>
<div><span>Amount</span><b>${item.currency || ""} ${format(item.amount || 0)}</b></div>
<div><span>Status</span><b>${status}</b></div>
<div><span>Provider</span><b>${item.paymentProvider || ""}</b></div>
<div><span>Account Name</span><b>${item.paymentAccountName || ""}</b></div>
<div><span>Account Number</span><b>${item.paymentAccountNumber || ""}</b></div>
</div>
`;
if(document.getElementById("withdrawRejectionReason")){
withdrawRejectionReason.classList.toggle("hidden", status !== "Failed" || !item.rejectionReason);
withdrawRejectionReason.innerText = item.rejectionReason ? "Reason: "+item.rejectionReason : "";
}
showWithdrawStep(5);
}

function loadWalletHistory(typeValue, targetId){
let target = document.getElementById(targetId);
if(!target) return;

if(typeValue === "internal-transfer"){
let rowsById = {};
let render = ()=>{
let rows = Object.values(rowsById);
rows.sort((a,b)=>String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
displayWalletHistory(rows, target);
};

db.collection("walletRequests").where("senderId","==",currentUser.uid)
.onSnapshot(snap=>{
snap.forEach(doc=>{
let item = {id:doc.id, ...doc.data()};
if(item.type === "internal-transfer") rowsById[doc.id] = item;
});
render();
},error=>{ target.innerHTML = "Could not load history: "+error.message; });

db.collection("walletRequests").where("recipientId","==",currentUser.uid)
.onSnapshot(snap=>{
snap.forEach(doc=>{
let item = {id:doc.id, ...doc.data()};
if(item.type === "internal-transfer") rowsById[doc.id] = item;
});
render();
},error=>{ target.innerHTML = "Could not load history: "+error.message; });
return;
}

db.collection("walletRequests")
.where("customerId","==",currentUser.uid)
.onSnapshot(snap=>{
let rows = [];
snap.forEach(doc=>{
let item = {id:doc.id, ...doc.data()};
if(item.type === typeValue) rows.push(item);
});
rows.sort((a,b)=>String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
displayWalletHistory(rows, target);
},error=>{ target.innerHTML = "Could not load history: "+error.message; });
}

function displayWalletHistory(rows, target){
if(rows.length === 0){
target.innerHTML = "No wallet history yet";
return;
}

let html = "";
rows.forEach(item=>{
let status = normalizeWalletStatus(item.status);
let direction = item.type === "internal-transfer" && item.recipientId === currentUser.uid ? "Received" : walletTypeLabel(item.type);
html += `
<div class="tx-card wallet-card">
<div class="status ${walletStatusClass(status)}">${status}</div>
<div><b>${direction}:</b> ${item.currency || ""} ${format(item.amount || 0)}</div>
<div><b>Reference:</b> ${item.requestId || item.id}</div>
<div><b>Date:</b> ${item.createdAt || ""}</div>
${item.recipientName ? `<div><b>Recipient:</b> ${item.recipientName}</div>` : ""}
${item.apiMessage ? `<div class="help">${item.apiMessage}</div>` : ""}
</div>
`;
});
target.innerHTML = html;
}

function walletTypeLabel(typeValue){
if(typeValue === "deposit") return "Deposit";
if(typeValue === "withdraw") return "Withdrawal";
if(typeValue === "internal-transfer") return "Transfer";
return "Wallet Request";
}

function historyStatusClass(status){
let normalized = String(status || "Pending").toLowerCase();
if(normalized.includes("completed") || normalized.includes("successful")) return "completed";
if(normalized.includes("failed") || normalized.includes("rejected") || normalized.includes("cancelled")) return "paid";
return "pending";
}

function historyStatusLabel(status){
let value = String(status || "Pending");
if(value.toLowerCase() === "approved") return "Settlement In Progress";
if(value.toLowerCase() === "processing") return "Settlement Processing";
if(value.toLowerCase() === "rejected") return "Settlement Rejected";
if(value.toLowerCase() === "successful") return "Successful";
return value;
}

function historyTitle(item){
if(item.historyType === "deposit") return "Deposit";
if(item.historyType === "withdraw") return "Withdrawal";
if(item.historyType === "transfer-sent") return "Transfer Sent";
if(item.historyType === "transfer-received") return "Transfer Received";
if(item.historyType === "wallet-conversion") return item.direction === "GHS_TO_NGN" ? "Wallet Convert GHS to NGN" : "Wallet Convert NGN to GHS";
if(item.historyType === "convert") return item.type === "cedis" ? "Converted GHS to NGN" : "Converted NGN to GHS";
return "Transaction";
}

function historyAmount(item){
if(item.historyType === "wallet-conversion"){
return `${item.sourceCurrency || ""} ${format(item.amount || 0)} -> ${item.destinationCurrency || ""} ${format(item.converted || 0)}`;
}
if(item.historyType === "convert"){
return `${format(item.amount || 0)} -> ${format(item.converted || 0)}`;
}
return `${item.currency || ""} ${format(item.amount || 0)}`;
}

function historyDate(item){
return item.completedAt || item.createdAt || item.created_at || item.date || item.updatedAt || "";
}

async function loadPaymentPage(){
let draft = getDraft();
let activeOrderId = localStorage.getItem("activeConvertOrderId");

if(!draft && !activeOrderId){
alert("Start with the exchange page first");
window.location.href = "exchange.html";
return;
}

currentProfile = await getCustomerProfile();

if(!isProfileComplete(currentProfile)){
alert("Complete your customer profile before payment");
window.location.href = "profile.html";
return;
}

if(!isKycSubmitted(currentProfile)){
alert("Submit your KYC verification before payment");
window.location.href = "kyc.html";
return;
}

if(!isKycApproved(currentProfile)){
alert("Your KYC status is "+getKycStatus(currentProfile)+". Admin must approve your KYC before payment.");
window.location.href = "kyc.html";
return;
}

if(activeOrderId){
let doc = await db.collection("transactions").doc(activeOrderId).get();
if(doc.exists){
listenToActiveConvertOrder(activeOrderId);
return;
}
}

if(draft){
renderPaymentDraftSummary(draft);
}
}

function renderPaymentDraftSummary(draft){
if(!document.getElementById("orderSummary")) return;
let typeLabel = draft.type === "cedis" ? "GHS to NGN" : "NGN to GHS";
let sendCurrency = draft.type === "cedis" ? "GHS" : "NGN";
let receiveCurrency = draft.type === "cedis" ? "NGN" : "GHS";
let rate = draft.type === "cedis" ? draft.rateCedis : draft.rateNaira;

orderSummary.innerHTML = `
<div class="flow-summary-grid">
<div><span>Direction</span><b>${typeLabel}</b></div>
<div><span>You Send</span><b>${sendCurrency} ${format(draft.amount)}</b></div>
<div><span>You Receive</span><b>${receiveCurrency} ${format(draft.converted)}</b></div>
<div><span>Rate Used</span><b>${formatRate(rate)}</b></div>
</div>
`;

if(document.getElementById("methodMtnBtn")){
let isGhsToNgn = draft.type === "cedis";
methodMtnBtn.disabled = !isGhsToNgn;
methodMtnBtn.classList.toggle("disabled", !isGhsToNgn);
if(!isGhsToNgn) methodMtnBtn.querySelector("span").innerText = "Coming Soon for NGN to GHS";
}
}

function selectConvertPaymentMethod(method){
localStorage.setItem("convertPaymentMethod", method);
document.querySelectorAll(".method-card").forEach(card=>card.classList.remove("active"));
if(document.getElementById("methodMtnBtn") && method === "manual-mtn") methodMtnBtn.classList.add("active");
if(document.getElementById("paymentStatus")) paymentStatus.innerText = "";
}

function getPaymentAmount(){
let draft = getDraft();
if(!draft) return 0;

if(draft.type==="cedis") return Number(draft.amount);
return Number(draft.converted);
}

function getPaymentCurrency(){
let draft = getDraft();
if(!draft) return "GHS";

if(draft.type==="cedis") return "GHS";
return "NGN";
}

function getActiveOrderId(){
return localStorage.getItem("activeConvertOrderId") || "";
}

async function getActiveConvertOrder(){
let id = getActiveOrderId();
if(!id) return null;
let doc = await db.collection("transactions").doc(id).get();
return doc.exists ? {id:doc.id, ...doc.data()} : null;
}

function showPaymentStep(step){
["paymentStep3","paymentStep4","paymentStep5","paymentStep6","disputePanel"].forEach(id=>{
let el = document.getElementById(id);
if(el) el.classList.add("hidden");
});
let active = document.getElementById("paymentStep"+step);
if(active) active.classList.remove("hidden");
updateJourneyTracker(step);
}

function updateJourneyTracker(step){
let maxStep = Math.max(step, 3);
let titles = {
3: "Payment Method",
4: "Payment",
5: "Settlement Account",
6: "Waiting for Admin",
7: "Completed"
};
if(document.getElementById("paymentStepCount")) paymentStepCount.innerText = "Step "+Math.min(maxStep, 6)+" of 6";
if(document.getElementById("paymentStepTitle")) paymentStepTitle.innerText = titles[maxStep] || "Payment Method";
["flowP1","flowP2","flowP3","flowP4","flowP5","flowP6","flowP7"].forEach((id,index)=>{
let el = document.getElementById(id);
if(el) el.classList.toggle("active", index + 1 <= maxStep);
});
}

function listenToActiveConvertOrder(orderId){
if(window.activeConvertUnsubscribe) window.activeConvertUnsubscribe();
window.activeConvertUnsubscribe = db.collection("transactions").doc(orderId).onSnapshot(doc=>{
if(!doc.exists) return;
renderConvertOrderFlow({id:doc.id, ...doc.data()});
},error=>{
if(document.getElementById("paymentStatus")) paymentStatus.innerText = "Could not listen to order: "+error.message;
});
}

function convertOrderSummary(order){
let sendCurrency = order.type === "cedis" ? "GHS" : "NGN";
let receiveCurrency = order.type === "cedis" ? "NGN" : "GHS";
let direction = order.type === "cedis" ? "GHS to NGN" : "NGN to GHS";
let rate = order.type === "cedis" ? order.rateCedis || order.atvRate : order.rateNaira || order.atvRate;
return `
<div class="flow-summary-grid">
<div><span>Order ID</span><b>${order.orderID || order.id}</b></div>
<div><span>Status</span><b>${order.status || ""}</b></div>
<div><span>Direction</span><b>${direction}</b></div>
<div><span>Sending</span><b>${sendCurrency} ${format(order.amount || 0)}</b></div>
<div><span>Receiving</span><b>${receiveCurrency} ${format(order.converted || 0)}</b></div>
<div><span>Rate</span><b>${formatRate(rate || 0)}</b></div>
</div>
`;
}

function renderConvertOrderFlow(order){
if(!order) return;
if(document.getElementById("activeOrderSummary")) activeOrderSummary.innerHTML = convertOrderSummary(order);
if(document.getElementById("finalOrderStatus")) finalOrderStatus.innerHTML = convertOrderSummary(order);

let status = String(order.status || "");
if(document.getElementById("rejectionReasonBox")){
rejectionReasonBox.classList.toggle("hidden", !order.rejectionReason);
rejectionReasonBox.innerText = order.rejectionReason ? "Reason: "+order.rejectionReason : "";
}
if(status.includes("Cancelled") || status.includes("Dispute")){
showPaymentStep(4);
if(document.getElementById("paymentInstructionStatus")) paymentInstructionStatus.innerText = status;
if(status.includes("Dispute")) showDisputePanel();
return;
}
if(status.includes("Completed")){
showPaymentStep(7);
if(document.getElementById("waitingTitle")) waitingTitle.innerText = "Completed";
if(document.getElementById("waitingMessage")) waitingMessage.innerText = "Settlement completed successfully. Redirecting to order history soon.";
if(document.getElementById("doneIcon")) doneIcon.innerText = "DONE";
if(document.getElementById("settlementCountdown")) settlementCountdown.classList.add("hidden");
if(!window.completedRedirectTimer){
window.completedRedirectTimer = setTimeout(()=>{ window.location.href = "orders.html"; }, 6000);
}
return;
}
if(status.includes("Rejected")){
showPaymentStep(6);
if(document.getElementById("waitingTitle")) waitingTitle.innerText = "Settlement Rejected";
if(document.getElementById("waitingMessage")) waitingMessage.innerText = "Your settlement was rejected. Please review the reason and contact support if needed.";
if(document.getElementById("doneIcon")) doneIcon.innerText = "!";
if(document.getElementById("settlementCountdown")) settlementCountdown.classList.add("hidden");
if(document.getElementById("supportAfterWaitBtn")) supportAfterWaitBtn.classList.remove("hidden");
return;
}
if(status.includes("Settlement In Progress") || status.includes("Approved")){
showPaymentStep(6);
if(document.getElementById("waitingTitle")) waitingTitle.innerText = "Settlement In Progress";
if(document.getElementById("waitingMessage")) waitingMessage.innerText = "Admin has approved your order. Settlement is now in progress.";
return;
}
if(status.includes("Settlement Processing") || status.includes("Processing")){
showPaymentStep(6);
if(document.getElementById("waitingTitle")) waitingTitle.innerText = "Settlement Processing";
if(document.getElementById("waitingMessage")) waitingMessage.innerText = "Your settlement is being processed.";
return;
}
if(status.includes("Submitted")){
showPaymentStep(6);
if(document.getElementById("waitingTitle")) waitingTitle.innerText = "Waiting for Admin";
if(document.getElementById("waitingMessage")) waitingMessage.innerText = "Your order is submitted and waiting for admin approval.";
startSettlementCountdown(order);
return;
}
if(status.includes("Paid")){
showPaymentStep(5);
loadSavedSettlementAccount();
return;
}
if(status.includes("Created")){
showPaymentStep(4);
startPaymentCountdown(order);
return;
}
showPaymentStep(3);
}

async function createConvertOrder(){
let draft = getDraft();
if(!draft) return alert("Start with the exchange page first");
if(draft.type !== "cedis") return alert("Only MTN Mobile Money for GHS to NGN is active for now. Other methods are coming soon.");

let selectedPaymentMethod = localStorage.getItem("convertPaymentMethod") || "manual-mtn";
let orderID = "ATV-"+Date.now();
let now = Date.now();
let deadline = now + 15 * 60 * 1000;
let profitSnapshot = getOrderProfitSnapshot(draft.type, Number(draft.amount), {
rateCedis: Number(draft.rateCedis || rateSettings.rateCedis),
rateNaira: Number(draft.rateNaira || rateSettings.rateNaira),
costRateCedisToNaira: Number(draft.costRateCedisToNaira || rateSettings.costRateCedisToNaira),
costRateNairaToCedis: Number(draft.costRateNairaToCedis || rateSettings.costRateNairaToCedis)
});

let orderData = {
orderID,
type: draft.type,
orderType: "convert",
amount: Number(draft.amount),
converted: Number(draft.converted),
charges: 0,
customerId: currentUser.uid,
senderName: currentProfile.name,
senderPhone: currentProfile.phone,
customerEmail: currentProfile.email,
customerCountry: currentProfile.country || "",
customerAddress: currentProfile.address || "",
kycStatus: currentProfile.kycStatus || "Submitted",
paymentProvider: selectedPaymentMethod,
paymentMethod: "MTN Mobile Money",
rateCedis: Number(draft.rateCedis || rateSettings.rateCedis),
rateNaira: Number(draft.rateNaira || rateSettings.rateNaira),
costRateCedisToNaira: Number(draft.costRateCedisToNaira || rateSettings.costRateCedisToNaira),
costRateNairaToCedis: Number(draft.costRateNairaToCedis || rateSettings.costRateNairaToCedis),
marketRate: profitSnapshot.marketRate,
atvRate: profitSnapshot.atvRate,
spread: profitSnapshot.spread,
profit: profitSnapshot.profitMade,
profitMade: profitSnapshot.profitMade,
status: "Created / Awaiting Payment",
createdAt: new Date(now).toLocaleString(),
createdAtMs: now,
paymentDeadlineAt: deadline,
paymentDeadlineLabel: new Date(deadline).toLocaleString(),
adminActionHistory: []
};

try{
await db.collection("transactions").doc(orderID).set(orderData);
localStorage.setItem("activeConvertOrderId", orderID);
listenToActiveConvertOrder(orderID);
showToast("Order created");
}catch(error){
if(document.getElementById("paymentStatus")) paymentStatus.innerText = "Could not create order: "+error.message;
alert("Could not create order: "+error.message);
}
}

function formatCountdown(ms){
let total = Math.max(0, Math.floor(ms / 1000));
let minutes = Math.floor(total / 60);
let seconds = total % 60;
return String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
}

function startPaymentCountdown(order){
if(window.paymentCountdownTimer) clearInterval(window.paymentCountdownTimer);
let tick = async ()=>{
let remaining = Number(order.paymentDeadlineAt || 0) - Date.now();
if(document.getElementById("paymentCountdown")) paymentCountdown.innerText = formatCountdown(remaining);
if(remaining <= 0){
clearInterval(window.paymentCountdownTimer);
await expireActiveConvertOrder();
}
};
tick();
window.paymentCountdownTimer = setInterval(tick, 1000);
}

async function expireActiveConvertOrder(){
let order = await getActiveConvertOrder();
if(!order || !String(order.status || "").includes("Created")) return;
await db.collection("transactions").doc(order.id).set({
status: "Cancelled / Payment Time Expired",
expiredAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
},{merge:true});
if(document.getElementById("paymentInstructionStatus")) paymentInstructionStatus.innerText = "Payment time expired. If you already paid, submit a dispute.";
showDisputePanel();
}

async function markConvertOrderPaid(){
let order = await getActiveConvertOrder();
if(!order) return alert("Order not found");
if(!String(order.status || "").includes("Created")) return alert("This order cannot be marked as paid now.");

let sender = manualSenderName.value.trim();
let reference = normalizeDepositTransactionId(manualPaymentReference.value);
if(!sender) return alert("Enter sender name");
if(!reference) return alert("Enter transaction ID");

let usedRef = db.collection("usedPaymentReferences").doc(paymentReferenceDocId(reference));
let orderRef = db.collection("transactions").doc(order.id);

try{
await db.runTransaction(async transaction=>{
let usedDoc = await transaction.get(usedRef);
if(usedDoc.exists) throw new Error(duplicateReferenceMessage());

transaction.set(usedRef, {
reference: paymentReferenceDocId(reference),
originalReference: reference,
status: "processed",
orderType: "convert",
paymentMethod: "manual-mtn-momo",
customerId: currentUser.uid,
customerEmail: currentProfile.email,
senderName: sender,
amount: Number(order.amount),
converted: Number(order.converted),
currency: order.type === "cedis" ? "GHS" : "NGN",
linkedOrderId: order.id,
createdAt: new Date().toLocaleString()
});
transaction.set(orderRef, {
manualSenderName: sender,
paymentReference: reference,
transactionId: reference,
markedPaidAt: new Date().toLocaleString(),
status: "Paid / Awaiting Settlement Account",
updatedAt: new Date().toLocaleString()
},{merge:true});
});

showPaymentStep(5);
loadSavedSettlementAccount();
}catch(error){
if(document.getElementById("paymentInstructionStatus")) paymentInstructionStatus.innerText = error.message;
alert(error.message);
}
}

function loadSavedSettlementAccount(){
if(!currentProfile || !document.getElementById("savedSettlementBox")) return;
let account = currentProfile.settlementAccount || {};
if(account.accName || account.bankName || account.accNumber){
savedSettlementBox.innerHTML = `
<div class="flow-summary-grid">
<div><span>Saved Account</span><b>${account.accName || ""}</b></div>
<div><span>Bank</span><b>${account.bankName || ""}</b></div>
<div><span>Number</span><b>${account.accNumber || ""}</b></div>
</div>
<button class="secondary-link" onclick="useSavedSettlementAccount()">Use Saved Account</button>
`;
accName.value = account.accName || "";
bankName.value = account.bankName || "";
accNumber.value = account.accNumber || "";
}else{
savedSettlementBox.innerHTML = "No saved settlement account yet.";
}
}

function useSavedSettlementAccount(){
if(currentProfile && currentProfile.settlementAccount){
accName.value = currentProfile.settlementAccount.accName || "";
bankName.value = currentProfile.settlementAccount.bankName || "";
accNumber.value = currentProfile.settlementAccount.accNumber || "";
}
}

async function submitSettlementAccount(){
let order = await getActiveConvertOrder();
if(!order) return alert("Order not found");
if(!String(order.status || "").includes("Paid")) return alert("Mark payment as paid before adding settlement account.");
if(!accName.value.trim()) return alert("Enter account name");
if(!bankName.value.trim()) return alert("Enter bank name");
if(!accNumber.value.trim()) return alert("Enter account number");

let account = {
accName: accName.value.trim(),
bankName: bankName.value.trim(),
accNumber: accNumber.value.trim()
};

await Promise.all([
db.collection("users").doc(currentUser.uid).set({settlementAccount: account, updatedAt:new Date().toLocaleString()},{merge:true}),
db.collection("transactions").doc(order.id).set({
...account,
settlementAccount: account,
submittedAt: new Date().toLocaleString(),
status: "Submitted / Awaiting Admin Approval",
updatedAt: new Date().toLocaleString()
},{merge:true})
]);

let updated = await getActiveConvertOrder();
renderConvertOrderFlow(updated);
}

function startSettlementCountdown(order){
if(window.settlementCountdownTimer) clearInterval(window.settlementCountdownTimer);
let end = Date.now() + 5 * 60 * 1000;
let tick = ()=>{
let remaining = end - Date.now();
if(document.getElementById("settlementCountdown")) settlementCountdown.innerText = formatCountdown(remaining);
if(remaining <= 0){
clearInterval(window.settlementCountdownTimer);
if(document.getElementById("supportAfterWaitBtn")) supportAfterWaitBtn.classList.remove("hidden");
}
};
tick();
window.settlementCountdownTimer = setInterval(tick, 1000);
}

function showDisputePanel(){
let panel = document.getElementById("disputePanel");
if(panel) panel.classList.remove("hidden");
}

async function submitOrderDispute(){
let order = await getActiveConvertOrder();
if(!order) return alert("Order not found");
let sender = disputeSenderName.value.trim();
let reference = normalizeDepositTransactionId(disputeTransactionId.value);
let explanation = disputeExplanation.value.trim();
let proofFile = disputeProof.files[0];
if(!sender) return alert("Enter sender name");
if(!reference) return alert("Enter transaction ID");
if(!explanation) return alert("Enter short explanation");

let proofUrl = "";
if(proofFile) proofUrl = await uploadToCloudinary(proofFile, "atv-exchange/disputes");

await db.collection("transactions").doc(order.id).set({
disputeSenderName: sender,
disputeTransactionId: reference,
disputeExplanation: explanation,
disputeProofUrl: proofUrl,
disputeAt: new Date().toLocaleString(),
status: "Dispute Submitted / Waiting for Support",
updatedAt: new Date().toLocaleString()
},{merge:true});

if(document.getElementById("disputeStatus")) disputeStatus.innerText = "Dispute submitted. Support will review it.";
showToast("Dispute submitted");
}

async function contactOrderSupport(){
let order = await getActiveConvertOrder();
if(!order) return;
let message = [
"ATV Exchange support request",
"Order ID: "+(order.orderID || order.id),
"Customer: "+(currentProfile && currentProfile.name ? currentProfile.name : currentUser.email),
"Amount sent: "+format(order.amount || 0),
"Amount expected: "+format(order.converted || 0),
"Status: "+(order.status || "")
].join("\\n");
window.open("https://wa.me/233542632169?text="+encodeURIComponent(message), "_blank");
}

function calculateProfit(typeValue, amountValue, convertedValue){
if(typeValue==="cedis"){
let customerRate = Number(rateSettings.rateCedis);
let costRate = Number(rateSettings.costRateCedisToNaira);
return amountValue * customerRate - amountValue * costRate;
}

let costRate = Number(rateSettings.costRateNairaToCedis);
let businessCost = amountValue / costRate;
return businessCost - convertedValue;
}

function getOrderProfitSnapshot(typeValue, amountValue, tx){
let isCedis = typeValue === "cedis";
let marketRate = isCedis
? Number((tx && (tx.marketRate || tx.costRateCedisToNaira)) || rateSettings.costRateCedisToNaira || rateSettings.rateCedis || 0)
: Number((tx && (tx.marketRate || tx.costRateNairaToCedis)) || rateSettings.costRateNairaToCedis || rateSettings.rateNaira || 0);
let atvRate = isCedis
? Number((tx && (tx.atvRate || tx.rateCedis)) || rateSettings.rateCedis || 0)
: Number((tx && (tx.atvRate || tx.rateNaira)) || rateSettings.rateNaira || 0);
let spread = marketRate - atvRate;
let profitMade = Number(amountValue || 0) * spread;

return {
marketRate,
atvRate,
spread,
profitMade
};
}

async function submitOrder(){
let draft = getDraft();
if(!draft) return alert("Start with the exchange page first");

currentProfile = currentProfile || await getCustomerProfile();

if(!isProfileComplete(currentProfile)) return alert("Complete your customer profile first");
if(!isKycSubmitted(currentProfile)) return alert("Submit your KYC verification first");
if(!isKycApproved(currentProfile)) return alert("Your KYC status is "+getKycStatus(currentProfile)+". Admin must approve your KYC before payment.");
if(!accName.value) return alert("Enter account name");
if(!bankName.value) return alert("Enter bank name");
if(!accNumber.value) return alert("Enter account number");

let selectedPaymentMethod = document.getElementById("convertPaymentMethod") ? convertPaymentMethod.value : "momo-api";
let manualSender = document.getElementById("manualSenderName") ? manualSenderName.value.trim() : "";
let manualReference = document.getElementById("manualPaymentReference") ? normalizeDepositTransactionId(manualPaymentReference.value) : "";
let manualProofFile = document.getElementById("manualPaymentProof") ? manualPaymentProof.files[0] : null;

if(selectedPaymentMethod === "manual-mtn"){
if(!manualSender) return alert("Enter the MTN MoMo sender name");
if(!manualReference) return alert("Enter the MTN MoMo transaction ID / reference ID");
paymentReference = manualReference;
paymentConfirmed = true;
}else{
if(!paymentReference) return alert("Complete online payment first");
if(!paymentConfirmed) return alert("MoMo backend verification is required before submitting this order");
}

let orderID = "ATV-"+Date.now();
rateSettings = {
...rateSettings,
rateCedis: Number(draft.rateCedis || rateSettings.rateCedis),
rateNaira: Number(draft.rateNaira || rateSettings.rateNaira),
costRateCedisToNaira: Number(draft.costRateCedisToNaira || rateSettings.costRateCedisToNaira),
costRateNairaToCedis: Number(draft.costRateNairaToCedis || rateSettings.costRateNairaToCedis)
};
let profit = calculateProfit(draft.type, Number(draft.amount), Number(draft.converted));
let profitSnapshot = getOrderProfitSnapshot(draft.type, Number(draft.amount), {
rateCedis: Number(draft.rateCedis || rateSettings.rateCedis),
rateNaira: Number(draft.rateNaira || rateSettings.rateNaira),
costRateCedisToNaira: Number(draft.costRateCedisToNaira || rateSettings.costRateCedisToNaira),
costRateNairaToCedis: Number(draft.costRateNairaToCedis || rateSettings.costRateNairaToCedis)
});
let proofUrl = "";
if(manualProofFile){
proofUrl = await uploadToCloudinary(manualProofFile, "atv-exchange/orders");
}

let transactionRef = db.collection("transactions").doc(orderID);
let usedRef = db.collection("usedPaymentReferences").doc(paymentReferenceDocId(paymentReference));
let notificationRef = db.collection("notifications").doc();

try{
await db.runTransaction(async transaction=>{
let usedDoc = await transaction.get(usedRef);
if(usedDoc.exists) throw new Error(duplicateReferenceMessage());

transaction.set(usedRef, {
reference: paymentReferenceDocId(paymentReference),
originalReference: paymentReference,
status: "processed",
orderType: "convert",
paymentMethod: selectedPaymentMethod === "manual-mtn" ? "manual-mtn-momo" : "momo-open-api",
customerId: currentUser.uid,
customerEmail: currentProfile.email,
senderName: manualSender || currentProfile.name,
amount: Number(draft.amount),
converted: Number(draft.converted),
currency: draft.type === "cedis" ? "GHS" : "NGN",
linkedOrderId: orderID,
createdAt: new Date().toLocaleString()
});

transaction.set(transactionRef, {
orderID,
type: draft.type,
orderType: "convert",
amount: Number(draft.amount),
converted: Number(draft.converted),
customerId: currentUser.uid,
senderName: currentProfile.name,
senderPhone: currentProfile.phone,
customerEmail: currentProfile.email,
customerCountry: currentProfile.country,
customerAddress: currentProfile.address,
kycStatus: currentProfile.kycStatus || "Submitted",
accName: accName.value,
bankName: bankName.value,
accNumber: accNumber.value,
paymentProvider: selectedPaymentMethod === "manual-mtn" ? "manual-mtn-momo" : "momo-open-api",
momoPhone: document.getElementById("momoPhone") ? momoPhone.value : "",
manualSenderName: manualSender,
paymentReference,
transactionId: paymentReference,
proofUrl,
receiptUrl: proofUrl,
rateCedis: Number(draft.rateCedis || rateSettings.rateCedis),
rateNaira: Number(draft.rateNaira || rateSettings.rateNaira),
costRateCedisToNaira: Number(draft.costRateCedisToNaira || rateSettings.costRateCedisToNaira),
costRateNairaToCedis: Number(draft.costRateNairaToCedis || rateSettings.costRateNairaToCedis),
marketRate: profitSnapshot.marketRate,
atvRate: profitSnapshot.atvRate,
spread: profitSnapshot.spread,
profit: profitSnapshot.profitMade,
profitMade: profitSnapshot.profitMade,
status: "Pending",
date: new Date().toLocaleString()
});

transaction.set(notificationRef, {
forRole: "admin",
type: "convert",
title: "New convert order",
message: currentProfile.email+" submitted convert order "+orderID+" for admin review.",
orderId: orderID,
customerId: currentUser.uid,
createdAt: new Date().toLocaleString(),
read: false,
...adminOrderNotification("transactions", orderID, {type:"convert", status:"Pending"})
});
});
}catch(error){
if(String(error.message || "").includes(duplicateReferenceMessage())){
await notifyFailedPaymentAttempt("Duplicate convert transaction ID", "convert.html", {type:"convert", orderId:orderID, transactionId:paymentReference});
}
alert(error.message || "Could not submit order");
return;
}

await notifyBackendAdmins(
"New convert order",
currentProfile.email+" submitted convert order "+orderID+" for admin review.",
orderDetailUrl("transactions", orderID),
adminOrderNotification("transactions", orderID, {type:"convert", status:"Pending"}).data
);

localStorage.removeItem("exchangeDraft");
alert("Order submitted successfully. Admin will review it inside the dashboard.");
window.location.href = "exchange.html";
}

function loadTransactions(callback){
db.collection("transactions").get().then(snap=>{
allTransactions=[];

snap.forEach(doc=>{
let tx = doc.data();
tx.id = doc.id;
allTransactions.push(tx);
});

callback(allTransactions);
});
}

function adminDateValue(item){
if(item.createdAtMs) return Number(item.createdAtMs);
if(item.paymentDeadlineAt) return Number(item.paymentDeadlineAt);
let raw = item.submittedAt || item.markedPaidAt || item.createdAt || item.date || item.updatedAt || item.reviewedAt || "";
if(raw && raw.toDate) return raw.toDate().getTime();
let parsed = Date.parse(raw);
return Number.isFinite(parsed) ? parsed : 0;
}

function adminQueueStatus(item){
let status = String(item.status || "Pending").toLowerCase();
if(status === "paid") return "closed";
if(status.includes("completed") || status.includes("successful") || status.includes("failed") || status.includes("rejected") || status.includes("cancelled") || status.includes("credited")) return "closed";
if(status === "pending" || status.includes("submitted") || status.includes("awaiting admin")) return "pending";
if(status.includes("created") || status.includes("paid") || status.includes("settlement in progress") || status.includes("settlement processing") || status === "approved" || status === "processing") return "active";
return "closed";
}

function sortAdminQueueRows(rows){
return rows.slice().sort((a,b)=>{
let aStatus = adminQueueStatus(a);
let bStatus = adminQueueStatus(b);
let rank = {pending:0, active:1, closed:2};
if(rank[aStatus] !== rank[bStatus]) return rank[aStatus] - rank[bStatus];

let aTime = adminDateValue(a);
let bTime = adminDateValue(b);
if(aStatus === "pending") return aTime - bTime;
return bTime - aTime;
});
}

function orderDetailUrl(collection, id){
return "order-detail.html?collection="+encodeURIComponent(collection)+"&id="+encodeURIComponent(id || "");
}

function goToOrderDetail(collection, id){
if(!id) return alert("Order ID not found");
window.location.href = orderDetailUrl(collection, id);
}

function goBackFromOrderDetail(){
goToPage(isAdmin ? "dashboard.html" : "orders.html");
}

function compactOrderRow(item, collection, index, title, subtitle, amountText, statusText, customerText){
let statusClass = historyStatusClass(statusText);
return `
<button class="admin-list-row" onclick="goToOrderDetail('${collection}','${item.id || item.requestId || item.orderID || ""}')">
<span class="admin-list-rank">${index + 1}</span>
<span>
<b>${title}</b>
<small>${subtitle}</small>
</span>
<span>${customerText || ""}</span>
<strong>${amountText || ""}</strong>
<em class="status ${statusClass}">${statusText || "Pending"}</em>
</button>
`;
}

function adminListAmount(item){
if(item.type === "manual-deposit") return `${item.currency || ""} ${format(item.amount || 0)}`;
if(item.type === "withdraw") return `${item.currency || ""} ${format(item.amount || 0)}`;
if(item.type === "internal-transfer") return `${item.currency || ""} ${format(item.amount || 0)}`;
if(item.conversionId) return `${item.sourceCurrency || ""} ${format(item.amount || 0)}`;
let currency = item.type === "cedis" ? "GHS" : item.type === "naira" ? "NGN" : (item.currency || item.fromCurrency || "");
return `${currency} ${format(item.amount || item.amountSent || item.customerAmount || 0)}`;
}

function adminListCustomer(item){
return item.customerName || item.username || item.senderName || item.customerEmail || item.senderEmail || item.email || item.customerId || item.userId || "";
}

function adminListTime(item){
return item.submittedAt || item.markedPaidAt || item.createdAt || item.updatedAt || item.completedAt || item.date || "";
}

function adminListTitle(item){
return item.orderID || item.requestId || item.conversionId || item.transactionId || item.id || "Order";
}

function adminListSubtitle(item, label){
return `${label} - ${adminListTime(item) || "No time"}`;
}

function adminRenderListRows(rows, collection, label){
if(!rows.length) return '<div class="admin-empty">No records found for this page.</div>';
return rows.map((item,index)=>{
let status = item.type === "manual-deposit" ? depositStatusLabel(item.status) : item.conversionId ? (item.status || "Completed") : item.type === "withdraw" || item.type === "internal-transfer" ? normalizeWalletStatus(item.status) : (item.status || "Pending");
let realCollection = item.sourceCollection || (item.type === "manual-deposit" ? "deposits" : collection);
return compactOrderRow(
item,
realCollection,
index,
adminListTitle(item),
adminListSubtitle(item, label),
adminListAmount(item),
status,
adminListCustomer(item)
);
}).join("");
}

function applyAdminListSearch(rows, value){
let val = String(value || "").toLowerCase().trim();
if(!val) return rows;
return rows.filter(item => JSON.stringify(item).toLowerCase().includes(val));
}

function setAdminOrderPageState(title, note, rows, collection, label){
let search = document.getElementById("adminOrderSearch");
let query = search ? search.value : "";
let filtered = applyAdminListSearch(rows, query);
let activeRows = sortAdminQueueRows(filtered.filter(item => adminQueueStatus(item) !== "closed"));
let closedRows = sortAdminQueueRows(filtered.filter(item => adminQueueStatus(item) === "closed"));
let displayRows = document.body.dataset.showClosed === "true" ? closedRows : activeRows;
if(document.getElementById("adminOrderPageTitle")) adminOrderPageTitle.innerText = title;
if(document.getElementById("adminOrderPageNote")) adminOrderPageNote.innerText = note;
if(document.getElementById("adminOrderPageCount")) adminOrderPageCount.innerText = String(displayRows.length);
if(document.getElementById("adminOrderList")) adminOrderList.innerHTML = adminRenderListRows(displayRows, collection, label);
window.currentAdminOrderRows = rows;
window.currentAdminOrderMeta = {title, note, collection, label};
}

function rerenderAdminOrderList(){
let meta = window.currentAdminOrderMeta;
if(!meta || !window.currentAdminOrderRows) return;
setAdminOrderPageState(meta.title, meta.note, window.currentAdminOrderRows, meta.collection, meta.label);
}

function loadAdminOrderListPage(kind){
let config = {
deposits:{title:"Deposit Orders", note:"Oldest pending deposits appear first.", collection:"deposits", label:"Deposit"},
converts:{title:"Convert Orders", note:"Oldest pending convert orders appear first.", collection:"transactions", label:"Convert"},
swaps:{title:"Swap Orders", note:"Wallet swaps are monitored separately from manual approval queues.", collection:"walletConversions", label:"Swap"},
withdrawals:{title:"Withdrawal Orders", note:"Oldest pending withdrawals appear first.", collection:"walletRequests", label:"Withdrawal"},
utility:{title:"Utility Bill Approvals", note:"Proof of address submissions for KYC review.", collection:"users", label:"Utility Bill"},
history:{title:"Transaction History", note:"Completed, rejected, failed, cancelled, and credited records.", collection:"transactions", label:"History"}
}[kind];
if(!config || !document.getElementById("adminOrderList")) return;

if(kind === "history") document.body.dataset.showClosed = "true";

let render = rows => setAdminOrderPageState(config.title, config.note, rows, config.collection, config.label);

if(kind === "deposits"){
db.collection("deposits").onSnapshot(snap=>{
let rows = [];
snap.forEach(doc=>rows.push({id:doc.id, type:"manual-deposit", ...doc.data()}));
render(rows);
}, error=>adminOrderList.innerHTML = "Could not load deposits: "+error.message);
return;
}

if(kind === "converts"){
db.collection("transactions").onSnapshot(snap=>{
let rows = [];
snap.forEach(doc=>{
let item = {id:doc.id, ...doc.data()};
if(item.type !== "wallet-conversion") rows.push(item);
});
render(rows);
}, error=>adminOrderList.innerHTML = "Could not load convert orders: "+error.message);
return;
}

if(kind === "swaps"){
db.collection("walletConversions").onSnapshot(snap=>{
let rows = [];
snap.forEach(doc=>rows.push({id:doc.id, ...doc.data()}));
render(rows);
}, error=>adminOrderList.innerHTML = "Could not load swaps: "+error.message);
return;
}

if(kind === "withdrawals"){
db.collection("walletRequests").onSnapshot(snap=>{
let rows = [];
snap.forEach(doc=>{
let item = {id:doc.id, ...doc.data()};
if(item.type === "withdraw") rows.push(item);
});
render(rows);
}, error=>adminOrderList.innerHTML = "Could not load withdrawals: "+error.message);
return;
}

if(kind === "utility"){
db.collection("users").where("kycStatus","==","Submitted").onSnapshot(snap=>{
let rows = [];
snap.forEach(doc=>{
let item = {id:doc.id, requestId:doc.id, type:"utility-bill", status:doc.data().kycStatus, ...doc.data()};
if(item.proofOfAddressUrl) rows.push(item);
});
if(document.getElementById("adminOrderList")){
adminOrderPageTitle.innerText = config.title;
adminOrderPageNote.innerText = config.note;
adminOrderPageCount.innerText = String(rows.length);
adminOrderList.innerHTML = rows.length ? rows.map((item,index)=>`
<button class="admin-list-row" onclick="goToPage('kyc-admin.html')">
<span class="admin-list-rank">${index + 1}</span>
<span><b>${escapeHtml(item.name || item.email || item.id)}</b><small>${escapeHtml(item.proofOfAddressType || "Proof of Address")} - ${escapeHtml(item.updatedAt || item.kycSubmittedAt || "")}</small></span>
<span>${escapeHtml(item.email || "")}</span>
<strong>KYC</strong>
<em class="status pending">Submitted</em>
</button>
`).join("") : '<div class="admin-empty">No utility bill approvals pending.</div>';
}
}, error=>adminOrderList.innerHTML = "Could not load utility approvals: "+error.message);
return;
}

if(kind === "history"){
Promise.all([
db.collection("transactions").get(),
db.collection("walletRequests").get(),
db.collection("deposits").get(),
db.collection("walletConversions").get()
]).then(snaps=>{
let rows = [];
snaps.forEach((snap,snapIndex)=>{
let collection = ["transactions","walletRequests","deposits","walletConversions"][snapIndex];
snap.forEach(doc=>rows.push({id:doc.id, sourceCollection:collection, ...doc.data()}));
});
let closed = rows.filter(item => adminQueueStatus(item) === "closed");
render(closed.map(item=>({...item, id:item.id, requestId:item.requestId || item.id})));
}).catch(error=>adminOrderList.innerHTML = "Could not load history: "+error.message);
}
}

function loadAdminNotificationsPage(){
if(!document.getElementById("adminNotificationsList")) return;
db.collection("notifications").orderBy("createdAtMs","desc").limit(120).onSnapshot(snap=>{
let rows = [];
snap.forEach(doc=>{
let item = {id:doc.id, ...doc.data()};
if(item.role === "admin" || item.forRole === "admin") rows.push(item);
});
adminNotificationsList.innerHTML = rows.length ? rows.map(item=>`
<button class="admin-list-row" onclick='${item.actionLink ? `goToPage(${JSON.stringify(item.actionLink)})` : "return false"}'>
<span class="admin-list-rank">!</span>
<span><b>${escapeHtml(item.title || "Notification")}</b><small>${escapeHtml(item.message || "")}</small></span>
<span>${escapeHtml(notificationGroup(item))}</span>
<strong>${escapeHtml(item.priority || "medium")}</strong>
<em class="status ${item.read ? "completed" : "pending"}">${item.read ? "Read" : "Unread"}</em>
</button>
`).join("") : '<div class="admin-empty">No admin notifications yet.</div>';
}, error=>adminNotificationsList.innerHTML = "Could not load notifications: "+error.message);
}

function orderCollectionForHistory(item){
if(item.historyType === "wallet-conversion") return "walletConversions";
if(item.historyType === "transfer-sent" || item.historyType === "transfer-received") return "walletRequests";
if(item.historyType === "withdraw") return item.requestId && !String(item.id || "").startsWith("WDR-") ? "walletRequests" : "transactions";
if(item.historyType === "deposit"){
if(item.transactionId && !String(item.id || "").startsWith("DEP-")) return "deposits";
if(item.requestId && item.manualMomoDeposit) return "walletRequests";
return "transactions";
}
return "transactions";
}

async function findOrderDocument(collection, id){
let allowed = ["transactions","walletRequests","deposits","walletConversions"];
let collections = collection && allowed.includes(collection) ? [collection] : allowed;
let fieldMap = {
transactions:["orderID","paymentReference","transactionId","requestId"],
walletRequests:["requestId","transactionId","orderID"],
deposits:["requestId","transactionId"],
walletConversions:["conversionId"]
};
for(let name of collections){
let doc = await db.collection(name).doc(id).get();
if(doc.exists) return {collection:name, id:doc.id, data:{id:doc.id, ...doc.data()}};
let fields = fieldMap[name] || [];
for(let field of fields){
let snap = await db.collection(name).where(field,"==",id).limit(1).get();
if(!snap.empty){
let match = snap.docs[0];
return {collection:name, id:match.id, data:{id:match.id, ...match.data()}};
}
}
}
return null;
}

function canViewOrderDetail(item){
if(isAdmin) return true;
if(!currentUser || !item) return false;
let uid = currentUser.uid;
return item.customerId === uid || item.user_id === uid || item.userId === uid || item.senderId === uid || item.recipientId === uid;
}

function detailValue(value){
if(value === undefined || value === null || value === "") return "Not provided";
if(value && value.toDate) return value.toDate().toLocaleString();
if(typeof value === "object") return JSON.stringify(value);
return String(value);
}

function prettyFieldLabel(key){
return String(key || "")
.replace(/([A-Z])/g, " $1")
.replace(/[_-]+/g, " ")
.replace(/\bid\b/ig, "ID")
.replace(/\buid\b/ig, "UID")
.replace(/\bngn\b/ig, "NGN")
.replace(/\bghs\b/ig, "GHS")
.replace(/\bkyc\b/ig, "KYC")
.replace(/\s+/g, " ")
.trim()
.replace(/^./, char => char.toUpperCase());
}

function firstOrderValue(item, keys){
for(let key of keys){
if(item[key] !== undefined && item[key] !== null && item[key] !== "") return item[key];
}
return "";
}

function orderTypeLabel(collection, item){
let type = String(item.type || item.historyType || "").toLowerCase();
if(collection === "deposits" || type.includes("deposit") || item.manualMomoDeposit) return "Deposit";
if(collection === "walletConversions") return "Wallet Swap";
if(type === "withdraw" || type.includes("withdraw")) return "Withdrawal";
if(type.includes("transfer")) return "Internal Transfer";
if(collection === "transactions") return "Convert";
return prettyFieldLabel(collection || "Transaction");
}

function orderDirectionLabel(item){
let raw = item.direction || item.type || item.currencyDirection || item.pair || "";
if(String(raw).includes("cedis-to-naira")) return "GHS to NGN";
if(String(raw).includes("naira-to-cedis")) return "NGN to GHS";
if(String(raw).includes("GHS") || String(raw).includes("NGN")) return String(raw).replace(/->/g, " to ");
let from = item.fromCurrency || item.sourceCurrency || item.currency || "";
let to = item.toCurrency || item.destinationCurrency || item.receiveCurrency || "";
return from && to ? `${from} to ${to}` : "";
}

function orderMoneyText(item, amountKeys, currencyKeys){
let amountValue = firstOrderValue(item, amountKeys);
if(amountValue === "") return "";
let currency = firstOrderValue(item, currencyKeys);
return `${currency ? currency+" " : ""}${Number(amountValue) ? format(amountValue) : detailValue(amountValue)}`;
}

function orderDateText(item){
return detailValue(firstOrderValue(item, ["createdAt","submittedAt","markedPaidAt","completedAt","timestamp","date","created_at"]));
}

function compactDetailRow(label, value, usedKeys, keys){
if(value === "" || value === undefined || value === null) return "";
(keys || []).forEach(key => usedKeys.add(key));
return `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(detailValue(value))}</b></div>`;
}

function orderDetailSection(title, icon, rows){
let cleanRows = rows.filter(Boolean).join("");
if(!cleanRows) return "";
return `
<details class="receipt-more receipt-compact-details">
<summary>${title}</summary>
<div class="receipt-row-grid">${cleanRows}</div>
</details>
`;
}

function withdrawalPayoutRows(item, used){
let payout = item.payoutDetails || {};
if(item.currency === "GHS"){
return [
compactDetailRow("Network", payout.network || item.paymentProvider || "MTN Mobile Money", used, ["payoutDetails.network","paymentProvider"]),
compactDetailRow("MoMo Number", payout.momoNumber || item.paymentAccountNumber || item.accountNumber, used, ["payoutDetails.momoNumber","paymentAccountNumber","accountNumber"]),
compactDetailRow("Verified MoMo Name", payout.verifiedAccountName || item.paymentAccountName, used, ["payoutDetails.verifiedAccountName","paymentAccountName"]),
compactDetailRow("Amount", (item.currency || "GHS")+" "+format(item.amount || 0), used, ["amount","currency"]),
compactDetailRow("User UID", item.customerId || item.userUid, used, ["customerId","userUid"]),
compactDetailRow("PIN Verified", item.withdrawalPinVerified ? "Yes" : "No", used, ["withdrawalPinVerified"])
];
}
return [
compactDetailRow("Bank Name", payout.bankName || item.paymentProvider || item.bankName, used, ["payoutDetails.bankName","paymentProvider","bankName"]),
compactDetailRow("Bank Code", payout.bankCode || item.paymentProviderCode || item.bankCode, used, ["payoutDetails.bankCode","paymentProviderCode","bankCode"]),
compactDetailRow("Account Number", payout.accountNumber || item.paymentAccountNumber || item.accountNumber, used, ["payoutDetails.accountNumber","paymentAccountNumber","accountNumber"]),
compactDetailRow("Verified Account Name", payout.verifiedAccountName || item.paymentAccountName, used, ["payoutDetails.verifiedAccountName","paymentAccountName"]),
compactDetailRow("Amount", (item.currency || "NGN")+" "+format(item.amount || 0), used, ["amount","currency"]),
compactDetailRow("User UID", item.customerId || item.userUid, used, ["customerId","userUid"]),
compactDetailRow("PIN Verified", item.withdrawalPinVerified ? "Yes" : "No", used, ["withdrawalPinVerified"])
];
}

function orderExtraDetails(item, usedKeys){
let hidden = new Set(["adminActionHistory", ...Array.from(usedKeys)]);
let rows = Object.keys(item)
.filter(key => !hidden.has(key))
.sort()
.map(key => `<div><span>${escapeHtml(prettyFieldLabel(key))}</span><b>${escapeHtml(detailValue(item[key]))}</b></div>`)
.join("");
if(!rows) return "";
return `
<details class="receipt-more">
<summary>View More Details</summary>
<div class="receipt-row-grid">${rows}</div>
</details>
`;
}

function orderProofLinks(item){
let links = [
["Screenshot Proof", item.screenshot],
["Payment Proof", item.proofUrl],
["Receipt", item.receiptUrl],
["ID Verification", item.idVerificationUrl || item.kycDocumentUrl],
["Proof of Address", item.proofOfAddressUrl]
].filter(link => link[1]);

if(links.length === 0) return '<div class="receipt-empty">No proof uploaded</div>';
return `<div class="order-proof-links">${links.map(link => `<a class="link" href="${escapeHtml(link[1])}" target="_blank">${escapeHtml(link[0])}</a>`).join("")}</div>`;
}

function renderOrderReceipt(collection, item, foundId){
let used = new Set(["id"]);
let title = item.orderID || item.requestId || item.conversionId || item.transactionId || foundId;
let status = item.status || "Pending";
let customer = item.customerName || item.username || item.senderName || item.customerEmail || item.senderEmail || item.customerId || "";
let typeLabel = orderTypeLabel(collection, item);
let direction = orderDirectionLabel(item);
let sent = orderMoneyText(item, ["amountSent","amount","customerAmount","amountValue","sendAmount","debitAmount"], ["currency","fromCurrency","sourceCurrency"]);
let received = orderMoneyText(item, ["amountReceiving","converted","receiveAmount","creditAmount","amountReceived"], ["toCurrency","receiveCurrency","destinationCurrency"]);
let rate = firstOrderValue(item, ["exchangeRate","rate","rateUsed","rateCedis","rateNaira","atvRate"]);
let created = orderDateText(item);
let receiptData = buildReceiptDownloadData({
collection,
id: foundId || item.id || title,
title,
type: typeLabel,
reference: title,
status,
amount: sent || received || "",
received,
rate,
customer,
date: item.completedAt || item.creditedAt || item.updatedAt || item.createdAt || created
});
window.currentOrderReceiptDownload = receiptData;
let receiptButton = isSuccessfulReceiptStatus(status)
? `<div class="receipt-action-row"><button class="receipt-download-btn" onclick="downloadCurrentOrderReceipt()">Download Receipt</button><button class="outline-btn" onclick="shareCurrentOrderReceipt()">Share Receipt</button></div>`
: "";

let heroRows = [
compactDetailRow("Type", typeLabel, used, ["type","historyType"]),
compactDetailRow("Direction", direction, used, ["direction","currencyDirection","pair","fromCurrency","toCurrency","sourceCurrency","destinationCurrency","receiveCurrency"]),
compactDetailRow("Sent", sent, used, ["amountSent","amount","customerAmount","amountValue","sendAmount","debitAmount","currency"]),
compactDetailRow("Receiving", received, used, ["amountReceiving","converted","receiveAmount","creditAmount","amountReceived"]),
compactDetailRow("Rate", rate, used, ["exchangeRate","rate","rateUsed","rateCedis","rateNaira","atvRate"]),
compactDetailRow("Date", created, used, ["createdAt","submittedAt","markedPaidAt","completedAt","timestamp","date","created_at"])
];

let paymentRows = [
compactDetailRow("Method", firstOrderValue(item, ["paymentMethod","method","depositMethod","withdrawalMethod"]), used, ["paymentMethod","method","depositMethod","withdrawalMethod"]),
compactDetailRow("Sender Name", firstOrderValue(item, ["senderName","sender_name","payerName"]), used, ["senderName","sender_name","payerName"]),
compactDetailRow("Transaction ID", firstOrderValue(item, ["transactionId","transactionID","reference","referenceId","paymentReference"]), used, ["transactionId","transactionID","reference","referenceId","paymentReference"]),
compactDetailRow("Settlement Account", firstOrderValue(item, ["settlementAccountName","paymentAccountName","accountName"]), used, ["settlementAccountName","paymentAccountName","accountName"]),
compactDetailRow("Account Number", firstOrderValue(item, ["settlementAccountNumber","paymentAccountNumber","accountNumber"]), used, ["settlementAccountNumber","paymentAccountNumber","accountNumber"]),
compactDetailRow("Bank/Provider", firstOrderValue(item, ["settlementBank","paymentProvider","bankName","provider"]), used, ["settlementBank","paymentProvider","bankName","provider"])
];

let payoutRows = item.type === "withdraw" ? withdrawalPayoutRows(item, used) : [];

let customerRows = [
compactDetailRow("Name", firstOrderValue(item, ["customerName","username","name","senderName"]), used, ["customerName","username","name"]),
compactDetailRow("Email", firstOrderValue(item, ["customerEmail","email","senderEmail"]), used, ["customerEmail","email","senderEmail"]),
compactDetailRow("Phone", firstOrderValue(item, ["customerPhone","phone","senderPhone"]), used, ["customerPhone","phone","senderPhone"]),
compactDetailRow("Customer ID", firstOrderValue(item, ["customerId","userId","user_id","senderId","recipientId"]), used, ["customerId","userId","user_id","senderId","recipientId"])
];

let transactionIdValue = firstOrderValue(item, ["transactionId","transactionID","reference","referenceId","paymentReference","requestId","orderID"]);
let senderValue = firstOrderValue(item, ["senderName","sender_name","payerName","customerName","username","name","customerEmail","senderEmail"]) || customer;
let recipientValue = firstOrderValue(item, ["recipientName","recipientEmail","settlementAccountName","paymentAccountName","accountName","settlementAccountNumber","paymentAccountNumber","recipientId"]);
receiptData.transactionId = transactionIdValue || title;
receiptData.sender = senderValue;
receiptData.recipient = recipientValue;
receiptData.customer = senderValue;
window.currentOrderReceiptDownload = receiptData;

return `
<div class="receipt-hero">
<div class="receipt-hero-top">
<div>
<span class="admin-kicker">${escapeHtml(collection)}</span>
<h2>${escapeHtml(title)}</h2>
<p>${escapeHtml(customer || typeLabel)}</p>
</div>
<em class="status receipt-status ${historyStatusClass(status)}">${historyStatusLabel(status)}</em>
</div>
<div class="receipt-id-strip">Receipt ID: <b>${escapeHtml(receiptData.receiptId)}</b></div>
<div class="receipt-amount-row">
<span>${escapeHtml(typeLabel)}</span>
<strong>${escapeHtml(sent || received || "Amount not provided")}</strong>
</div>
</div>

<div class="receipt-mini-grid">${heroRows.filter(Boolean).slice(0, 4).join("")}</div>
${receiptButton}
${orderDetailSection("Payment Details", "&bull;", paymentRows)}
${payoutRows.length ? orderDetailSection(item.currency === "GHS" ? "MoMo Payout Details" : "Bank Payout Details", "&bull;", payoutRows) : ""}
${orderDetailSection("Customer Details", "&bull;", customerRows)}

<details class="receipt-more receipt-compact-details">
<summary>Uploaded Receipt / Proof</summary>
${orderProofLinks(item)}
</details>

${item.rejectionReason ? `<div class="receipt-alert">Rejection reason: ${escapeHtml(item.rejectionReason)}</div>` : ""}

${orderDetailActions(collection, item)}
${orderExtraDetails(item, used)}
`;
}

function orderDetailActions(collection, item){
if(!isAdmin) return "";
let status = String(item.status || "").toLowerCase();
let closed = adminQueueStatus(item) === "closed";
let payoutButton = collection === "walletRequests" && item.type === "withdraw" ? `<button class="outline-btn" onclick="copyWithdrawalPayoutDetails('${item.id || item.requestId || ""}')">Copy Payout Details</button>` : "";
if(closed) return '<div class="admin-queue-note">This order is closed and stored in records.</div>'+payoutButton;

if(collection === "transactions"){
return `
<div class="admin-actions">
<button onclick="detailMarkOrderStatus('${item.id}','Settlement In Progress')">Approve</button>
<button onclick="detailMarkOrderStatus('${item.id}','Settlement Processing')">Processing</button>
<button onclick="detailMarkOrderStatus('${item.id}','Completed')">Completed</button>
<button class="danger-btn" onclick="detailMarkOrderStatus('${item.id}','Settlement Rejected')">Reject</button>
</div>
`;
}

if(collection === "deposits"){
return `
<div class="admin-actions">
<button onclick="detailDepositProcessing('${item.id}')">Processing</button>
<button onclick="detailApproveDeposit('${item.id}')">Approve Deposit</button>
<button class="danger-btn" onclick="detailRejectDeposit('${item.id}')">Reject Deposit</button>
</div>
`;
}

if(collection === "walletRequests" && item.type === "withdraw"){
return `
<div class="admin-actions">
${payoutButton}
<button onclick="detailWithdrawalProcessing('${item.id}')">Approve / Processing</button>
<button onclick="detailCompleteWithdrawal('${item.id}')">Mark as Paid</button>
<button class="danger-btn" onclick="detailRejectWithdrawal('${item.id}')">Reject Withdrawal</button>
</div>
`;
}

if(status.includes("pending") || status.includes("processing")){
return '<div class="admin-queue-note">This record is visible for monitoring. No direct admin action is required here.</div>';
}

return "";
}

async function reloadOrderDetailSoon(){
setTimeout(()=>loadOrderDetailPage(), 600);
}

async function detailMarkOrderStatus(id, status){
await markOrderStatus(id, status);
reloadOrderDetailSoon();
}

async function detailDepositProcessing(id){
await markDepositProcessing(id);
reloadOrderDetailSoon();
}

async function detailApproveDeposit(id){
await approveManualDeposit(id);
reloadOrderDetailSoon();
}

async function detailRejectDeposit(id){
await rejectManualDeposit(id);
reloadOrderDetailSoon();
}

async function detailWithdrawalProcessing(id){
await markWithdrawalProcessing(id);
reloadOrderDetailSoon();
}

async function detailCompleteWithdrawal(id){
await completeWithdrawal(id);
reloadOrderDetailSoon();
}

async function detailRejectWithdrawal(id){
await rejectWithdrawal(id);
reloadOrderDetailSoon();
}

async function copyWithdrawalPayoutDetails(id){
try{
let doc = await db.collection("walletRequests").doc(id).get();
if(!doc.exists) return alert("Withdrawal request not found");
let item = {id:doc.id, ...doc.data()};
let payout = item.payoutDetails || {};
let isGhs = item.currency === "GHS";
let text = isGhs
? `GHS WITHDRAWAL MOMO PAYOUT DETAILS

Network: ${payout.network || item.paymentProvider || "MTN Mobile Money"}
Momo Number: ${payout.momoNumber || item.paymentAccountNumber || ""}
Momo Name: ${payout.verifiedAccountName || item.paymentAccountName || ""}
Amount: ${item.currency || "GHS"} ${format(item.amount || 0)}
Order ID: ${item.requestId || item.id || ""}
User UID: ${item.customerId || ""}`
: `NGN WITHDRAWAL PAYOUT DETAILS

Bank Name: ${payout.bankName || item.paymentProvider || ""}
Account Number: ${payout.accountNumber || item.paymentAccountNumber || ""}
Account Name: ${payout.verifiedAccountName || item.paymentAccountName || ""}
Amount: ${item.currency || "NGN"} ${format(item.amount || 0)}
Order ID: ${item.requestId || item.id || ""}
User UID: ${item.customerId || ""}`;
if(navigator.clipboard && navigator.clipboard.writeText){
await navigator.clipboard.writeText(text);
showToast("Payout details copied");
}else{
prompt("Copy payout details", text);
}
}catch(error){
alert("Could not copy payout details: "+error.message);
}
}

async function loadOrderDetailPage(){
let box = document.getElementById("orderDetailBox");
if(!box) return;

let params = new URLSearchParams(window.location.search);
let collection = params.get("collection") || "";
let id = params.get("id") || "";

if(!id){
box.innerHTML = '<div class="admin-empty">Order ID was not provided.</div>';
return;
}

try{
let found = await findOrderDocument(collection, id);
if(!found){
box.innerHTML = '<div class="admin-empty">Order not found.</div>';
return;
}

let item = found.data;
if(!canViewOrderDetail(item)){
box.innerHTML = '<div class="admin-empty">You do not have permission to view this order.</div>';
return;
}

box.innerHTML = renderOrderReceipt(found.collection, item, found.id);
}catch(error){
box.innerHTML = '<div class="admin-empty">Could not load order details: '+error.message+'</div>';
}
}

function loadDashboard(){
if(document.getElementById("adminPendingCounters")) setupAdminPendingCounters();
}

function setupAdminPendingCounters(){
if(window.adminCounterUnsubscribes) window.adminCounterUnsubscribes.forEach(unsubscribe=>unsubscribe && unsubscribe());
window.adminCounterUnsubscribes = [];

function setCounter(id, count){
let el = document.getElementById(id);
if(el) el.innerText = String(count);
}

window.adminCounterUnsubscribes.push(db.collection("users").where("kycStatus","==","Submitted").onSnapshot(snap=>setCounter("pendingKycCount", snap.size), error=>appLog("KYC counter skipped", error.message)));
window.adminCounterUnsubscribes.push(db.collection("deposits").onSnapshot(snap=>{
let count = 0;
snap.forEach(doc=>{
let status = String((doc.data() || {}).status || "").toLowerCase();
if(["created","payment submitted","pending","verification","processing"].includes(status)) count++;
});
setCounter("pendingDepositCount", count);
}, error=>appLog("Deposit counter skipped", error.message)));
window.adminCounterUnsubscribes.push(db.collection("walletRequests").onSnapshot(snap=>{
let withdrawals = 0;
snap.forEach(doc=>{
let item = doc.data() || {};
let status = String(item.status || "").toLowerCase();
if(item.type === "withdraw" && ["pending","processing"].includes(status)) withdrawals++;
});
setCounter("pendingWithdrawCount", withdrawals);
}, error=>appLog("Wallet counter skipped", error.message)));
window.adminCounterUnsubscribes.push(db.collection("transactions").onSnapshot(snap=>{
let count = 0;
snap.forEach(doc=>{
let status = String((doc.data() || {}).status || "").toLowerCase();
if(status.includes("pending") || status.includes("awaiting") || status.includes("paid")) count++;
});
setCounter("pendingConvertCount", count);
}, error=>appLog("Convert counter skipped", error.message)));
window.adminCounterUnsubscribes.push(db.collection("supportThreads").onSnapshot(snap=>{
let count = 0;
snap.forEach(doc=>{
let status = String((doc.data() || {}).status || "Open").toLowerCase();
if(status !== "resolved") count++;
});
setCounter("pendingSupportCount", count);
}, error=>appLog("Support counter skipped", error.message)));
window.adminCounterUnsubscribes.push(db.collection("walletConversions").onSnapshot(snap=>{
let count = 0;
snap.forEach(doc=>{
let status = String((doc.data() || {}).status || "").toLowerCase();
if(status && !status.includes("completed") && !status.includes("failed")) count++;
});
setCounter("pendingSwapCount", count);
}, error=>appLog("Swap counter skipped", error.message)));
}

function profitCalculationValues(){
let marketRate = Number(document.getElementById("profitMarketRate") ? profitMarketRate.value : 0);
let atvRate = Number(document.getElementById("profitAtvRate") ? profitAtvRate.value : 0);
let customerAmount = Number(document.getElementById("profitCustomerAmount") ? profitCustomerAmount.value : 0);
let fees = Number(document.getElementById("profitFees") ? profitFees.value : 0);
let spread = marketRate - atvRate;
let margin = marketRate ? (spread / marketRate) * 100 : 0;
let grossProfit = customerAmount * spread;
let netProfit = grossProfit - fees;

return {
marketRate,
atvRate,
customerAmount,
fees,
spread,
margin,
grossProfit,
netProfit
};
}

function calculateProfitMargin(){
if(!document.getElementById("profitSpread")) return null;
let values = profitCalculationValues();

profitSpread.innerText = formatRate(values.spread);
profitMarginPercent.innerText = formatPercent(values.margin);
profitGross.innerText = format(values.grossProfit);
profitNet.innerText = format(values.netProfit);

return values;
}

function loadProfitHistory(){
try{
return JSON.parse(localStorage.getItem("atvProfitCalculationHistory") || "[]");
}catch(error){
return [];
}
}

function saveProfitHistory(history){
localStorage.setItem("atvProfitCalculationHistory", JSON.stringify(history.slice(0, 20)));
}

function renderProfitHistory(){
if(!document.getElementById("profitHistoryList")) return;

let history = loadProfitHistory();
let totalNet = history.reduce((sum,item)=>sum + Number(item.netProfit || 0), 0);

profitHistoryTotal.innerText = format(totalNet);
profitHistoryCount.innerText = history.length+" calculation"+(history.length === 1 ? "" : "s");

if(history.length === 0){
profitHistoryList.innerHTML = "No saved calculations yet";
return;
}

profitHistoryList.innerHTML = history.map(item=>`
<div class="profit-history-item">
<div>
<b>${format(item.customerAmount)} at ATV ${formatRate(item.atvRate)}</b>
<span>Market ${formatRate(item.marketRate)} | Spread ${formatRate(item.spread)} | Margin ${formatPercent(item.margin)}</span>
</div>
<strong>${format(item.netProfit)}</strong>
<small>${item.createdAt || ""}</small>
</div>
`).join("");
}

function saveProfitCalculation(){
if(!document.getElementById("profitSpread")) return;
let values = calculateProfitMargin();
if(!values.marketRate || !values.atvRate || !values.customerAmount){
return alert("Enter Market Rate, ATV Rate, and Customer Amount first.");
}

let history = loadProfitHistory();
history.unshift({
...values,
createdAt: new Date().toLocaleString()
});
saveProfitHistory(history);
renderProfitHistory();
showToast("Profit calculation saved");
}

function clearProfitCalculator(){
["profitMarketRate","profitAtvRate","profitCustomerAmount","profitFees"].forEach(id=>{
let input = document.getElementById(id);
if(input) input.value = "";
});
calculateProfitMargin();
}

function clearProfitHistory(){
if(!confirm("Clear saved profit calculation history?")) return;
localStorage.removeItem("atvProfitCalculationHistory");
renderProfitHistory();
}

function loadProfitCalculator(){
if(!document.getElementById("profitSpread")) return;
calculateProfitMargin();
renderProfitHistory();
}

function displayTransactions(data){
data = data.filter(tx => tx.type !== "wallet-conversion");
if(data.length===0){
transactions.innerHTML='<div class="admin-empty">No exchange orders yet</div>';
if(document.getElementById("exchangeRecords")) exchangeRecords.innerHTML = '<div class="admin-empty">No completed exchange records yet</div>';
return;
}

let html="";
let activeRows = sortAdminQueueRows(data.filter(tx => adminQueueStatus(tx) !== "closed"));
let recordRows = sortAdminQueueRows(data.filter(tx => adminQueueStatus(tx) === "closed"));
let summary = {
total: data.length,
pending: data.filter(tx => adminQueueStatus(tx) === "pending").length,
active: data.filter(tx => adminQueueStatus(tx) === "active").length,
closed: data.filter(tx => adminQueueStatus(tx) === "closed").length
};

html += `
<div class="admin-summary-grid">
<div><b>${summary.total}</b><span>Total Orders</span></div>
<div><b>${summary.pending}</b><span>Pending FCFS</span></div>
<div><b>${summary.active}</b><span>In Progress</span></div>
<div><b>${summary.closed}</b><span>Closed</span></div>
</div>
<div class="admin-queue-note">Active orders only. Completed, rejected, failed, and cancelled orders move to records below.</div>
`;

if(activeRows.length === 0){
html += '<div class="admin-empty">No active exchange orders. Closed orders are in records.</div>';
}

activeRows.forEach((tx,index)=>{
let typeLabel = tx.type === "cedis" ? "Cedis -> Naira" : "Naira -> Cedis";
html += compactOrderRow(
tx,
"transactions",
index,
tx.orderID || tx.id || "Order",
typeLabel+" - "+(tx.createdAt || tx.date || ""),
(tx.type === "cedis" ? "GHS " : "NGN ")+format(tx.amount || 0),
tx.status || "Pending",
tx.senderName || tx.customerEmail || ""
);
});

transactions.innerHTML=html;
renderExchangeRecords(recordRows);
}

function renderExchangeRecords(rows){
if(!document.getElementById("exchangeRecords")) return;
if(rows.length === 0){
exchangeRecords.innerHTML = '<div class="admin-empty">No completed exchange records yet</div>';
return;
}

let html = '<div class="admin-queue-note">Latest closed exchange orders. These records no longer block the approval queue.</div>';
rows.slice(0, 80).forEach((tx,index)=>{
let statusClass = tx.status === "Completed" ? "completed" : "paid";
let typeLabel = tx.type === "cedis" ? "Cedis -> Naira" : "Naira -> Cedis";
let marketRate = Number(tx.marketRate || 0);
let atvRate = Number(tx.atvRate || 0);
let spread = marketRate - atvRate;
let profitMade = Number(tx.amount || 0) * spread;
html += `
<div class="admin-order-card closed">
<div class="admin-order-main">
<div class="admin-order-rank">${index + 1}</div>
<div>
<div class="admin-order-title">${tx.orderID || tx.id || "Order"}</div>
<div class="admin-order-sub">${typeLabel} - ${tx.completedAt || tx.updatedAt || tx.date || tx.createdAt || ""}</div>
</div>
<div class="status ${statusClass}">${tx.status || "Closed"}</div>
</div>
<div class="admin-order-grid">
<div><span>Amount Sent</span><b>${tx.type === "cedis" ? "GHS" : "NGN"} ${format(tx.amount)}</b></div>
<div><span>Customer Receives</span><b>${format(tx.converted)}</b></div>
<div><span>Customer</span><b>${tx.senderName || tx.customerEmail || ""}</b><small>${tx.senderPhone || ""}</small></div>
<div><span>Market Rate</span><b>${formatRate(marketRate)}</b></div>
<div><span>App Rate</span><b>${formatRate(atvRate)}</b></div>
<div><span>Profit</span><b>${format(profitMade)}</b></div>
</div>
<button class="outline-btn" onclick="goToOrderDetail('transactions','${tx.id || tx.orderID || ""}')">View Details</button>
</div>
`;
});
exchangeRecords.innerHTML = html;
}

function searchTx(){
let val = searchInput.value.toLowerCase();

let filtered = allTransactions.filter(tx => tx.type !== "wallet-conversion").filter(tx =>
(tx.orderID && tx.orderID.toLowerCase().includes(val)) ||
(tx.accName && tx.accName.toLowerCase().includes(val)) ||
(tx.senderName && tx.senderName.toLowerCase().includes(val)) ||
(tx.senderPhone && tx.senderPhone.toLowerCase().includes(val))
);

displayTransactions(filtered);
}

function loadWalletConversionsAdmin(){
if(!document.getElementById("walletConversionsAdmin")) return;

db.collection("walletConversions").onSnapshot(snap=>{
allWalletConversionsAdmin = [];
snap.forEach(doc=>{
allWalletConversionsAdmin.push({id:doc.id, ...doc.data()});
});
displayWalletConversionsAdmin(allWalletConversionsAdmin);
},error=>{
walletConversionsAdmin.innerHTML = "Could not load wallet conversions: "+error.message;
});
}

function displayWalletConversionsAdmin(rows){
if(!document.getElementById("walletConversionsAdmin")) return;
if(rows.length === 0){
walletConversionsAdmin.innerHTML = '<div class="admin-empty">No wallet conversions yet</div>';
return;
}

let completed = rows.filter(item => String(item.status || "").toLowerCase() === "completed");
let failed = rows.filter(item => String(item.status || "").toLowerCase() === "failed");
let totalVolume = completed.reduce((sum,item)=>sum + Number(item.amount || 0), 0);
let totalProfit = completed.reduce((sum,item)=>sum + Number(item.profitMade || 0), 0);
let sorted = rows.slice().sort((a,b)=>String(historyDate(b)).localeCompare(String(historyDate(a))));

let html = `
<div class="admin-summary-grid">
<div><b>${completed.length}</b><span>Completed</span></div>
<div><b>${failed.length}</b><span>Failed</span></div>
<div><b>${format(totalVolume)}</b><span>Total Volume</span></div>
<div><b>${format(totalProfit)}</b><span>Profit Made</span></div>
</div>
<div class="admin-queue-note">Wallet-to-wallet conversions are instant and do not need admin approval.</div>
`;

sorted.slice(0, 80).forEach((item,index)=>{
let direction = item.direction === "GHS_TO_NGN" ? "GHS Wallet -> NGN Wallet" : "NGN Wallet -> GHS Wallet";
let statusClass = String(item.status || "").toLowerCase() === "completed" ? "completed" : "paid";
html += `
<div class="admin-order-card ${statusClass === "completed" ? "closed" : "active"}">
<div class="admin-order-main">
<div class="admin-order-rank">${index + 1}</div>
<div>
<div class="admin-order-title">${item.conversionId || item.id}</div>
<div class="admin-order-sub">${direction} - ${historyDate(item)}</div>
</div>
<div class="status ${statusClass}">${item.status || "Completed"}</div>
</div>
<div class="admin-order-grid">
<div><span>Customer</span><b>${item.customerEmail || item.customerId || ""}</b></div>
<div><span>Converted</span><b>${item.sourceCurrency || ""} ${format(item.amount || 0)}</b></div>
<div><span>Received</span><b>${item.destinationCurrency || ""} ${format(item.converted || 0)}</b></div>
<div><span>Rate Used</span><b>${formatRate(item.rateUsed || 0)}</b></div>
<div><span>Spread</span><b>${formatRate(item.spread || 0)}</b></div>
<div><span>Profit</span><b>${format(item.profitMade || 0)}</b></div>
</div>
${item.failureReason ? `<div class="help">${item.failureReason}</div>` : ""}
</div>
`;
});

walletConversionsAdmin.innerHTML = html;
}

function searchWalletConversionsAdmin(){
let input = document.getElementById("walletConvertAdminSearch");
let val = input ? input.value.toLowerCase().trim() : "";
let filtered = allWalletConversionsAdmin.filter(item =>
(item.conversionId && item.conversionId.toLowerCase().includes(val)) ||
(item.customerEmail && item.customerEmail.toLowerCase().includes(val)) ||
(item.customerId && item.customerId.toLowerCase().includes(val)) ||
(item.direction && item.direction.toLowerCase().includes(val)) ||
(item.status && item.status.toLowerCase().includes(val))
);
displayWalletConversionsAdmin(filtered);
}

function loadAdminWalletRequests(){
if(!document.getElementById("walletRequestsAdmin")) return;

db.collection("walletRequests").onSnapshot(snap=>{
allWalletRequests = [];
snap.forEach(doc=>{
let item = doc.data();
item.id = doc.id;
if(item.manualMomoDeposit) return;
allWalletRequests.push(item);
});
displayAdminWalletRequests(sortAdminQueueRows([...allDepositRequests, ...allWalletRequests]));
},error=>{
walletRequestsAdmin.innerHTML = "Could not load wallet activity: "+error.message;
});

db.collection("deposits").onSnapshot(snap=>{
allDepositRequests = [];
snap.forEach(doc=>{
let item = doc.data();
item.id = doc.id;
item.type = "manual-deposit";
allDepositRequests.push(item);
});
displayAdminWalletRequests(sortAdminQueueRows([...allDepositRequests, ...allWalletRequests]));
},error=>{
walletRequestsAdmin.innerHTML = "Could not load manual deposits: "+error.message;
});
}

function displayAdminWalletRequests(rows){
if(!document.getElementById("walletRequestsAdmin")) return;
if(rows.length === 0){
walletRequestsAdmin.innerHTML = '<div class="admin-empty">No wallet activity yet</div>';
if(document.getElementById("walletRecordsAdmin")) walletRecordsAdmin.innerHTML = '<div class="admin-empty">No completed wallet records yet</div>';
return;
}

let activeRows = sortAdminQueueRows(rows.filter(item => adminQueueStatus(item) !== "closed"));
let recordRows = sortAdminQueueRows(rows.filter(item => adminQueueStatus(item) === "closed"));
let summary = {
deposit: rows.filter(item => item.type === "deposit" || item.type === "manual-deposit").length,
withdraw: rows.filter(item => item.type === "withdraw").length,
transfer: rows.filter(item => item.type === "internal-transfer").length,
pending: rows.filter(item => item.type === "manual-deposit" ? item.status === "pending" : normalizeWalletStatus(item.status) === "Pending").length,
successful: rows.filter(item => {
if(item.type === "manual-deposit") return item.status === "approved";
let status = normalizeWalletStatus(item.status);
return status === "Successful" || status === "Paid";
}).length,
failed: rows.filter(item => item.type === "manual-deposit" ? item.status === "rejected" : normalizeWalletStatus(item.status) === "Failed").length
};

let html = `
<div class="admin-summary-grid">
<div><b>${summary.deposit}</b><span>Deposits</span></div>
<div><b>${summary.withdraw}</b><span>Withdrawals</span></div>
<div><b>${summary.transfer}</b><span>Transfers</span></div>
<div><b>${summary.pending}</b><span>Pending</span></div>
<div><b>${summary.successful}</b><span>Successful</span></div>
<div><b>${summary.failed}</b><span>Failed</span></div>
</div>
<div class="admin-queue-note">Active wallet requests only. Closed wallet activity moves to records below.</div>
`;

if(activeRows.length === 0){
html += '<div class="admin-empty">No active wallet requests. Closed activity is in records.</div>';
}

activeRows.slice(0, 80).forEach((item,index)=>{
let isManualDeposit = item.type === "manual-deposit";
let status = isManualDeposit ? depositStatusLabel(item.status) : normalizeWalletStatus(item.status);
let collection = isManualDeposit ? "deposits" : "walletRequests";
html += compactOrderRow(
item,
collection,
index,
isManualDeposit ? "MTN MoMo Deposit" : walletTypeLabel(item.type),
(item.requestId || item.id)+" - "+(item.createdAt || ""),
(item.currency || "")+" "+format(item.amount || 0),
status,
item.username || item.customerName || item.customerEmail || item.senderEmail || ""
);
});

walletRequestsAdmin.innerHTML = html;
renderWalletRecords(recordRows);
}

function renderWalletRecords(rows){
if(!document.getElementById("walletRecordsAdmin")) return;
if(rows.length === 0){
walletRecordsAdmin.innerHTML = '<div class="admin-empty">No completed wallet records yet</div>';
return;
}

let html = '<div class="admin-queue-note">Latest closed deposits, withdrawals, and transfers.</div>';
rows.slice(0, 80).forEach((item,index)=>{
let isManualDeposit = item.type === "manual-deposit";
let status = isManualDeposit ? depositStatusLabel(item.status) : normalizeWalletStatus(item.status);
html += `
<div class="admin-order-card closed">
<div class="admin-order-main">
<div class="admin-order-rank">${index + 1}</div>
<div>
<div class="admin-order-title">${isManualDeposit ? "MTN MoMo Deposit" : walletTypeLabel(item.type)}</div>
<div class="admin-order-sub">${item.requestId || item.id} - ${item.completedAt || item.reviewedAt || item.updatedAt || item.createdAt || ""}</div>
</div>
<div class="status ${isManualDeposit ? depositStatusClass(item.status) : walletStatusClass(status)}">${status}</div>
</div>
<div class="admin-order-grid">
<div><span>Amount</span><b>${item.currency || ""} ${format(item.amount || 0)}</b></div>
<div><span>Customer</span><b>${item.username || item.customerName || item.customerEmail || item.senderEmail || ""}</b></div>
${isManualDeposit ? `<div><span>Sender Name</span><b>${item.senderName || ""}</b></div>` : ""}
${isManualDeposit ? `<div><span>Transaction ID</span><b>${item.transactionId || ""}</b></div>` : ""}
<div><span>Recipient</span><b>${item.recipientName || item.recipientId || ""}</b></div>
<div><span>Reference</span><b>${item.requestId || item.id}</b></div>
</div>
${isManualDeposit && item.screenshot ? `<a class="link" href="${item.screenshot}" target="_blank">View Screenshot Proof</a>` : ""}
<button class="outline-btn" onclick="goToOrderDetail('${isManualDeposit ? "deposits" : "walletRequests"}','${item.id || item.requestId || ""}')">View Details</button>
</div>
`;
});
walletRecordsAdmin.innerHTML = html;
}

function searchWalletRequests(){
let val = walletSearchInput.value.toLowerCase();
let filtered = allWalletRequests.filter(item =>
(item.requestId && item.requestId.toLowerCase().includes(val)) ||
(item.customerEmail && item.customerEmail.toLowerCase().includes(val)) ||
(item.senderEmail && item.senderEmail.toLowerCase().includes(val)) ||
(item.recipientName && item.recipientName.toLowerCase().includes(val)) ||
(item.type && item.type.toLowerCase().includes(val)) ||
(item.status && item.status.toLowerCase().includes(val))
);
let depositFiltered = allDepositRequests.filter(item =>
(item.requestId && item.requestId.toLowerCase().includes(val)) ||
(item.customerEmail && item.customerEmail.toLowerCase().includes(val)) ||
(item.senderName && item.senderName.toLowerCase().includes(val)) ||
(item.transactionId && item.transactionId.toLowerCase().includes(val)) ||
(item.status && item.status.toLowerCase().includes(val))
);
displayAdminWalletRequests(sortAdminQueueRows([...depositFiltered, ...filtered]));
}

async function approveManualDeposit(id){
if(!isAdmin) return alert("Admin only");
if(!confirm("Approve this MTN MoMo deposit and credit the user's wallet?")) return;

try{
let depositRef = db.collection("deposits").doc(id);
let walletRef = db.collection("walletRequests").doc(id);
let notificationRef = db.collection("notifications").doc();
let transactionRef = db.collection("transactions").doc("DEP-"+id);
let pushPayload = null;

await db.runTransaction(async transaction=>{
let depositDoc = await transaction.get(depositRef);
if(!depositDoc.exists) throw new Error("Deposit not found");

let deposit = depositDoc.data();
if(!["pending","payment submitted","verification","processing"].includes(String(deposit.status || "").toLowerCase())) throw new Error("This deposit has already been reviewed");

let amountValue = Number(deposit.amount || 0);
if(!amountValue || amountValue <= 0) throw new Error("Deposit amount is invalid");

let balanceRef = db.collection("balances").doc(deposit.customerId);
let field = deposit.currency === "NGN" ? "ngn" : "ghs";
let balanceUpdate = {
updatedBy: currentUser.email,
updatedAt: new Date().toLocaleString()
};
balanceUpdate[field] = firebase.firestore.FieldValue.increment(amountValue);

transaction.set(balanceRef, balanceUpdate, {merge:true});
transaction.update(depositRef, {
status: "credited",
reviewedBy: currentUser.email,
reviewedAt: new Date().toLocaleString(),
creditedAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
});
transaction.set(walletRef, {
status: "Successful",
approvedBy: currentUser.email,
approvedAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
}, {merge:true});
transaction.set(transactionRef, {
orderID: "DEP-"+deposit.transactionId,
type: "deposit",
customerId: deposit.customerId,
customerEmail: deposit.customerEmail,
currency: deposit.currency,
amount: amountValue,
converted: amountValue,
status: "Completed",
paymentProvider: "MTN Mobile Money",
paymentReference: deposit.transactionId,
senderName: deposit.senderName,
date: new Date().toLocaleString()
}, {merge:true});
transaction.set(notificationRef, {
forUserId: deposit.customerId,
type: "deposit",
title: "Deposit Approved",
message: "Your "+deposit.currency+" "+format(amountValue)+" deposit has been approved.",
depositId: id,
createdAt: new Date().toLocaleString(),
read: false
});
pushPayload = {
userId: deposit.customerId,
title: "Deposit Approved",
body: "Your "+deposit.currency+" "+format(amountValue)+" deposit has been approved.",
link: orderDetailUrl("deposits", id),
data: {depositId:id, collection:"deposits", recordId:id, type:"deposit", status:"credited"}
};
});

if(pushPayload) await notifyBackendUser(pushPayload.userId, pushPayload.title, pushPayload.body, pushPayload.link, pushPayload.data);
showToast("Deposit approved");
}catch(error){
alert("Could not approve deposit: "+error.message);
}
}

async function markDepositProcessing(id){
if(!isAdmin) return alert("Admin only");
try{
await Promise.all([
db.collection("deposits").doc(id).set({
status: "processing",
processingBy: currentUser.email,
processingAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
},{merge:true}),
db.collection("walletRequests").doc(id).set({
status: "Pending",
processingBy: currentUser.email,
updatedAt: new Date().toLocaleString()
},{merge:true})
]);
showToast("Deposit processing");
}catch(error){
alert("Could not update deposit: "+error.message);
}
}

async function rejectManualDeposit(id){
if(!isAdmin) return alert("Admin only");
let rejectionReason = prompt("Enter rejection reason for customer:");
if(!rejectionReason || !rejectionReason.trim()) return alert("Rejection reason is required.");
rejectionReason = rejectionReason.trim();

try{
let depositRef = db.collection("deposits").doc(id);
let walletRef = db.collection("walletRequests").doc(id);
let notificationRef = db.collection("notifications").doc();
let pushPayload = null;

await db.runTransaction(async transaction=>{
let depositDoc = await transaction.get(depositRef);
if(!depositDoc.exists) throw new Error("Deposit not found");

let deposit = depositDoc.data();
if(!["pending","payment submitted","verification","processing"].includes(String(deposit.status || "").toLowerCase())) throw new Error("This deposit has already been reviewed");

transaction.update(depositRef, {
status: "rejected",
rejectionReason,
reviewedBy: currentUser.email,
reviewedAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
});
transaction.set(walletRef, {
status: "Failed",
rejectedBy: currentUser.email,
rejectedAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
}, {merge:true});
transaction.set(notificationRef, {
forUserId: deposit.customerId,
type: "deposit",
title: "Deposit Rejected",
message: "Your "+deposit.currency+" "+format(deposit.amount || 0)+" deposit was rejected.",
rejectionReason,
depositId: id,
createdAt: new Date().toLocaleString(),
read: false
});
pushPayload = {
userId: deposit.customerId,
title: "Deposit Rejected",
body: "Your "+deposit.currency+" "+format(deposit.amount || 0)+" deposit was rejected.",
link: orderDetailUrl("deposits", id),
data: {depositId:id, collection:"deposits", recordId:id, type:"deposit", status:"rejected", rejectionReason}
};
});

if(pushPayload) await notifyBackendUser(pushPayload.userId, pushPayload.title, pushPayload.body, pushPayload.link, pushPayload.data);
showToast("Deposit rejected");
}catch(error){
alert("Could not reject deposit: "+error.message);
}
}

async function markWithdrawalProcessing(id){
if(!isAdmin) return alert("Admin only");
try{
await db.collection("walletRequests").doc(id).set({
status: "Processing",
processingBy: currentUser.email,
processingAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
},{merge:true});
showToast("Withdrawal processing");
}catch(error){
alert("Could not update withdrawal: "+error.message);
}
}

async function completeWithdrawal(id){
if(!isAdmin) return alert("Admin only");
if(!confirm("Complete this withdrawal and deduct the customer wallet balance?")) return;

try{
let requestRef = db.collection("walletRequests").doc(id);
let notificationRef = db.collection("notifications").doc();
let transactionRef = db.collection("transactions").doc("WDR-"+id);
let pushPayload = null;

await db.runTransaction(async transaction=>{
let requestDoc = await transaction.get(requestRef);
if(!requestDoc.exists) throw new Error("Withdrawal request not found");
let request = requestDoc.data();
let status = normalizeWalletStatus(request.status);
if(status === "Successful" || status === "Paid" || status === "Failed") throw new Error("This withdrawal has already been closed");

let amountValue = Number(request.amount || 0);
if(!amountValue || amountValue <= 0) throw new Error("Withdrawal amount is invalid");

let balanceRef = db.collection("balances").doc(request.customerId);
let balanceDoc = await transaction.get(balanceRef);
let balance = balanceDoc.exists ? balanceDoc.data() : {};
let field = request.currency === "NGN" ? "ngn" : "ghs";
let available = Number(balance[field] || 0);
if(available < amountValue) throw new Error("Customer balance is now insufficient");

let update = {
updatedBy: currentUser.email,
updatedAt: new Date().toLocaleString()
};
update[field] = available - amountValue;

transaction.set(balanceRef, update, {merge:true});
transaction.set(requestRef, {
status: "Paid",
completedBy: currentUser.email,
paidBy: currentUser.email,
completedAt: new Date().toLocaleString(),
paidAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString(),
balanceBeforeCompletion: available,
balanceAfterCompletion: available - amountValue
}, {merge:true});
transaction.set(transactionRef, {
orderID: "WDR-"+id,
requestId: id,
type: "withdraw",
customerId: request.customerId,
customerEmail: request.customerEmail,
currency: request.currency,
amount: amountValue,
converted: amountValue,
status: "Completed",
paymentProvider: request.paymentProvider,
paymentProviderCode: request.paymentProviderCode || "",
paymentMethod: request.paymentMethod,
paymentAccountName: request.paymentAccountName,
paymentAccountNumber: request.paymentAccountNumber,
payoutDetails: request.payoutDetails || {},
payoutVerified: request.payoutVerified === true,
withdrawalPinVerified: request.withdrawalPinVerified === true,
date: new Date().toLocaleString(),
createdAt: request.createdAt || "",
completedAt: new Date().toLocaleString()
}, {merge:true});
transaction.set(notificationRef, {
forUserId: request.customerId,
type: "withdraw",
title: "Withdrawal Completed",
message: "Your "+request.currency+" "+format(amountValue)+" withdrawal has been completed.",
requestId: id,
createdAt: new Date().toLocaleString(),
read: false
});
pushPayload = {
userId: request.customerId,
title: "Withdrawal Completed",
body: "Your "+request.currency+" "+format(amountValue)+" withdrawal has been completed.",
link: orderDetailUrl("walletRequests", id),
data: {requestId:id, collection:"walletRequests", recordId:id, type:"withdraw", status:"Paid"}
};
});

if(pushPayload) await notifyBackendUser(pushPayload.userId, pushPayload.title, pushPayload.body, pushPayload.link, pushPayload.data);
showToast("Withdrawal completed");
}catch(error){
alert("Could not complete withdrawal: "+error.message);
}
}

async function rejectWithdrawal(id){
if(!isAdmin) return alert("Admin only");
let rejectionReason = prompt("Enter rejection reason for customer:");
if(!rejectionReason || !rejectionReason.trim()) return alert("Rejection reason is required.");
rejectionReason = rejectionReason.trim();

try{
let requestRef = db.collection("walletRequests").doc(id);
let notificationRef = db.collection("notifications").doc();
let pushPayload = null;

await db.runTransaction(async transaction=>{
let requestDoc = await transaction.get(requestRef);
if(!requestDoc.exists) throw new Error("Withdrawal request not found");
let request = requestDoc.data();
let status = normalizeWalletStatus(request.status);
if(status === "Successful" || status === "Paid" || status === "Failed") throw new Error("This withdrawal has already been closed");

transaction.set(requestRef, {
status: "Failed",
rejectionReason,
rejectedBy: currentUser.email,
rejectedAt: new Date().toLocaleString(),
updatedAt: new Date().toLocaleString()
}, {merge:true});
transaction.set(notificationRef, {
forUserId: request.customerId,
type: "withdraw",
title: "Withdrawal Rejected",
message: "Your "+request.currency+" "+format(request.amount || 0)+" withdrawal was rejected.",
rejectionReason,
requestId: id,
createdAt: new Date().toLocaleString(),
read: false
});
pushPayload = {
userId: request.customerId,
title: "Withdrawal Rejected",
body: "Your "+request.currency+" "+format(request.amount || 0)+" withdrawal was rejected.",
link: orderDetailUrl("walletRequests", id),
data: {requestId:id, collection:"walletRequests", recordId:id, type:"withdraw", status:"Failed", rejectionReason}
};
});

if(pushPayload) await notifyBackendUser(pushPayload.userId, pushPayload.title, pushPayload.body, pushPayload.link, pushPayload.data);
showToast("Withdrawal rejected");
}catch(error){
alert("Could not reject withdrawal: "+error.message);
}
}

async function getUnifiedHistory(){
let rows = [];

let txSnap = await db.collection("transactions").where("customerId","==",currentUser.uid).get();
txSnap.forEach(doc=>{
let tx = {id:doc.id, ...doc.data()};
if(tx.type === "internal-transfer"){
tx.historyType = tx.direction === "received" ? "transfer-received" : "transfer-sent";
}else if(tx.type === "deposit"){
tx.historyType = "deposit";
}else if(tx.type === "withdraw"){
tx.historyType = "withdraw";
}else if(tx.type === "wallet-conversion"){
tx.historyType = "wallet-conversion";
}else{
tx.historyType = "convert";
}
rows.push(tx);
});

let depositSnap = await db.collection("deposits").where("customerId","==",currentUser.uid).get();
depositSnap.forEach(doc=>{
let item = {id:doc.id, ...doc.data(), historyType:"deposit"};
if(!rows.some(row => row.paymentReference === item.transactionId || row.id === "DEP-"+item.id)){
rows.push(item);
}
});

let walletSnap = await db.collection("walletRequests").where("customerId","==",currentUser.uid).get();
walletSnap.forEach(doc=>{
let item = {id:doc.id, ...doc.data()};
if(item.manualMomoDeposit) return;
if(item.type === "withdraw") item.historyType = "withdraw";
if(item.type === "deposit") item.historyType = "deposit";
if(item.historyType && !rows.some(row => row.id === item.id || row.requestId === item.requestId)){
rows.push(item);
}
});

let sentSnap = await db.collection("walletRequests").where("senderId","==",currentUser.uid).get();
sentSnap.forEach(doc=>{
let item = {id:doc.id, ...doc.data(), historyType:"transfer-sent"};
if(item.type === "internal-transfer" && !rows.some(row => row.id === item.id || row.orderID === item.requestId)){
rows.push(item);
}
});

let receivedSnap = await db.collection("walletRequests").where("recipientId","==",currentUser.uid).get();
receivedSnap.forEach(doc=>{
let item = {id:doc.id, ...doc.data(), historyType:"transfer-received"};
if(item.type === "internal-transfer" && !rows.some(row => row.id === item.id || row.orderID === item.requestId)){
rows.push(item);
}
});

let walletConversionSnap = await db.collection("walletConversions").where("customerId","==",currentUser.uid).get();
walletConversionSnap.forEach(doc=>{
let item = {id:doc.id, ...doc.data(), historyType:"wallet-conversion"};
if(!rows.some(row => row.id === item.id || row.orderID === item.conversionId)){
rows.push(item);
}
});

rows.sort((a,b)=>String(historyDate(b)).localeCompare(String(historyDate(a))));
return rows;
}

function loadMyOrdersPage(){
getUnifiedHistory()
.then(rows=>{
myOrdersData = rows;
displayMyOrders(myOrdersData);
})
.catch(error=>{
myOrders.innerHTML = "Could not load transaction history: "+error.message;
});
}

function displayMyOrders(data){
if(data.length===0){
myOrders.innerHTML="No transaction history yet";
return;
}

let html="";

data.forEach(item=>{
let detailCollection = orderCollectionForHistory(item);
let detailId = item.id || item.requestId || item.orderID || item.conversionId || "";
html+=`
<div class="tx-card">
<div class="status ${historyStatusClass(item.status)}">${historyStatusLabel(item.status)}</div>
<div><b>Type:</b> ${historyTitle(item)}</div>
<div><b>Amount:</b> ${historyAmount(item)}</div>
<div><b>Reference:</b> ${item.orderID || item.requestId || item.transactionId || item.paymentReference || item.id}</div>
${item.paymentProvider ? `<div><b>Payment:</b> ${item.paymentProvider}</div>` : ""}
${item.recipientName ? `<div><b>Recipient:</b> ${item.recipientName}</div>` : ""}
${item.senderName && item.historyType === "transfer-received" ? `<div><b>Sender:</b> ${item.senderName}</div>` : ""}
${item.accName || item.bankName || item.accNumber ? `<div><b>Receiving Account:</b> ${item.accName || ""} ${item.bankName || ""} ${item.accNumber || ""}</div>` : ""}
<div><b>Date:</b> ${historyDate(item)}</div>
${item.screenshot || item.proofUrl || item.receiptUrl ? `<a class="link" target="_blank" href="${item.screenshot || item.proofUrl || item.receiptUrl}">View Proof</a>` : ""}
<button class="outline-btn" onclick="goToOrderDetail('${detailCollection}','${detailId}')">View Details</button>
<a class="link" target="_blank" href="https://wa.me/233542632169?text=Support%20for%20Transaction:%20${item.orderID || item.requestId || item.id}">Contact Support</a>
</div>
`;
});

myOrders.innerHTML=html;
}

function searchMyOrders(){
let val = myOrderSearchInput.value.toLowerCase();

let filtered = myOrdersData.filter(tx =>
(tx.orderID && tx.orderID.toLowerCase().includes(val)) ||
(tx.requestId && tx.requestId.toLowerCase().includes(val)) ||
(tx.transactionId && tx.transactionId.toLowerCase().includes(val)) ||
(tx.status && tx.status.toLowerCase().includes(val)) ||
(tx.paymentReference && tx.paymentReference.toLowerCase().includes(val)) ||
(historyTitle(tx).toLowerCase().includes(val))
);

displayMyOrders(filtered);
}

function supportThreadIdForUser(userId){
return "support-"+userId;
}

function loadSupportPage(){
let threadId = supportThreadIdForUser(currentUser.uid);

db.collection("supportThreads").doc(threadId).set({
customerId: currentUser.uid,
customerEmail: currentUser.email,
updatedAt: new Date().toLocaleString(),
status: "Open"
},{merge:true});

db.collection("supportThreads").doc(threadId).collection("messages")
.orderBy("createdAt","asc")
.onSnapshot(snap=>{
let messages = [];

snap.forEach(doc=>{
messages.push(doc.data());
});

displaySupportMessages(messages, supportMessages);
});
}

function displaySupportMessages(messages, target){
if(messages.length===0){
target.innerHTML = "No messages yet";
return;
}

let html = "";

messages.forEach(message=>{
let own = message.senderId === currentUser.uid;
html += `
<div class="chat-message ${own ? "own" : ""}">
<b>${message.senderName || message.senderEmail || "Support"}</b>
<p>${message.text}</p>
<span>${message.createdLabel || ""}</span>
</div>
`;
});

target.innerHTML = html;
target.scrollTop = target.scrollHeight;
}

async function sendSupportMessage(){
let text = supportMessageInput.value.trim();
if(!text) return alert("Type a message");

let threadId = supportThreadIdForUser(currentUser.uid);

await db.collection("supportThreads").doc(threadId).set({
customerId: currentUser.uid,
customerEmail: currentUser.email,
updatedAt: new Date().toLocaleString(),
status: "Open"
},{merge:true});

await db.collection("supportThreads").doc(threadId).collection("messages").add({
text,
senderId: currentUser.uid,
senderEmail: currentUser.email,
senderName: currentProfile ? currentProfile.name : currentUser.email,
senderRole: isAdmin ? "admin" : "customer",
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
createdLabel: new Date().toLocaleString()
});

supportMessageInput.value = "";
if(!isAdmin){
await notifyAdmin("support-created", "Support ticket needs attention", (currentUser.email || "A customer")+" sent a support message.", "support-chat-admin.html?thread="+encodeURIComponent(threadId), {threadId, userId:currentUser.uid}, "high");
}
}

async function markPaid(id){
if(!isAdmin) return alert("Admin only");
try{
await db.collection("transactions").doc(id).update({status:"Paid"});
loadDashboard();
}catch(error){
alert("Could not save status: "+error.message);
}
}

async function markCompleted(id){
if(!isAdmin) return alert("Admin only");
try{
await db.collection("transactions").doc(id).update({status:"Completed"});
loadDashboard();
}catch(error){
alert("Could not save status: "+error.message);
}
}

async function markOrderStatus(id, status){
if(!isAdmin) return alert("Admin only");
try{
let txRef = db.collection("transactions").doc(id);
let txDoc = await txRef.get();
let tx = txDoc.exists ? txDoc.data() : {};
let rejectionReason = "";
if(status === "Settlement Rejected"){
rejectionReason = prompt("Enter rejection reason for customer:");
if(!rejectionReason || !rejectionReason.trim()) return alert("Rejection reason is required.");
rejectionReason = rejectionReason.trim();
}
let updateData = {
status,
reviewedBy: currentUser.email,
updatedAt: new Date().toLocaleString(),
adminActionHistory: firebase.firestore.FieldValue.arrayUnion({
status,
reason: rejectionReason,
admin: currentUser.email,
date: new Date().toLocaleString()
})
};

if(status === "Settlement Rejected"){
updateData.rejectionReason = rejectionReason;
}

if(status === "Completed"){
let profitSnapshot = getOrderProfitSnapshot(tx.type, Number(tx.amount || 0), tx);
updateData.completedAt = new Date().toLocaleString();
updateData.marketRate = profitSnapshot.marketRate;
updateData.atvRate = profitSnapshot.atvRate;
updateData.spread = profitSnapshot.spread;
updateData.profit = profitSnapshot.profitMade;
updateData.profitMade = profitSnapshot.profitMade;
}

await txRef.update(updateData);

if(tx.customerId){
let title = status === "Completed" ? "Order Completed" : "Order "+status;
let message = status === "Completed"
? "Your currency exchange order has been completed."
: status === "Settlement Rejected"
? "Your order "+(tx.orderID || id)+" was rejected. Reason: "+rejectionReason
: "Your order "+(tx.orderID || id)+" is now "+status+".";
await notifyUser(tx.customerId, "order-status", title, message, orderDetailUrl("transactions", id), {orderId:tx.orderID || id, transactionDocId:id, collection:"transactions", recordId:id, status});
}
await notifyAdmin("order-status", "Order "+status, "Order "+(tx.orderID || id)+" was marked "+status+".", orderDetailUrl("transactions", id), {orderId:tx.orderID || id, transactionDocId:id, status}, status === "Settlement Rejected" ? "high" : "medium");

loadDashboard();
}catch(error){
alert("Could not save order status: "+error.message);
}
}

function loadProfitDashboard(){
loadTransactions(data=>{
allProfitOrders = data.filter(isProfitOrder).map(normalizeProfitOrder);
displayProfitSummary(allProfitOrders);
});
}

function isProfitOrder(tx){
return tx
&& tx.status === "Completed"
&& (tx.orderType === "convert" || tx.type === "cedis" || tx.type === "naira")
&& tx.type !== "deposit"
&& tx.type !== "internal-transfer";
}

function normalizeProfitOrder(tx){
let snapshot = getOrderProfitSnapshot(tx.type, Number(tx.amount || 0), tx);
let completedAt = tx.completedAt || tx.updatedAt || tx.date || "";
let completedMs = adminDateValue({createdAt: completedAt, date: tx.date, updatedAt: tx.updatedAt});
let marketRate = Number(tx.marketRate || snapshot.marketRate || 0);
let atvRate = Number(tx.atvRate || snapshot.atvRate || 0);
let spread = marketRate - atvRate;
let profitMade = Number(tx.amount || 0) * spread;

return {
...tx,
marketRate,
atvRate,
spread,
profitMade,
completedAt,
completedMs,
direction: tx.type === "cedis" ? "GHS to NGN" : "NGN to GHS"
};
}

function profitPeriodStart(period){
let now = new Date();
if(period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
if(period === "week"){
let day = now.getDay();
let diff = day === 0 ? 6 : day - 1;
return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff).getTime();
}
if(period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
return 0;
}

function sumProfit(rows){
return rows.reduce((sum, tx)=>sum + Number(tx.profitMade || 0), 0);
}

function applyProfitFilters(){
displayProfitSummary(allProfitOrders);
}

function displayProfitSummary(data){
if(!document.getElementById("profitSummary")) return;

let fromValue = document.getElementById("profitDateFrom") ? profitDateFrom.value : "";
let toValue = document.getElementById("profitDateTo") ? profitDateTo.value : "";
let directionValue = document.getElementById("profitDirectionFilter") ? profitDirectionFilter.value : "";
let fromTime = fromValue ? new Date(fromValue+"T00:00:00").getTime() : 0;
let toTime = toValue ? new Date(toValue+"T23:59:59").getTime() : Infinity;

let filtered = data.filter(tx=>{
let directionOk = !directionValue || tx.type === directionValue;
let dateOk = tx.completedMs >= fromTime && tx.completedMs <= toTime;
return directionOk && dateOk;
});

let todayStart = profitPeriodStart("today");
let weekStart = profitPeriodStart("week");
let monthStart = profitPeriodStart("month");
let totalProfit = sumProfit(filtered);
let todayProfit = sumProfit(data.filter(tx => tx.completedMs >= todayStart));
let weekProfit = sumProfit(data.filter(tx => tx.completedMs >= weekStart));
let monthProfit = sumProfit(data.filter(tx => tx.completedMs >= monthStart));
let sorted = filtered.slice().sort((a,b)=>b.completedMs - a.completedMs);

let history = sorted.length ? sorted.map(tx=>`
<div class="profit-order-row">
<div>
<b>${tx.orderID || tx.id || "Completed Order"}</b>
<span>${tx.direction} - ${tx.completedAt || "No date saved"}</span>
</div>
<div><span>Amount</span><b>${format(tx.amount || 0)}</b></div>
<div><span>Market Rate</span><b>${formatRate(tx.marketRate)}</b></div>
<div><span>ATV Rate</span><b>${formatRate(tx.atvRate)}</b></div>
<div><span>Spread</span><b>${formatRate(tx.spread)}</b></div>
<div class="profit-positive"><span>Profit</span><b>${format(tx.profitMade)}</b></div>
</div>
`).join("") : '<div class="admin-empty">No completed profit orders match this filter</div>';

profitSummary.innerHTML = `
<div class="profit-kpi-grid">
<div class="primary"><span>Total Profit</span><b>${format(totalProfit)}</b></div>
<div><span>Today</span><b>${format(todayProfit)}</b></div>
<div><span>This Week</span><b>${format(weekProfit)}</b></div>
<div><span>This Month</span><b>${format(monthProfit)}</b></div>
<div><span>Completed Orders</span><b>${filtered.length}</b></div>
</div>
<div class="profit-history-panel">
<div class="section-title">
<h3>Profit Per Order History</h3>
<span>${sorted.length} completed order${sorted.length === 1 ? "" : "s"}</span>
</div>
<div class="profit-order-list">${history}</div>
</div>
`;
}

async function loadCustomersPage(){
try{
let snapshot = await db.collection("users").get();
allCustomers = [];
for(let doc of snapshot.docs){
let data = doc.data() || {};
let transferUid = data.transferUid || data.atvUid || "";
if(!transferUid && isAdmin){
try{
transferUid = await adminEnsureTransferUidForCustomer(doc.id, data);
}catch(error){
appLog("Admin transfer UID backfill skipped", {userId:doc.id, error:error.message});
}
}
allCustomers.push({
customerId: doc.id,
transferUid,
name: data.name || [data.firstName, data.middleName, data.lastName || data.surname].filter(Boolean).join(" "),
phone: data.phone || "",
email: data.email || "",
kycStatus: data.kycStatus || "Not submitted",
tier: data.tier || "Tier 1",
updatedAt: data.updatedAt || data.createdAt || ""
});
}
displayCustomers(allCustomers);
}catch(error){
customersList.innerHTML = "Could not load customers: "+error.message;
}
}

function buildCustomerList(data){
let customers = {};

data.forEach(tx=>{
let key = tx.senderPhone || tx.customerEmail || tx.senderName || "Unknown";

if(!customers[key]){
customers[key] = {
customerId: tx.customerId || "",
name: tx.senderName || "",
phone: tx.senderPhone || "",
email: tx.customerEmail || "",
orders: 0,
totalSent: 0,
lastOrder: tx.date || ""
};
}

customers[key].orders++;
customers[key].totalSent += Number(tx.amount || 0);
customers[key].lastOrder = tx.date || customers[key].lastOrder;
});

return Object.values(customers);
}

function displayCustomers(data){
if(data.length===0){
customersList.innerHTML="No customers yet";
return;
}

let html="";

data.forEach(customer=>{
html+=`
<div class="tx-card">
<div><b>Name:</b> ${customer.name}</div>
<div><b>ATV UID:</b> ${customer.transferUid || "Not assigned"}</div>
<div><b>Phone:</b> ${customer.phone}</div>
<div><b>Email:</b> ${customer.email}</div>
<div><b>Customer ID:</b> ${customer.customerId || ""}</div>
<div><b>KYC:</b> ${customer.kycStatus || ""}</div>
<button onclick="selectCustomerForBalance('${customer.customerId || ""}')">Update Balance</button>
</div>
`;
});

customersList.innerHTML=html;
}

function searchCustomers(){
let val = customerSearchInput.value.toLowerCase();

let filtered = allCustomers.filter(customer =>
(customer.name && customer.name.toLowerCase().includes(val)) ||
(customer.transferUid && customer.transferUid.includes(val)) ||
(customer.customerId && customer.customerId.toLowerCase().includes(val)) ||
(customer.phone && customer.phone.toLowerCase().includes(val)) ||
(customer.email && customer.email.toLowerCase().includes(val))
);

displayCustomers(filtered);
}

function selectCustomerForBalance(customerId){
if(!customerId) return alert("Customer ID not found");
balanceCustomerId.value = customerId;
balanceStatus.innerText = "Selected customer: "+customerId;
}

async function saveCustomerBalance(){
if(!isAdmin) return alert("Admin only");
if(!balanceCustomerId.value) return alert("Enter customer ID");

try{
await db.collection("balances").doc(balanceCustomerId.value).set({
ghs: Number(balanceGhsInput.value || 0),
ngn: Number(balanceNgnInput.value || 0),
updatedBy: currentUser.email,
updatedAt: new Date().toLocaleString()
},{merge:true});

balanceStatus.innerText = "Balance saved successfully.";
}catch(error){
balanceStatus.innerText = "Could not save balance: "+error.message;
alert("Could not save balance: "+error.message);
}
}

async function updateCustomerNameByIdNumber(){
if(!isAdmin) return alert("Admin only");

let idNumberValue = editCustomerIdNumber.value.trim();
let firstName = editFirstName.value.trim();
let middleName = editMiddleName.value.trim();
let lastName = editLastName.value.trim();

if(!idNumberValue) return alert("Enter customer ID number");
if(!firstName) return alert("Enter first name");
if(!lastName) return alert("Enter last/surname");

let fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

try{
let snap = await db.collection("users").where("idNumber","==",idNumberValue).get();

if(snap.empty){
nameEditStatus.innerText = "No customer found with that ID number.";
return;
}

let updates = [];
snap.forEach(doc=>{
updates.push(db.collection("users").doc(doc.id).update({
firstName,
middleName,
lastName,
surname: lastName,
name: fullName,
updatedBy: currentUser.email,
updatedAt: new Date().toLocaleString()
}));
});

await Promise.all(updates);
nameEditStatus.innerText = "Customer name updated successfully.";
loadCustomersPage();
}catch(error){
nameEditStatus.innerText = "Could not update customer name: "+error.message;
alert("Could not update customer name: "+error.message);
}
}

function loadSupportAdminPage(){
db.collection("supportThreads").get().then(snap=>{
supportThreadsData = [];

snap.forEach(doc=>{
let thread = doc.data();
thread.id = doc.id;
supportThreadsData.push(thread);
});

displaySupportThreads(supportThreadsData);
});
}

function displaySupportThreads(data){
if(data.length===0){
supportThreads.innerHTML = "No support chats yet";
return;
}

let html = "";

data.forEach(thread=>{
html += `
<button class="admin-list-row" onclick="openSupportThread('${thread.id}')">
<span class="admin-list-rank">💬</span>
<span>
<b>${thread.customerEmail || thread.customerId || "Customer"}</b>
<small>${thread.id} - ${thread.updatedAt || ""}</small>
</span>
<span>${thread.customerName || ""}</span>
<strong>${thread.status || "Open"}</strong>
<em class="status ${historyStatusClass(thread.status === "Resolved" ? "Completed" : "Pending")}">${thread.status || "Open"}</em>
</button>
`;
});

supportThreads.innerHTML = html;
}

function searchSupportThreads(){
let val = supportSearchInput.value.toLowerCase();

let filtered = supportThreadsData.filter(thread =>
(thread.customerEmail && thread.customerEmail.toLowerCase().includes(val)) ||
(thread.status && thread.status.toLowerCase().includes(val))
);

displaySupportThreads(filtered);
}

function openSupportThread(threadId){
window.location.href = "support-chat-admin.html?thread="+encodeURIComponent(threadId);
}

async function loadSupportAdminChatPage(){
let params = new URLSearchParams(window.location.search);
let threadId = params.get("thread") || "";
if(!threadId){
if(document.getElementById("adminThreadTitle")) adminThreadTitle.innerText = "No support chat selected.";
return;
}

selectedSupportThreadId = threadId;
if(document.getElementById("adminThreadTitle")) adminThreadTitle.innerText = "Loading "+threadId+"...";

let threadDoc = await db.collection("supportThreads").doc(threadId).get();
let selectedThread = threadDoc.exists ? {id:threadDoc.id, ...threadDoc.data()} : null;
supportThreadsData = selectedThread ? [selectedThread] : [];
if(document.getElementById("adminThreadTitle")){
adminThreadTitle.innerText = selectedThread
? "Replying to "+(selectedThread.customerEmail || selectedThread.customerId || threadId)
: "Replying to "+threadId;
}
if(document.getElementById("supportStatusSelect")){
supportStatusSelect.value = selectedThread && selectedThread.status ? selectedThread.status : "Open";
}

db.collection("supportThreads").doc(threadId).collection("messages")
.orderBy("createdAt","asc")
.onSnapshot(snap=>{
let messages = [];

snap.forEach(doc=>{
messages.push(doc.data());
});

displaySupportMessages(messages, adminSupportMessages);
});
}

async function sendAdminSupportMessage(){
if(!isAdmin) return alert("Admin only");
if(!selectedSupportThreadId) return alert("Open a chat first");

let text = adminSupportMessageInput.value.trim();
if(!text) return alert("Type a reply");

await db.collection("supportThreads").doc(selectedSupportThreadId).set({
updatedAt: new Date().toLocaleString(),
status: "Open"
},{merge:true});

await db.collection("supportThreads").doc(selectedSupportThreadId).collection("messages").add({
text,
senderId: currentUser.uid,
senderEmail: currentUser.email,
senderName: "ATV Exchange Support",
senderRole: "admin",
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
createdLabel: new Date().toLocaleString()
});

let thread = supportThreadsData.find(item => item.id === selectedSupportThreadId);
if(!thread){
let threadDoc = await db.collection("supportThreads").doc(selectedSupportThreadId).get();
thread = threadDoc.exists ? {id:threadDoc.id, ...threadDoc.data()} : null;
}
if(thread && thread.customerId){
await notifyUser(
thread.customerId,
"support",
"Support Reply",
"ATV Exchange Support replied to your message.",
"support.html",
{threadId:selectedSupportThreadId}
);
}

adminSupportMessageInput.value = "";
}

async function updateSupportStatus(){
if(!isAdmin) return alert("Admin only");
if(!selectedSupportThreadId) return alert("Open a chat first");

let status = document.getElementById("supportStatusSelect") ? supportStatusSelect.value || "Open" : "Resolved";
try{
await db.collection("supportThreads").doc(selectedSupportThreadId).set({
status,
resolvedAt: status === "Resolved" ? new Date().toLocaleString() : "",
updatedAt: new Date().toLocaleString()
},{merge:true});

if(status === "Resolved"){
let thread = supportThreadsData.find(item => item.id === selectedSupportThreadId);
if(!thread){
let threadDoc = await db.collection("supportThreads").doc(selectedSupportThreadId).get();
thread = threadDoc.exists ? {id:threadDoc.id, ...threadDoc.data()} : null;
}
if(thread && thread.customerId){
await notifyUser(
thread.customerId,
"support",
"Support Case Resolved",
"Your ATV Exchange support case has been marked as resolved.",
"support.html",
{threadId:selectedSupportThreadId, status:"Resolved"}
);
}
}

if(document.getElementById("supportThreads")) loadSupportAdminPage();
if(document.getElementById("adminThreadTitle")) adminThreadTitle.innerText = "Status updated to "+status;
}catch(error){
alert("Could not update support status: "+error.message);
}
}

async function markSupportResolved(threadId){
selectedSupportThreadId = threadId;
if(document.getElementById("supportStatusSelect")) supportStatusSelect.value = "Resolved";
await updateSupportStatus();
}

function loadKycReviewPage(){
db.collection("users").get().then(snap=>{
allKycProfiles=[];

snap.forEach(doc=>{
let profile = doc.data();
profile.id = doc.id;
allKycProfiles.push(profile);
});

displayKycProfiles(allKycProfiles);
});
}

function displayKycProfiles(data){
if(data.length===0){
kycProfiles.innerHTML="No KYC profiles yet";
return;
}

let html="";

data.forEach(profile=>{
let status = profile.kycStatus || "Not submitted";
let statusClass = "pending";
if(status==="Approved") statusClass = "completed";
if(status==="Rejected") statusClass = "paid";
let idDocumentLink = profile.idVerificationUrl || profile.kycDocumentUrl ? `<a href="${profile.idVerificationUrl || profile.kycDocumentUrl}" target="_blank" class="link">View ID Verification</a>` : "";
let proofDocumentLink = profile.proofOfAddressUrl ? `<a href="${profile.proofOfAddressUrl}" target="_blank" class="link">View Proof of Address</a>` : "";

html+=`
<div class="tx-card">
<div class="status ${statusClass}">${status}</div>
<div><b>Name:</b> ${profile.name || ""}</div>
<div><b>Phone:</b> ${profile.phone || ""}</div>
<div><b>Email:</b> ${profile.email || ""}</div>
<div><b>Country:</b> ${profile.country || ""}</div>
<div><b>Address:</b> ${profile.address || ""}</div>
<div><b>ID Type:</b> ${profile.idType || ""}</div>
<div><b>ID Number:</b> ${profile.idNumber || ""}</div>
<div><b>Proof Type:</b> ${profile.proofOfAddressType || ""}</div>
<div><b>Updated:</b> ${profile.updatedAt || ""}</div>
${idDocumentLink}
${proofDocumentLink}
<button onclick="approveKyc('${profile.id}')">Approve KYC</button>
<button onclick="rejectKyc('${profile.id}')">Reject KYC</button>
<button onclick="unlockKyc('${profile.id}')">Unlock for Resubmission</button>
<button class="danger-btn" onclick="suspendKyc('${profile.id}')">Suspend/Ban Account</button>
</div>
`;
});

kycProfiles.innerHTML=html;
}

function searchKycProfiles(){
let val = kycSearchInput.value.toLowerCase();

let filtered = allKycProfiles.filter(profile =>
(profile.name && profile.name.toLowerCase().includes(val)) ||
(profile.phone && profile.phone.toLowerCase().includes(val)) ||
(profile.email && profile.email.toLowerCase().includes(val)) ||
(profile.country && profile.country.toLowerCase().includes(val)) ||
(profile.kycStatus && profile.kycStatus.toLowerCase().includes(val))
);

displayKycProfiles(filtered);
}

async function writeKycAudit(userId, action, details){
try{
await db.collection("users").doc(userId).collection("kycHistory").add({
action,
details: details || {},
adminEmail: currentUser ? currentUser.email || "" : "",
createdAt: new Date().toLocaleString(),
createdAtMs: Date.now()
});
}catch(error){
appLog("KYC audit log skipped", error.message);
}
}

async function approveKyc(id){
if(!isAdmin) return alert("Admin only");

try{
let userDoc = await db.collection("users").doc(id).get();
await db.collection("users").doc(id).update({
kycStatus: "Approved",
kycApproved: true,
kycLocked: true,
kycReviewedBy: currentUser.email,
kycReviewedAt: new Date().toLocaleString(),
kycApprovedAt: new Date().toLocaleString(),
accountStatus: "active",
tier: "Verified",
accountTier: 2,
accountTierLabel: "Verified"
});
await writeKycAudit(id, "approved", {status:"Approved"});

if(userDoc.exists){
await notifyUser(id, "kyc", "KYC Approved", "Your ATV Exchange account is now fully verified.", "kyc.html", {status:"Approved"});
}

loadKycReviewPage();
}catch(error){
alert("Could not approve KYC: "+error.message);
}
}

async function rejectKyc(id){
if(!isAdmin) return alert("Admin only");

try{
let reason = prompt("Reason for KYC rejection:");
if(reason === null) return;
let userDoc = await db.collection("users").doc(id).get();
await db.collection("users").doc(id).update({
kycStatus: "Rejected",
kycApproved: false,
kycLocked: false,
kycRejectionReason: reason || "Rejected by admin",
kycReviewedBy: currentUser.email,
kycReviewedAt: new Date().toLocaleString()
});
await writeKycAudit(id, "rejected", {status:"Rejected", reason:reason || "Rejected by admin"});

if(userDoc.exists){
await notifyUser(id, "kyc", "KYC Rejected", "Your KYC verification was rejected. Please review and submit again.", "kyc.html", {status:"Rejected"});
}

loadKycReviewPage();
}catch(error){
alert("Could not reject KYC: "+error.message);
}
}

async function unlockKyc(id){
if(!isAdmin) return alert("Admin only");

try{
let reason = prompt("Reason for unlocking KYC resubmission:");
if(reason === null) return;
await db.collection("users").doc(id).update({
kycStatus: "Not submitted",
kycApproved: false,
kycLocked: false,
kycUnlockedBy: currentUser.email,
kycUnlockedAt: new Date().toLocaleString(),
kycUnlockReason: reason || "Unlocked by admin",
updatedAt: new Date().toLocaleString()
});
await writeKycAudit(id, "unlocked", {status:"Not submitted", reason:reason || "Unlocked by admin"});
await notifyUser(id, "kyc", "KYC Resubmission Open", "Admin has unlocked your KYC page for resubmission.", "kyc.html", {status:"Not submitted"});
loadKycReviewPage();
}catch(error){
alert("Could not unlock KYC: "+error.message);
}
}

async function suspendKyc(id){
if(!isAdmin) return alert("Admin only");

try{
let reason = prompt("Reason for suspension/ban:");
if(reason === null) return;
await db.collection("users").doc(id).update({
kycStatus: "Suspended",
kycApproved: false,
kycLocked: true,
accountStatus: "suspended",
kycReviewedBy: currentUser.email,
kycReviewedAt: new Date().toLocaleString(),
suspensionReason: reason || "Suspended by admin",
updatedAt: new Date().toLocaleString()
});
await writeKycAudit(id, "suspended", {status:"Suspended", reason:reason || "Suspended by admin"});
await notifyUser(id, "kyc", "Account Review", "Your account verification has been suspended. Contact support for help.", "support.html", {status:"Suspended"});
loadKycReviewPage();
}catch(error){
alert("Could not suspend account: "+error.message);
}
}

async function loadRatesPage(){
await loadRateSettings();

rateCedisInput.value = rateSettings.rateCedis;
rateNairaInput.value = rateSettings.rateNaira;
cedisEnabledInput.checked = Boolean(rateSettings.cedisEnabled);
nairaEnabledInput.checked = Boolean(rateSettings.nairaEnabled);
momoEndpointInput.value = rateSettings.momoEndpoint || "";
if(document.getElementById("currencyApiEndpointInput")) currencyApiEndpointInput.value = rateSettings.currencyApiEndpoint || "";
ratesStatus.innerText = "P2P rates loaded.";
}

async function saveRates(){
if(!isAdmin) return alert("Admin only");

let newRates = {
rateCedis: Number(rateCedisInput.value),
rateNaira: Number(rateNairaInput.value),
costRateCedisToNaira: Number(rateCedisInput.value),
costRateNairaToCedis: Number(rateNairaInput.value),
cedisEnabled: cedisEnabledInput.checked,
nairaEnabled: nairaEnabledInput.checked,
momoEndpoint: momoEndpointInput.value,
currencyApiEndpoint: document.getElementById("currencyApiEndpointInput") ? currencyApiEndpointInput.value : "",
updatedBy: currentUser.email,
updatedAt: new Date().toLocaleString()
};

if(!newRates.rateCedis || !newRates.rateNaira){
return alert("Enter both P2P exchange rates");
}

try{
await db.collection("settings").doc("rates").set(newRates,{merge:true});
rateSettings = {...defaultRateSettings, ...newRates};
rateCedisInput.value = rateSettings.rateCedis;
rateNairaInput.value = rateSettings.rateNaira;
ratesStatus.innerText = "P2P rates saved successfully.";

await db.collection("notifications").add({
forRole: "customer",
role: "customer",
type: "rate-update",
title: "Rate Update",
message: "Rates updated: 1 GHS = \u20A6"+formatRate(newRates.rateCedis)+" and \u20A6"+formatRate(newRates.rateNaira)+" = 1 GHS.",
link: "exchange.html",
actionLink: "exchange.html",
priority: "medium",
createdAtMs: Date.now(),
createdAt: new Date().toLocaleString(),
read: false,
pushSent: false
});
await broadcastRateUpdate(
"New exchange rates available",
"Rates updated: 1 GHS = \u20A6"+formatRate(newRates.rateCedis),
"exchange.html",
{type:"rate-update", rateCedis:newRates.rateCedis, rateNaira:newRates.rateNaira}
);
}catch(error){
ratesStatus.innerText = "Could not save rates: "+error.message;
alert("Could not save rates: "+error.message);
}
}

function loadAnnouncementsPage(){
let titleInput = document.getElementById("announcementTitle");
let messageInput = document.getElementById("announcementMessage");
if(titleInput) titleInput.addEventListener("input", updateAnnouncementPreview);
if(messageInput) messageInput.addEventListener("input", updateAnnouncementPreview);
updateAnnouncementPreview();

db.collection("announcements")
.orderBy("createdAtMs","desc")
.limit(30)
.onSnapshot(snapshot=>{
let rows = [];
snapshot.forEach(doc=>rows.push({id:doc.id, ...doc.data()}));
renderAnnouncementsList(rows);
}, error=>{
if(document.getElementById("announcementsList")) announcementsList.innerHTML = "Could not load announcements: "+error.message;
});
}

function updateAnnouncementPreview(){
let title = document.getElementById("announcementTitle") ? announcementTitle.value.trim() : "";
let message = document.getElementById("announcementMessage") ? announcementMessage.value.trim() : "";
if(document.getElementById("announcementPreviewTitle")) announcementPreviewTitle.innerText = title || "Announcement title";
if(document.getElementById("announcementPreviewMessage")) announcementPreviewMessage.innerText = message || "Your announcement message will preview here.";
}

function renderAnnouncementsList(rows){
if(!document.getElementById("announcementsList")) return;
if(!rows.length){
announcementsList.innerHTML = '<div class="admin-empty">No announcements sent yet</div>';
return;
}

announcementsList.innerHTML = rows.map(item=>`
<div class="admin-list-row announcement-row">
<span class="admin-list-rank">!</span>
<span>
<b>${escapeHtml(item.title || "Announcement")}</b>
<small>${escapeHtml(item.message || "")}</small>
<em>${escapeHtml((item.type || "system")+" - "+(item.priority || "medium")+" - "+(item.createdAt || ""))}</em>
</span>
<span class="admin-status-pill">${item.pushSent ? "Push sent" : "Saved"}</span>
</div>
`).join("");
}

async function sendAnnouncement(){
if(!isAdmin) return alert("Admin only");
let title = announcementTitle.value.trim();
let message = announcementMessage.value.trim();
let type = announcementType.value || "system";
let priority = announcementPriority.value || "medium";
let actionLink = announcementLink.value.trim() || "exchange.html";
let shouldPush = announcementSendPush.checked;

if(!title) return alert("Enter announcement title");
if(!message) return alert("Enter announcement message");

setLoading("sendAnnouncementBtn", true, "Sending...");
if(document.getElementById("announcementStatus")) announcementStatus.innerText = "Saving announcement...";

try{
let ref = db.collection("announcements").doc();
let notificationRef = db.collection("notifications").doc();
let record = {
id: ref.id,
title,
message,
type,
priority,
actionLink,
createdBy: currentUser.email,
createdAt: new Date().toLocaleString(),
createdAtMs: Date.now(),
pushSent: false
};

await Promise.all([
ref.set(record),
notificationRef.set({
...buildNotificationRecord({
id: notificationRef.id,
role:"customer",
type,
title,
message,
priority,
actionLink,
metadata:{announcementId:ref.id, type, priority}
}),
forRole:"customer"
})
]);

let result = shouldPush
? await broadcastAnnouncement(title, message, actionLink, {announcementId:ref.id, type, priority})
: {ok:true, skipped:true, status:"saved_only"};

await Promise.all([
ref.set({pushSent:Boolean(result.ok && !result.skipped), pushResult:result, updatedAt:new Date().toLocaleString()},{merge:true}),
notificationRef.set({pushSent:Boolean(result.ok && !result.skipped), pushResult:result, pushTriedAt:new Date().toLocaleString()},{merge:true})
]);

announcementTitle.value = "";
announcementMessage.value = "";
announcementLink.value = "exchange.html";
updateAnnouncementPreview();
if(document.getElementById("announcementStatus")) announcementStatus.innerText = result.status === "no_tokens" ? "Announcement saved, but no customer push tokens were found yet." : "Announcement sent successfully.";
showToast("Announcement sent");
}catch(error){
if(document.getElementById("announcementStatus")) announcementStatus.innerText = "Could not send announcement: "+error.message;
alert("Could not send announcement: "+error.message);
}finally{
setLoading("sendAnnouncementBtn", false);
}
}

async function sendTestPushToMe(){
if(!isAdmin) return alert("Admin only");
if(document.getElementById("announcementStatus")) announcementStatus.innerText = "Sending test push to this logged-in device...";
try{
let result = await sendBackendSelfTest();
let message = result.status === "no_tokens"
? "No FCM token found for this admin account. Open the app on your phone and tap Enable Notifications first."
: result.ok
? "Test push sent. Now lock/minimize the app and check the phone notification tray."
: "Test push failed: "+(result.error || result.message || "Unknown error");
if(document.getElementById("announcementStatus")) announcementStatus.innerText = message;
alert(message);
}catch(error){
if(document.getElementById("announcementStatus")) announcementStatus.innerText = "Test push failed: "+error.message;
alert("Test push failed: "+error.message);
}
}

if ("serviceWorker" in navigator) {
navigator.serviceWorker.register("./sw.js?v=20260529verifyfix1")
.then(registration => registration.update())
.catch(() => {});
}








