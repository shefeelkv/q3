// customers.js - Customer Management Logic
const customers = {
    load: async function() {
        await this.renderList();
    },

    renderList: async function() {
        try {
            app.showLoading('customers-list');
            const allCustomers = await db.customers.toArray();
            const tbody = document.getElementById('customers-list');
            if(!tbody) return;

            if(allCustomers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No customers found. Generated bills will auto-save customers here.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            const frag = document.createDocumentFragment();

            allCustomers.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="fw-bold d-flex align-items-center border-0 pt-3">
                        <div class="bg-light rounded-circle d-flex justify-content-center align-items-center me-3" style="width: 40px; height: 40px;">
                            <i class="bi bi-person text-secondary"></i>
                        </div>
                        <div>
                            ${c.name}
                            <div class="small text-muted d-block d-md-none">${c.phone || 'No phone'}</div>
                        </div>
                    </td>
                    <td class="d-none d-md-table-cell align-middle text-muted">${c.phone || '-'}</td>
                    <td class="text-success fw-bold align-middle">${app.formatCurrency(c.totalSpent || 0)}</td>
                    <td class="text-end align-middle">
                        <button class="btn btn-sm btn-light border rounded-pill px-3" onclick="app.showSection('history'); if(typeof billing !== 'undefined') { document.getElementById('history-search-input').value = '${c.name}'; billing.loadHistory(); }">View Bills</button>
                    </td>
                `;
                frag.appendChild(tr);
            });
            tbody.appendChild(frag);
        } catch (err) {
            console.error("Failed to load customers:", err);
        }
    },

    openAddModal: function() {
        document.getElementById('customerModalLabel').innerText = 'Add Customer';
        document.getElementById('cust-id').value = '';
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-phone').value = '';
    },

    saveCustomer: async function() {
        try {
            const id = document.getElementById('cust-id').value;
            const name = document.getElementById('cust-name').value.trim();
            const phone = document.getElementById('cust-phone').value.trim();

            if(!name) {
                alert('Customer name is required.');
                return;
            }

            const data = { name, phone };

            if(id) {
                const existing = await db.customers.get(parseInt(id, 10));
                if(existing) data.totalSpent = existing.totalSpent;
                await db.customers.update(parseInt(id, 10), data);
            } else {
                data.totalSpent = 0;
                await db.customers.add(data);
            }

            const modalEl = document.getElementById('customerModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if(modalInstance) modalInstance.hide();
            
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';

            await this.renderList();
        } catch (err) {
            console.error("Failed to save customer:", err);
            alert("Error saving customer.");
        }
    },

    // Used by billing.js when generating or updating a bill
    addOrUpdateFromBill: async function(name, phone, amountDifference) {
        if(!name) return null;
        try {
            const matchingName = await db.customers.where('name').equals(name).toArray();
            let existing = null;
            
            if(matchingName.length > 0) {
                if(phone) {
                    existing = matchingName.find(c => c.phone === phone);
                } else {
                    existing = matchingName[0];
                }
            }

            if(existing) {
                await db.customers.update(existing.id, {
                    phone: phone || existing.phone, 
                    totalSpent: Math.max(0, (existing.totalSpent || 0) + amountDifference)
                });
                return existing;
            } else {
                const newCust = {name, phone, totalSpent: amountDifference > 0 ? amountDifference : 0};
                const id = await db.customers.add(newCust);
                newCust.id = id;
                return newCust;
            }
        } catch (err) {
            console.error("Error auto-saving customer:", err);
            return null;
        }
    }
};
