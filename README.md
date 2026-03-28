# Q3 Fit PWA Billing System

A robust, offline-capable Progressive Web Application (PWA) built specifically for managing inventory, tracking customers, and generating professional PDF invoices in a vintage clothing store context.

## 🚀 Features
- **Hash-Based Routing:** Seamless Single Page Application (SPA) navigation preserving layout state.
- **Offline Reliability:** Fully functional offline using IndexedDB via `dexie.js`.
- **Advanced PDF Generation:** High-quality invoice rendering utilizing `html2pdf.js`, precisely cloned and processed off-screen.
- **WhatsApp Integration:** Built-in Web Share API fallback mechanism to directly send bills to walk-in customers natively.
- **Stock Management:** Real-time inventory deduction and restoration algorithms.

## 🛠️ Tech Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Database: IndexedDB (Dexie.js)
- CSS Framework: Bootstrap 5
- PDF Export Engine: html2pdf.js / html2canvas

## 🌐 Deployment (Vercel)
This project requires **zero build steps** as it is purely an HTML/JS frontend application.
1. Connect this repository to Vercel.
2. In the Vercel project settings, set:
   - Framework Preset: **Other**
   - Build Command: `(empty)`
   - Output Directory: `(empty)`
3. Deploy!
