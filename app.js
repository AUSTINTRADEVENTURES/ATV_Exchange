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
"admin@example.com"
];

// Add public keys only. Never put secret keys inside this frontend file.
const paymentSettings = {
paystackPublicKey: "",
flutterwavePublicKey: ""
};

const rateCedis = 116.27907;
const rateNaira = 120.48193;

// These are your business cost rates. Change them when you know your real buying rates.
const costRateCedisToNaira = 116.27907;
const costRateNairaToCedis = 120.48193;

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
let currentUser = null;
let currentProfile = null;
let isAdmin = false;

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

if(page === "profile.html") loadProfilePage();
if(page === "payment.html") loadPaymentPage();
if(page === "dashboard.html") requireAdmin(loadDashboard);
if(page === "profit.html") requireAdmin(loadProfitDashboard);
if(page === "customers.html") requireAdmin(loadCustomersPage);
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
auth.signInWithEmailAndPassword(email.value,password.value)
.catch(()=>alert("Login failed"));
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

function updateResult(){
let amountValue = Number(amount.value);
let typeValue = type.value;

if(!amountValue || amountValue <= 0){
converted = 0;
result.innerText = "";
return;
}

if(typeValue==="cedis"){
converted = amountValue * rateCedis;
result.innerText = format(amountValue)+" GHS = "+format(converted)+" NGN";
}else{
converted = amountValue / rateNaira;
result.innerText = format(amountValue)+" NGN = "+format(converted)+" GHS";
}
}

function saveExchangeAndContinue(){
let amountValue = Number(amount.value);

if(!amountValue || amountValue <= 0) return alert("Enter a valid amount");

updateResult();

let draft = {
type: type.value,
amount: amountValue,
converted
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

if(!kycDocumentUrl && !file) return alert("Upload your KYC document");

if(file){
let ref = storage.ref("kyc/"+currentUser.uid+"/"+Date.now()+"-"+file.name);
await ref.put(file);
kycDocumentUrl = await ref.getDownloadURL();
}

await db.collection("users").doc(currentUser.uid).set({
name: profileName.value,
phone: profilePhone.value,
email: profileEmail.value,
country: profileCountry.value,
address: profileAddress.value,
idType: idType.value,
idNumber: idNumber.value,
kycDocumentUrl,
kycStatus: "Submitted",
updatedAt: new Date().toLocaleString()
},{merge:true});

currentProfile = await getCustomerProfile();
profileStatus.innerText = "Profile/KYC saved successfully.";
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
let provider = paymentProvider.value;
let paymentAmount = getPaymentAmount();
let currency = getPaymentCurrency();

if(!paymentAmount) return alert("Start with the exchange page first");
if(!isProfileComplete(currentProfile)) return alert("Complete your Profile/KYC first");

paymentReference = "ATV-PAY-"+Date.now();

if(provider==="paystack"){
startPaystackPayment(paymentAmount, currency);
}else{
startFlutterwavePayment(paymentAmount, currency);
}
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

function startFlutterwavePayment(paymentAmount, currency){
if(!paymentSettings.flutterwavePublicKey){
return alert("Add your Flutterwave public key in paymentSettings first");
}

FlutterwaveCheckout({
public_key: paymentSettings.flutterwavePublicKey,
tx_ref: paymentReference,
amount: paymentAmount,
currency,
customer: {
email: currentProfile.email,
phone_number: currentProfile.phone,
name: currentProfile.name
},
customizations: {
title: "Swift Exchange",
description: "Exchange payment"
},
callback: function(data){
paymentReference = data.transaction_id || data.tx_ref;
paymentStatus.innerText = "Payment successful: "+paymentReference;
},
onclose: function(){
paymentStatus.innerText = "Payment closed";
}
});
}

function calculateProfit(typeValue, amountValue, convertedValue){
if(typeValue==="cedis"){
return amountValue * rateCedis - amountValue * costRateCedisToNaira;
}

let businessCost = amountValue / costRateNairaToCedis;
return businessCost - convertedValue;
}

async function submitOrder(){
let draft = getDraft();
if(!draft) return alert("Start with the exchange page first");

let provider = paymentProvider.value;

currentProfile = currentProfile || await getCustomerProfile();

if(!isProfileComplete(currentProfile)) return alert("Complete your Profile/KYC first");
if(!accName.value) return alert("Enter account name");
if(!bankName.value) return alert("Enter bank name");
if(!accNumber.value) return alert("Enter account number");
if(!paymentReference) return alert("Complete online payment first");

let orderID = "ATV-"+Date.now();
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
paymentProvider: provider,
paymentReference,
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

if ("serviceWorker" in navigator) {
navigator.serviceWorker.register("./sw.js");
}
