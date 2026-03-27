// dashboard.js - Reporting & Analytics
const dashboard = {
    update: async function() {
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const thisMonthBills = await db.bills.filter(b => b.date >= startOfMonth && !b.isDeleted).toArray();
            
            let revenue = 0;
            thisMonthBills.forEach(b => revenue += parseFloat(b.total));

            const revEl = document.getElementById('dash-revenue');
            const countEl = document.getElementById('dash-bills-count');

            if(revEl) revEl.innerText = app.formatCurrency(revenue);
            if(countEl) countEl.innerText = thisMonthBills.length;
            
            if(typeof inventory !== 'undefined') {
                const products = await db.products.toArray();
                const hasLowStock = products.some(p => p.stock <= inventory.LOW_STOCK_THRESHOLD);
                const dashAlert = document.getElementById('dash-low-stock-alert');
                if(dashAlert) {
                    dashAlert.style.display = hasLowStock ? 'block' : 'none';
                }
            }

        } catch (err) {
            console.error("Dashboard update error:", err);
        }
    }
};
