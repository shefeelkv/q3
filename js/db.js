// db.js - Setup Dexie.js for IndexedDB
const db = new Dexie("Q3FitDB");

// Define schema
// Version 1
db.version(1).stores({
    products: "++id, name, category, price, stock",
    customers: "++id, name, phone, totalSpent",
    bills: "++id, date, customerId, customerName, total" 
});

// We can just query bills using Dexie directly. 
// "items" array inside bills doesn't strictly need indexing unless we search inside JSON.
