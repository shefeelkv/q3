// inventory.js - Inventory Management Logic
const inventory = {
    LOW_STOCK_THRESHOLD: 5,

    load: async function() {
        await this.renderList();
    },

    renderList: async function() {
        try {
            app.showLoading('inventory-list');
            const products = await db.products.toArray();
            const tbody = document.getElementById('inventory-list');
            if(!tbody) return;
            
            let hasLowStock = false;

            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No products found. Add your first vintage item!</td></tr>';
            } else {
                tbody.innerHTML = '';
                const frag = document.createDocumentFragment();
                products.forEach(p => {
                    const isLowStock = p.stock <= this.LOW_STOCK_THRESHOLD;
                    if(isLowStock) hasLowStock = true;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="fw-bold text-dark">${p.name}</td>
                        <td><span class="badge bg-light text-dark border">${p.category || 'Standard'}</span></td>
                        <td>${app.formatCurrency(p.price)}</td>
                        <td>
                            <span class="badge ${isLowStock ? 'bg-danger' : 'bg-success'} rounded-pill px-2">
                                ${p.stock}
                            </span>
                        </td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-light border me-1" onclick="inventory.editProduct(${p.id})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-light border text-danger" onclick="inventory.deleteProduct(${p.id})"><i class="bi bi-trash"></i></button>
                        </td>
                    `;
                    frag.appendChild(tr);
                });
                tbody.appendChild(frag);
            }

            // Dashboard global banner logic
            const dashAlert = document.getElementById('dash-low-stock-alert');
            if(dashAlert) {
                dashAlert.style.display = hasLowStock ? 'block' : 'none';
            }
        } catch (err) {
            console.error("Failed to load inventory:", err);
        }
    },

    openAddModal: function() {
        document.getElementById('productModalLabel').innerText = 'Add Product';
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-category').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-stock').value = '';
    },

    editProduct: async function(id) {
        try {
            const product = await db.products.get(id);
            if(product) {
                document.getElementById('productModalLabel').innerText = 'Edit Product';
                document.getElementById('prod-id').value = product.id;
                document.getElementById('prod-name').value = product.name;
                document.getElementById('prod-category').value = product.category || '';
                document.getElementById('prod-price').value = product.price;
                document.getElementById('prod-stock').value = product.stock;
                
                // Open modal
                const modal = new bootstrap.Modal(document.getElementById('productModal'));
                modal.show();
            }
        } catch (err) {
            console.error("Error editing product:", err);
        }
    },

    saveProduct: async function() {
        try {
            const id = document.getElementById('prod-id').value;
            const name = document.getElementById('prod-name').value.trim();
            const category = document.getElementById('prod-category').value.trim();
            const price = parseFloat(document.getElementById('prod-price').value);
            const stock = parseInt(document.getElementById('prod-stock').value, 10);

            if(!name || isNaN(price) || isNaN(stock)) {
                alert('Please fill out all required fields properly.');
                return;
            }

            if(price < 0 || stock < 0) {
                alert('Price and stock cannot be negative.');
                return;
            }

            const productData = { name, category, price, stock };

            if(id) {
                await db.products.update(parseInt(id, 10), productData);
            } else {
                await db.products.add(productData);
            }

            // Close modal robustly
            const modalEl = document.getElementById('productModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if(modalInstance) modalInstance.hide();
            
            // Clean up backdrop explicitly just in case
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';

            await this.renderList();
            
            // Re-render dashboard logic if needed
            if(app.currentSection === 'dashboard' && typeof dashboard !== 'undefined') {
                dashboard.update();
            }
        } catch (err) {
            console.error("Error saving product:", err);
            alert("Error saving product. Check console.");
        }
    },

    deleteProduct: async function(id) {
        if(confirm('Are you sure you want to delete this product? It will be removed from inventory permanently.')) {
            try {
                await db.products.delete(id);
                await this.renderList();
            } catch (err) {
                console.error("Error deleting product:", err);
            }
        }
    }
};
