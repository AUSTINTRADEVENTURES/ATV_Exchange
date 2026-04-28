// FIREBASE CONFIG
const firebaseConfig = {
apiKey: "AIzaSyBQiE6s-oBHwmFcBe_7ghcYb6hEZytTFXw",
authDomain: "atvexchange.firebaseapp.com",
projectId: "atvexchange",
storageBucket: "atvexchange.firebasestorage.app"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Replace this email with the Firebase login email that should see admin pages.
const adminEmails = [
"Ezeaugustinemmaduabuchi@gmail.com"
];

// Add public keys only. Never put secret keys inside this frontend file.
const paymentSettings = {
paystackPublicKey: "pk_live_62f225ccb28c9d50340b7ad717783300572ff29e"
};

// Cloudinary unsigned upload settings for KYC documents.
// Create an unsigned upload preset in Cloudinary, then put your values here.
const cloudinarySettings = {
cloudName: "dmf7h49yl",
uploadPreset: "MYEXCGANGEAPP"
};

const defaultRateSettings = {
rateCedis: 116.27907,
rateNaira: 120.48193,
costRateCedisToNaira: 116.27907,
costRateNairaToCedis: 120.48193,
cedisEnabled: true,
nairaEnabled: true
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
let allTransactions = [];
let allCustomers = [];
let myOrdersData = [];
let allKycProfiles = [];
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let rateSettings = {...defaultRateSettings};

auth.onAuthStateChanged(user=>{
currentUser = user;
isAdmin = user ? adminEmails.includes(user.email) : false;

let page = getPageName();

if(!user && page !== "index.html"){
window.location.href = "index.html";
return;
}

if(user && page === "index.html"){
window.location.href = "exchange.html";
return;
}

showAdminButtons();

if(page === "exchange.html") loadRateSettings();
if(page === "profile.html") loadProfilePage();
if(page === "payment.html") loadPaymentPage();
if(page === "orders.html") loadMyOrdersPage();
if(page === "dashboard.html") requireAdmin(loadDashboard);
if(page === "profit.html") requireAdmin(loadProfitDashboard);
if(page === "customers.html") requireAdmin(loadCustomersPage);
if(page === "kyc-admin.html") requireAdmin(loadKycReviewPage);
if(page === "rates.html") requireAdmin(loadRatesPage);
});

function getPageName(){
let page = window.location.pathname.split("/").pop();
return page || "index.html";
}

function goToPage(page){
window.location.href = page;
}

function showAdminButtons(){
if(document.getElementById("dashboardBtn")) dashboardBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("profitBtn")) profitBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("customersBtn")) customersBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("kycBtn")) kycBtn.classList.toggle("hidden", !isAdmin);
if(document.getElementById("ratesBtn")) ratesBtn.classList.toggle("hidden", !isAdmin);
}

async function getCustomerProfile(){
if(!currentUser) return null;

let doc = await db.collection("users").doc(currentUser.uid).get();
if(!doc.exists) return null;

return doc.data();
}

function isProfileComplete(profile){
return profile &&
profile.name &&
profile.phone &&
profile.email &&
profile.country &&
profile.address &&
profile.idType &&
profile.idNumber;
}

function isKycApproved(profile){
return profile && profile.kycStatus === "Approved";
}

function loadCountryOptions(){
if(!document.getElementById("profileCountry")) return;

let html = '<option value="">Select Country</option>';

Object.keys(countryIdTypes).forEach(country=>{
html += `<option value="${country}">${country}</option>`;
});

profileCountry.innerHTML = html;
}

function updateIdTypes(selectedIdType){
if(!document.getElementById("idType")) return;

let country = profileCountry.value || "Other";
let types = countryIdTypes[country] || countryIdTypes.Other;

let html = '<option value="">Select ID Type</option>';

types.forEach(item=>{
html += `<option value="${item.value}">${item.label}</option>`;
});

idType.innerHTML = html;

if(selectedIdType){
idType.value = selectedIdType;
}
}

function requireAdmin(callback){
if(!isAdmin){
alert("Admin only");
window.location.href = "exchange.html";
return;
}

callback();
}

function login(){
if(!email.value) return alert("Enter email");
if(!password.value) return alert("Enter password");

auth.signInWithEmailAndPassword(email.value,password.value)
.catch(error=>{
if(document.getElementById("loginStatus")){
loginStatus.innerText = error.message;
}else{
alert(error.message);
}
});
}

function register(){
if(!email.value) return alert("Enter email");
if(!password.value) return alert("Enter password");

auth.createUserWithEmailAndPassword(email.value,password.value)
.catch(error=>{
if(document.getElementById("loginStatus")){
loginStatus.innerText = error.message;
}else{
alert(error.message);
}
});
}

function logout(){
auth.signOut().then(()=>{
window.location.href = "index.html";
});
}

function format(num){
return Number(num).toLocaleString(undefined,{
minimumFractionDigits:2,
maximumFractionDigits:2
});
}

async function loadRateSettings(){
let doc = await db.collection("settings").doc("rates").get();

if(doc.exists){
rateSettings = {...defaultRateSettings, ...doc.data()};
}else{
rateSettings = {...defaultRateSettings};
}

return rateSettings;
}

async function updateResult(){
await loadRateSettings();

let amountValue = Number(amount.value);
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
result.innerText = format(amountValue)+" GHS = "+format(converted)+" NGN";
}else{
if(!rateSettings.nairaEnabled){
converted = 0;
result.innerText = "Naira -> Cedis is currently unavailable";
return;
}

converted = amountValue / Number(rateSettings.rateNaira);
result.innerText = format(amountValue)+" NGN = "+format(converted)+" GHS";
}
}

async function saveExchangeAndContinue(){
let amountValue = Number(amount.value);

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

if(profile){
profileName.value = profile.name || "";
profilePhone.value = profile.phone || "";
profileEmail.value = profile.email || currentUser.email || "";
profileCountry.value = profile.country || "";
profileAddress.value = profile.address || "";
updateIdTypes(profile.idType || "");
idNumber.value = profile.idNumber || "";
profileStatus.innerText = "Profile loaded. KYC status: "+(profile.kycStatus || "Not submitted");
}else{
profileEmail.value = currentUser.email || "";
updateIdTypes();
profileStatus.innerText = "Create your profile before placing an order.";
}
}

async function saveProfile(){
if(!profileName.value) return alert("Enter full name");
if(!profilePhone.value) return alert("Enter phone number");
if(!profileEmail.value) return alert("Enter email");
if(!profileCountry.value) return alert("Enter country");
if(!profileAddress.value) return alert("Enter address");
if(!idType.value) return alert("Select ID type");
if(!idNumber.value) return alert("Enter ID number");

let existingProfile = await getCustomerProfile();
let kycDocumentUrl = existingProfile ? existingProfile.kycDocumentUrl || "" : "";
let file = kycDocument.files[0];
let profileChanged = existingProfile && (
existingProfile.name !== profileName.value ||
existingProfile.phone !== profilePhone.value ||
existingProfile.email !== profileEmail.value ||
existingProfile.country !== profileCountry.value ||
existingProfile.address !== profileAddress.value ||
existingProfile.idType !== idType.value ||
existingProfile.idNumber !== idNumber.value ||
file
);

if(!kycDocumentUrl && !file) return alert("Upload your KYC document");

if(file){
kycDocumentUrl = await uploadToCloudinary(file);
}

await db.collection("users").doc(currentUser.uid).set({
userId: currentUser.uid,
name: profileName.value,
phone: profilePhone.value,
email: profileEmail.value,
country: profileCountry.value,
address: profileAddress.value,
idType: idType.value,
idNumber: idNumber.value,
kycDocumentUrl,
kycStatus: existingProfile && existingProfile.kycStatus === "Approved" && !profileChanged ? "Approved" : "Submitted",
updatedAt: new Date().toLocaleString()
},{merge:true});

currentProfile = await getCustomerProfile();
profileStatus.innerText = "Profile/KYC saved successfully.";
}

async function uploadToCloudinary(file){
if(!cloudinarySettings.cloudName || !cloudinarySettings.uploadPreset){
alert("Add your Cloudinary cloud name and unsigned upload preset in app.js first");
throw new Error("Missing Cloudinary settings");
}

let formData = new FormData();
formData.append("file", file);
formData.append("upload_preset", cloudinarySettings.uploadPreset);
formData.append("folder", "swift-exchange/kyc");

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

async function loadPaymentPage(){
let draft = getDraft();

if(!draft){
alert("Start with the exchange page first");
window.location.href = "exchange.html";
return;
}

currentProfile = await getCustomerProfile();

if(!isProfileComplete(currentProfile)){
alert("Complete your Profile/KYC before payment");
window.location.href = "profile.html";
return;
}

if(!isKycApproved(currentProfile)){
alert("Your KYC must be approved before payment");
window.location.href = "profile.html";
return;
}

converted = Number(draft.converted || 0);

let typeLabel = draft.type === "cedis" ? "Cedis -> Naira" : "Naira -> Cedis";
orderSummary.innerHTML = `
<div><b>Type:</b> ${typeLabel}</div>
<div><b>Amount:</b> ${format(draft.amount)}</div>
<div><b>Converted:</b> ${format(draft.converted)}</div>
`;

profileSummary.innerHTML = `
<div><b>Name:</b> ${currentProfile.name}</div>
<div><b>Phone:</b> ${currentProfile.phone}</div>
<div><b>Email:</b> ${currentProfile.email}</div>
<div><b>KYC:</b> ${currentProfile.kycStatus || "Submitted"}</div>
`;

updatePaymentMethod();
}

function updatePaymentMethod(){
paymentStatus.innerText = "";
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

function payOnline(){
let paymentAmount = getPaymentAmount();
let currency = getPaymentCurrency();

if(!paymentAmount) return alert("Start with the exchange page first");
if(!isProfileComplete(currentProfile)) return alert("Complete your Profile/KYC first");
if(!isKycApproved(currentProfile)) return alert("Your KYC must be approved before payment");

paymentReference = "ATV-PAY-"+Date.now();
startPaystackPayment(paymentAmount, currency);
}

function startPaystackPayment(paymentAmount, currency){
if(!paymentSettings.paystackPublicKey){
return alert("Add your Paystack public key in paymentSettings first");
}

let popup = new Paystack();
popup.newTransaction({
key: paymentSettings.paystackPublicKey,
email: currentProfile.email,
amount: Math.round(paymentAmount * 100),
currency,
reference: paymentReference,
metadata: {
senderName: currentProfile.name,
senderPhone: currentProfile.phone,
userId: currentUser.uid
},
onSuccess: function(transaction){
paymentReference = transaction.reference;
paymentStatus.innerText = "Payment successful: "+paymentReference;
},
onCancel: function(){
paymentStatus.innerText = "Payment cancelled";
}
});
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

async function submitOrder(){
let draft = getDraft();
if(!draft) return alert("Start with the exchange page first");

currentProfile = currentProfile || await getCustomerProfile();

if(!isProfileComplete(currentProfile)) return alert("Complete your Profile/KYC first");
if(!isKycApproved(currentProfile)) return alert("Your KYC must be approved before payment");
if(!accName.value) return alert("Enter account name");
if(!bankName.value) return alert("Enter bank name");
if(!accNumber.value) return alert("Enter account number");
if(!paymentReference) return alert("Complete online payment first");

let orderID = "ATV-"+Date.now();
rateSettings = {
...rateSettings,
rateCedis: Number(draft.rateCedis || rateSettings.rateCedis),
rateNaira: Number(draft.rateNaira || rateSettings.rateNaira),
costRateCedisToNaira: Number(draft.costRateCedisToNaira || rateSettings.costRateCedisToNaira),
costRateNairaToCedis: Number(draft.costRateNairaToCedis || rateSettings.costRateNairaToCedis)
};
let profit = calculateProfit(draft.type, Number(draft.amount), Number(draft.converted));

await db.collection("transactions").add({
orderID,
type: draft.type,
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
paymentProvider: "paystack",
paymentReference,
rateCedis: Number(draft.rateCedis || rateSettings.rateCedis),
rateNaira: Number(draft.rateNaira || rateSettings.rateNaira),
costRateCedisToNaira: Number(draft.costRateCedisToNaira || rateSettings.costRateCedisToNaira),
costRateNairaToCedis: Number(draft.costRateNairaToCedis || rateSettings.costRateNairaToCedis),
profit,
status: "Paid",
date: new Date().toLocaleString()
});

localStorage.removeItem("exchangeDraft");
window.open("https://wa.me/233542632169?text=Order%20ID:%20"+orderID);
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

function loadDashboard(){
loadTransactions(displayTransactions);
}

function displayTransactions(data){
if(data.length===0){
transactions.innerHTML="No data";
return;
}

let html="";

data.forEach(tx=>{
let statusClass="pending";
if(tx.status==="Paid") statusClass="paid";
if(tx.status==="Completed") statusClass="completed";

let typeLabel = tx.type === "cedis" ? "Cedis -> Naira" : "Naira -> Cedis";

html+=`
<div class="tx-card">
<div class="status ${statusClass}">${tx.status}</div>
<div><b>Order:</b> ${tx.orderID}</div>
<div><b>Type:</b> ${typeLabel}</div>
<div><b>Sent:</b> ${format(tx.amount)}</div>
<div><b>Pay:</b> ${format(tx.converted)}</div>
<div><b>Sender:</b> ${tx.senderName || ""} (${tx.senderPhone || ""})</div>
<div><b>Email:</b> ${tx.customerEmail || ""}</div>
<div><b>Account:</b> ${tx.accName || ""} - ${tx.bankName || ""}</div>
<div><b>Number:</b> ${tx.accNumber || ""}</div>
<div><b>Payment:</b> ${tx.paymentProvider || "online"} ${tx.paymentReference || ""}</div>
<div><b>Profit:</b> ${format(tx.profit || 0)}</div>
<button onclick="markPaid('${tx.id}')">Paid</button>
<button onclick="markCompleted('${tx.id}')">Complete</button>
<div>${tx.date}</div>
</div>
`;
});

transactions.innerHTML=html;
}

function searchTx(){
let val = searchInput.value.toLowerCase();

let filtered = allTransactions.filter(tx =>
(tx.orderID && tx.orderID.toLowerCase().includes(val)) ||
(tx.accName && tx.accName.toLowerCase().includes(val)) ||
(tx.senderName && tx.senderName.toLowerCase().includes(val)) ||
(tx.senderPhone && tx.senderPhone.toLowerCase().includes(val))
);

displayTransactions(filtered);
}

function loadMyOrdersPage(){
db.collection("transactions")
.where("customerId","==",currentUser.uid)
.get()
.then(snap=>{
myOrdersData=[];

snap.forEach(doc=>{
let tx = doc.data();
tx.id = doc.id;
myOrdersData.push(tx);
});

displayMyOrders(myOrdersData);
});
}

function displayMyOrders(data){
if(data.length===0){
myOrders.innerHTML="No orders yet";
return;
}

let html="";

data.forEach(tx=>{
let statusClass="pending";
if(tx.status==="Paid") statusClass="paid";
if(tx.status==="Completed") statusClass="completed";

let typeLabel = tx.type === "cedis" ? "Cedis -> Naira" : "Naira -> Cedis";

html+=`
<div class="tx-card">
<div class="status ${statusClass}">${tx.status}</div>
<div><b>Order:</b> ${tx.orderID}</div>
<div><b>Type:</b> ${typeLabel}</div>
<div><b>Sent:</b> ${format(tx.amount)}</div>
<div><b>Receive:</b> ${format(tx.converted)}</div>
<div><b>Payment:</b> ${tx.paymentProvider || "online"} ${tx.paymentReference || ""}</div>
<div><b>Receiving Account:</b> ${tx.accName || ""} - ${tx.bankName || ""}</div>
<div><b>Account Number:</b> ${tx.accNumber || ""}</div>
<div><b>Date:</b> ${tx.date || ""}</div>
<a class="link" target="_blank" href="https://wa.me/233542632169?text=Support%20for%20Order%20ID:%20${tx.orderID}">Contact Support</a>
</div>
`;
});

myOrders.innerHTML=html;
}

function searchMyOrders(){
let val = myOrderSearchInput.value.toLowerCase();

let filtered = myOrdersData.filter(tx =>
(tx.orderID && tx.orderID.toLowerCase().includes(val)) ||
(tx.status && tx.status.toLowerCase().includes(val)) ||
(tx.paymentReference && tx.paymentReference.toLowerCase().includes(val))
);

displayMyOrders(filtered);
}

async function markPaid(id){
if(!isAdmin) return alert("Admin only");
await db.collection("transactions").doc(id).update({status:"Paid"});
loadDashboard();
}

async function markCompleted(id){
if(!isAdmin) return alert("Admin only");
await db.collection("transactions").doc(id).update({status:"Completed"});
loadDashboard();
}

function loadProfitDashboard(){
loadTransactions(displayProfitSummary);
}

function displayProfitSummary(data){
let totalOrders = data.length;
let pendingOrders = data.filter(tx => tx.status==="Pending").length;
let paidOrders = data.filter(tx => tx.status==="Paid").length;
let completedOrders = data.filter(tx => tx.status==="Completed").length;
let totalProfit = data.reduce((sum, tx) => sum + Number(tx.profit || 0), 0);

profitSummary.innerHTML = `
<div><b>Total Orders:</b> ${totalOrders}</div>
<div><b>Pending:</b> ${pendingOrders}</div>
<div><b>Paid:</b> ${paidOrders}</div>
<div><b>Completed:</b> ${completedOrders}</div>
<div><b>Estimated Profit:</b> ${format(totalProfit)}</div>
`;
}

function loadCustomersPage(){
loadTransactions(data=>{
allCustomers = buildCustomerList(data);
displayCustomers(allCustomers);
});
}

function buildCustomerList(data){
let customers = {};

data.forEach(tx=>{
let key = tx.senderPhone || tx.customerEmail || tx.senderName || "Unknown";

if(!customers[key]){
customers[key] = {
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
<div><b>Phone:</b> ${customer.phone}</div>
<div><b>Email:</b> ${customer.email}</div>
<div><b>Orders:</b> ${customer.orders}</div>
<div><b>Total Sent:</b> ${format(customer.totalSent)}</div>
<div><b>Last Order:</b> ${customer.lastOrder}</div>
</div>
`;
});

customersList.innerHTML=html;
}

function searchCustomers(){
let val = customerSearchInput.value.toLowerCase();

let filtered = allCustomers.filter(customer =>
(customer.name && customer.name.toLowerCase().includes(val)) ||
(customer.phone && customer.phone.toLowerCase().includes(val)) ||
(customer.email && customer.email.toLowerCase().includes(val))
);

displayCustomers(filtered);
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
let documentLink = profile.kycDocumentUrl ? `<a href="${profile.kycDocumentUrl}" target="_blank" class="link">View KYC Document</a>` : "";

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
<div><b>Updated:</b> ${profile.updatedAt || ""}</div>
${documentLink}
<button onclick="approveKyc('${profile.id}')">Approve KYC</button>
<button onclick="rejectKyc('${profile.id}')">Reject KYC</button>
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

async function approveKyc(id){
if(!isAdmin) return alert("Admin only");

await db.collection("users").doc(id).update({
kycStatus: "Approved",
kycReviewedBy: currentUser.email,
kycReviewedAt: new Date().toLocaleString()
});

loadKycReviewPage();
}

async function rejectKyc(id){
if(!isAdmin) return alert("Admin only");

await db.collection("users").doc(id).update({
kycStatus: "Rejected",
kycReviewedBy: currentUser.email,
kycReviewedAt: new Date().toLocaleString()
});

loadKycReviewPage();
}

async function loadRatesPage(){
await loadRateSettings();

rateCedisInput.value = rateSettings.rateCedis;
rateNairaInput.value = rateSettings.rateNaira;
costRateCedisInput.value = rateSettings.costRateCedisToNaira;
costRateNairaInput.value = rateSettings.costRateNairaToCedis;
cedisEnabledInput.checked = Boolean(rateSettings.cedisEnabled);
nairaEnabledInput.checked = Boolean(rateSettings.nairaEnabled);
ratesStatus.innerText = "Rates loaded.";
}

async function saveRates(){
if(!isAdmin) return alert("Admin only");

let newRates = {
rateCedis: Number(rateCedisInput.value),
rateNaira: Number(rateNairaInput.value),
costRateCedisToNaira: Number(costRateCedisInput.value),
costRateNairaToCedis: Number(costRateNairaInput.value),
cedisEnabled: cedisEnabledInput.checked,
nairaEnabled: nairaEnabledInput.checked,
updatedBy: currentUser.email,
updatedAt: new Date().toLocaleString()
};

if(!newRates.rateCedis || !newRates.rateNaira || !newRates.costRateCedisToNaira || !newRates.costRateNairaToCedis){
return alert("Enter all rate values");
}

await db.collection("settings").doc("rates").set(newRates,{merge:true});
rateSettings = {...defaultRateSettings, ...newRates};
ratesStatus.innerText = "Rates saved successfully.";
}

if ("serviceWorker" in navigator) {
navigator.serviceWorker.register("./sw.js");
}
