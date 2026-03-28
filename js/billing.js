// billing.js - Billing & Exchange Logic
const billing = {
    currentItems: [],
    editingBillId: null,
    editingOriginalItems: [],

    init: async function() {
        this.currentItems = [];
        this.editingBillId = null;
        this.editingOriginalItems = [];
        
        const customerNameEl = document.getElementById('bill-customer-name');
        const customerPhoneEl = document.getElementById('bill-customer-phone');
        if(customerNameEl) customerNameEl.value = '';
        if(customerPhoneEl) customerPhoneEl.value = '';
        
        const sectionTitle = document.querySelector('#billing h2');
        if(sectionTitle) sectionTitle.innerHTML = 'New Bill';
        
        await this.loadProducts();
        this.renderCart();
    },

    loadProducts: async function() {
        try {
            const products = await db.products.toArray();
            const select = document.getElementById('bill-product-select');
            if(!select) return;
            
            select.innerHTML = '<option value="">Select a product...</option>';
            products.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} - ${app.formatCurrency(p.price)} (Stock: ${p.stock})`;
                opt.dataset.price = p.price;
                opt.dataset.name = p.name;
                opt.dataset.stock = p.stock;
                
                if(p.stock <= 0 && !this.editingBillId) {
                    opt.disabled = true;
                    opt.textContent = `${p.name} - ${app.formatCurrency(p.price)} [OUT OF STOCK]`;
                }
                select.appendChild(opt);
            });
        } catch(err) {
            console.error("Error loading products for bill:", err);
        }
    },

    addItem: function() {
        const select = document.getElementById('bill-product-select');
        const qtyInput = document.getElementById('bill-product-qty');
        const qty = parseInt(qtyInput.value, 10);
        
        if(!select.value || isNaN(qty) || qty <= 0) {
            alert('Please select a valid product and quantity.');
            return;
        }

        const opt = select.selectedOptions[0];
        const productId = parseInt(select.value, 10);
        const name = opt.dataset.name;
        const price = parseFloat(opt.dataset.price);
        const availableStock = parseInt(opt.dataset.stock, 10);

        const existingItemIndex = this.currentItems.findIndex(i => i.productId === productId);
        let requestedTotalQty = qty;
        
        if(existingItemIndex > -1) {
            requestedTotalQty += this.currentItems[existingItemIndex].qty;
        }

        let allowedStock = availableStock;
        if(this.editingBillId) {
            const origItem = this.editingOriginalItems.find(i => i.productId === productId);
            if(origItem) allowedStock += origItem.qty;
        }

        if(requestedTotalQty > allowedStock) {
            alert(`Not enough stock. Only ${allowedStock} available.`);
            return;
        }

        if(existingItemIndex > -1) {
            this.currentItems[existingItemIndex].qty += qty;
        } else {
            this.currentItems.push({
                productId,
                name,
                price,
                qty
            });
        }

        select.value = '';
        qtyInput.value = 1;
        this.renderCart();
    },

    removeItem: function(index) {
        this.currentItems.splice(index, 1);
        this.renderCart();
    },

    renderCart: function() {
        const tbody = document.getElementById('bill-items-list');
        const totalEl = document.getElementById('bill-grand-total');
        if(!tbody || !totalEl) return;

        tbody.innerHTML = '';
        let grandTotal = 0;

        if(this.currentItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Cart is empty</td></tr>';
            totalEl.innerText = '₹0.00';
            return;
        }

        this.currentItems.forEach((item, index) => {
            const total = item.qty * item.price;
            grandTotal += total;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="fw-bold text-dark pt-2">${item.name}</td>
                <td>
                    <input type="number" class="form-control form-control-sm border-0 bg-light text-center" value="${item.qty}" min="1" 
                           onchange="billing.updateItemQty(${index}, this.value)" style="width: 60px;">
                </td>
                <td class="pt-2 text-muted">${app.formatCurrency(item.price)}</td>
                <td class="text-end fw-bold pt-2">${app.formatCurrency(total)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-light border text-danger rounded-circle p-1 px-2" onclick="billing.removeItem(${index})"><i class="bi bi-x"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        totalEl.innerText = app.formatCurrency(grandTotal);
    },

    updateItemQty: function(index, newQty) {
        const qty = parseInt(newQty, 10);
        if(isNaN(qty) || qty <= 0) return;
        this.currentItems[index].qty = qty;
        this.renderCart();
    },

    generateBill: async function() {
        if(this.currentItems.length === 0) {
            alert("No items in the bill!");
            return;
        }

        const customerName = document.getElementById('bill-customer-name').value.trim();
        const customerPhone = document.getElementById('bill-customer-phone').value.trim();
        
        let grandTotal = 0;
        this.currentItems.forEach(i => grandTotal += (i.price * i.qty));

        const billData = {
            date: new Date().toISOString(),
            customerName: customerName || 'Walk-in Customer',
            customerPhone: customerPhone || '',
            total: grandTotal,
            items: JSON.parse(JSON.stringify(this.currentItems))
        };

        try {
            await db.transaction('rw', db.products, db.customers, db.bills, async () => {
                if(this.editingBillId) {
                    // Restore original items stock
                    for(const orig of this.editingOriginalItems) {
                        const product = await db.products.get(orig.productId);
                        if(product) {
                            await db.products.update(orig.productId, { stock: product.stock + orig.qty });
                        }
                    }
                    // Subtract new items stock
                    for(const curr of this.currentItems) {
                        const product = await db.products.get(curr.productId);
                        if(product) {
                            if(product.stock < curr.qty) throw new Error(`Not enough stock for ${product.name}`);
                            await db.products.update(curr.productId, { stock: product.stock - curr.qty });
                        }
                    }
                    
                    const oldBill = await db.bills.get(this.editingBillId);
                    const diff = grandTotal - oldBill.total;
                    
                    if(oldBill.customerName !== 'Walk-in Customer') {
                        await customers.addOrUpdateFromBill(oldBill.customerName, oldBill.customerPhone, diff);
                    } else if(customerName && customerName !== 'Walk-in Customer') {
                        await customers.addOrUpdateFromBill(customerName, customerPhone, grandTotal);
                    }

                    billData.date = oldBill.date; 
                    await db.bills.update(this.editingBillId, billData);
                    billData.id = this.editingBillId;

                } else {
                    for(const curr of this.currentItems) {
                        const product = await db.products.get(curr.productId);
                        if(product) {
                            if(product.stock < curr.qty) throw new Error(`Not enough stock for ${product.name}`);
                            await db.products.update(curr.productId, { stock: product.stock - curr.qty });
                        }
                    }

                    if(customerName) {
                        await customers.addOrUpdateFromBill(customerName, customerPhone, grandTotal);
                    }

                    const newId = await db.bills.add(billData);
                    billData.id = newId;
                }
            });

            this.showPreview(billData);
            this.init();
            
            if(typeof dashboard !== 'undefined') dashboard.update();

        } catch(err) {
            console.error("Transaction Error:", err);
            alert("Failed to generate bill: " + err.message);
        }
    },

    editBill: async function(billId) {
        try {
            const bill = await db.bills.get(billId);
            if(!bill) return;

            app.showSection('billing');
            
            const sectionTitle = document.querySelector('#billing h2');
            if(sectionTitle) sectionTitle.innerHTML = 'Edit Bill / Exchange - #INV-' + billId;

            this.editingBillId = bill.id;
            this.currentItems = JSON.parse(JSON.stringify(bill.items));
            this.editingOriginalItems = JSON.parse(JSON.stringify(bill.items));

            const nameEl = document.getElementById('bill-customer-name');
            const phoneEl = document.getElementById('bill-customer-phone');
            if(nameEl) nameEl.value = bill.customerName === 'Walk-in Customer' ? '' : bill.customerName;
            if(phoneEl) phoneEl.value = bill.customerPhone || '';

            await this.loadProducts();
            this.renderCart();

        } catch(err) {
            console.error("Error loading bill to edit:", err);
        }
    },

    historyLimit: 15,
    historySkip: 0,

    loadHistory: async function(reset = true) {
        try {
            if(reset) this.historySkip = 0;
            const tbody = document.getElementById('history-list');
            if(!tbody) return;

            if(reset) app.showLoading('history-list');

            // Run cleanup async in background without awaiting so UI renders faster
            this.cleanOldBills().catch(console.error);

            const searchInput = document.getElementById('history-search-input');
            const filterName = searchInput ? searchInput.value.toLowerCase() : '';
            const showDeleted = document.getElementById('toggle-deleted-bills') && document.getElementById('toggle-deleted-bills').checked;
            
            const query = db.bills.orderBy('date').reverse();
            let allMatched = await query.filter(b => {
                const isSoftDeleted = !!b.isDeleted;
                if(showDeleted && !isSoftDeleted) return false;
                if(!showDeleted && isSoftDeleted) return false;
                const cName = b.customerName ? b.customerName.toLowerCase() : '';
                if(filterName && !cName.includes(filterName)) return false;
                return true;
            }).toArray();

            const pagedBills = allMatched.slice(0, this.historySkip + this.historyLimit);
            const hasMore = allMatched.length > pagedBills.length;

            if(reset) tbody.innerHTML = '';
            const frag = document.createDocumentFragment();

            pagedBills.forEach(b => {
                const tr = document.createElement('tr');
                const d = new Date(b.date);
                const isSoftDeleted = !!b.isDeleted;
                let actionsHTML = isSoftDeleted 
                    ? `<button class="btn btn-sm btn-outline-success px-3 rounded-pill" onclick="billing.restoreBill(${b.id})"><i class="bi bi-arrow-counterclockwise"></i> Restore</button>` 
                    : `
                        <button class="btn btn-sm btn-light border px-3 rounded-pill me-1" onclick="billing.showPreviewFromId(${b.id})">Preview</button>
                        <button class="btn btn-sm btn-outline-dark px-3 rounded-pill me-1" onclick="billing.editBill(${b.id})">Exchange</button>
                        <button class="btn btn-sm btn-outline-danger px-2 rounded-circle" onclick="billing.deleteBill(${b.id})"><i class="bi bi-trash"></i></button>
                    `;

                tr.innerHTML = `
                    <td class="fw-bold">
                        #INV-${b.id} 
                        ${isSoftDeleted ? '<span class="badge bg-danger ms-2">Deleted</span>' : ''}
                    </td>
                    <td class="text-muted small">${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</td>
                    <td>
                        <span class="${isSoftDeleted ? 'text-decoration-line-through text-muted' : ''}">${b.customerName}</span>
                        <div class="small text-muted">${b.customerPhone || ''}</div>
                    </td>
                    <td class="fw-bold ${isSoftDeleted ? 'text-muted text-decoration-line-through' : 'text-success'}">${app.formatCurrency(b.total)}</td>
                    <td class="text-end">${actionsHTML}</td>
                `;
                frag.appendChild(tr);
            });

            if(pagedBills.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No bills found.</td></tr>';
            } else {
                tbody.innerHTML = '';
                tbody.appendChild(frag);
                if(hasMore) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td colspan="5" class="text-center py-3"><button class="btn btn-light border rounded-pill px-4" onclick="billing.loadMoreHistory()">Load More</button></td>`;
                    tbody.appendChild(tr);
                }
            }
        } catch (err) {
            console.error("Failed to load bill history:", err);
        }
    },

    loadMoreHistory: function() {
        this.historySkip += this.historyLimit;
        this.loadHistory(false);
    },

    deleteBill: function(billId) {
        app.confirmAction('Delete Bill?', 'Are you sure you want to delete this bill? Stock for all its items will be restored.', async () => {
            try {
                const bill = await db.bills.get(billId);
                if(!bill) return;
                
                await db.transaction('rw', db.products, db.customers, db.bills, async () => {
                    for(const item of bill.items) {
                        const product = await db.products.get(item.productId);
                        if(product) {
                            await db.products.update(item.productId, { stock: product.stock + item.qty });
                        }
                    }
                    if(bill.customerName && bill.customerName !== 'Walk-in Customer') {
                        await customers.addOrUpdateFromBill(bill.customerName, bill.customerPhone, -bill.total);
                    }
                    await db.bills.update(billId, { isDeleted: true });
                });
                
                this.loadHistory();
                if(typeof dashboard !== 'undefined') dashboard.update();
                if(typeof inventory !== 'undefined') inventory.load();
            } catch (err) {
                console.error("Error deleting bill:", err);
                alert("Failed to delete bill.");
            }
        });
    },

    restoreBill: function(billId) {
        app.confirmAction('Restore Bill?', 'Restoring this bill will deduct items from your stock again. Ensure you have enough stock before proceeding.', async () => {
            try {
                const bill = await db.bills.get(billId);
                if(!bill) return;

                await db.transaction('rw', db.products, db.customers, db.bills, async () => {
                    for(const item of bill.items) {
                        const product = await db.products.get(item.productId);
                        if(product) {
                            if(product.stock < item.qty) {
                                throw new Error(`Not enough stock for ${product.name} to restore.`);
                            }
                            await db.products.update(item.productId, { stock: product.stock - item.qty });
                        }
                    }
                    if(bill.customerName && bill.customerName !== 'Walk-in Customer') {
                        await customers.addOrUpdateFromBill(bill.customerName, bill.customerPhone, bill.total);
                    }
                    await db.bills.update(billId, { isDeleted: false });
                });
                
                this.loadHistory();
                if(typeof dashboard !== 'undefined') dashboard.update();
                if(typeof inventory !== 'undefined') inventory.load();
            } catch (err) {
                console.error("Error restoring bill:", err);
                alert("Failed to restore bill: " + err.message);
            }
        });
    },

    clearAllBills: function() {
        app.confirmAction('Clear All Bills?', 'This will soft-delete ALL active bills and restore stock for ALL items. This action cannot be undone.', async () => {
            try {
                const activeBills = await db.bills.filter(b => !b.isDeleted).toArray();
                if(activeBills.length === 0) {
                    alert('No active bills to clear.');
                    return;
                }

                await db.transaction('rw', db.products, db.customers, db.bills, async () => {
                    for(const bill of activeBills) {
                        for(const item of bill.items) {
                            const product = await db.products.get(item.productId);
                            if(product) {
                                await db.products.update(item.productId, { stock: product.stock + item.qty });
                            }
                        }
                        if(bill.customerName && bill.customerName !== 'Walk-in Customer') {
                            await customers.addOrUpdateFromBill(bill.customerName, bill.customerPhone, -bill.total);
                        }
                        await db.bills.update(bill.id, { isDeleted: true });
                    }
                });

                this.loadHistory();
                if(typeof dashboard !== 'undefined') dashboard.update();
                if(typeof inventory !== 'undefined') inventory.load();
            } catch (err) {
                console.error("Error clearing bills:", err);
                alert("Failed to clear bills: " + err.message);
            }
        });
    },

    cleanOldBills: async function() {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        try {
            const oldBills = await db.bills.filter(b => new Date(b.date) < ninetyDaysAgo).toArray();
            if(oldBills.length > 0) {
                const ids = oldBills.map(b => b.id);
                await db.bills.bulkDelete(ids);
                console.log(`Auto-deleted ${ids.length} old bills.`);
            }
        } catch(err) {
            console.error("Cleanup error:", err);
        }
    },

    showPreviewFromId: async function(id) {
        const bill = await db.bills.get(id);
        if(bill) {
            this.showPreview(bill);
        }
    },

    showPreview: function(bill) {
        document.getElementById('print-customer-name').innerText = bill.customerName;
        document.getElementById('print-customer-phone').innerText = bill.customerPhone || '';
        document.getElementById('print-bill-id').innerText = '#INV-' + bill.id;
        document.getElementById('print-bill-date').innerText = new Date(bill.date).toLocaleDateString();
        
        const tbody = document.getElementById('print-items');
        tbody.innerHTML = '';
        bill.items.forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="py-2 border-bottom-0">${i.name}</td>
                <td class="text-center py-2 border-bottom-0">${i.qty}</td>
                <td class="text-end py-2 border-bottom-0">${app.formatCurrency(i.price)}</td>
                <td class="text-end py-2 fw-bold border-bottom-0">${app.formatCurrency(i.price * i.qty)}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('print-grand-total').innerText = app.formatCurrency(bill.total);

        const modal = new bootstrap.Modal(document.getElementById('billPreviewModal'));
        modal.show();
    },

    generatePdfBlob: async function(fileName) {
        const originalElement = document.getElementById('print-area');
        if(!originalElement) throw new Error("Print area not found");

        const element = originalElement.cloneNode(true);
        const images = element.getElementsByTagName('img');
        for (let img of Array.from(images)) {
            const origImg = document.getElementById(img.id) || document.querySelector(`img[src="${img.getAttribute('src')}"]`);
            if (!origImg || origImg.naturalWidth === 0 || !origImg.complete) {
                img.parentNode.removeChild(img);
            }
        }

        const tempContainer = document.createElement('div');
        // Render off-screen rather than transparent to ensure html2canvas captures correctly without freezing
        tempContainer.style.cssText = "position: absolute; left: -9999px; top: -9999px; width: 800px; background: white; padding: 20px; z-index: -9999;";
        tempContainer.appendChild(element);
        document.body.appendChild(tempContainer);

        // Force reflow and give browser a moment to render the off-screen element
        tempContainer.offsetHeight;
        await new Promise(r => setTimeout(r, 100));

        const opt = {
            margin:       [0.5, 0.5, 0.5, 0.5],
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, // Better crispness
                useCORS: true, 
                allowTaint: true,
                logging: false,
                ignoreElements: (node) => {
                    return node.tagName === 'LINK' && node.href && (node.href.includes('fonts.googleapis') || node.href.includes('fonts.gstatic'));
                }
            },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        try {
            const worker = html2pdf().set(opt).from(tempContainer);
            const pdfBlob = await Promise.race([
                worker.output('blob'),
                new Promise((_, reject) => setTimeout(() => reject(new Error("HTML2Canvas render engine timed out.")), 15000))
            ]);
            return pdfBlob;
        } finally {
            if(document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
        }
    },

    generateImageBlob: async function(format = 'jpeg') {
        const originalElement = document.getElementById('print-area');
        if(!originalElement) throw new Error("Print area not found");

        const element = originalElement.cloneNode(true);
        const images = element.getElementsByTagName('img');
        for (let img of Array.from(images)) {
            const origImg = document.getElementById(img.id) || document.querySelector(`img[src="${img.getAttribute('src')}"]`);
            if (!origImg || origImg.naturalWidth === 0 || !origImg.complete) {
                img.parentNode.removeChild(img);
            }
        }

        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = "position: absolute; left: -9999px; top: -9999px; width: 800px; background: white; padding: 20px; z-index: -9999;";
        tempContainer.appendChild(element);
        document.body.appendChild(tempContainer);

        tempContainer.offsetHeight;
        await new Promise(r => setTimeout(r, 100));

        try {
            // Check if html2canvas is loaded globally
            if (typeof html2canvas === 'undefined') {
                throw new Error("html2canvas library is not loaded.");
            }

            const canvas = await html2canvas(tempContainer, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                ignoreElements: (node) => {
                    return node.tagName === 'LINK' && node.href && (node.href.includes('fonts.googleapis') || node.href.includes('fonts.gstatic'));
                }
            });
            
            return new Promise((resolve, reject) => {
                const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Canvas to Blob failed"));
                }, mimeType, 0.98);
            });
        } finally {
            if(document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
        }
    },

    shareBill: async function() {
        const btn = document.getElementById('btn-share-bill');
        let origContent = '';
        if(btn) {
            origContent = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Wait...';
            btn.disabled = true;
        }

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const billId = document.getElementById('print-bill-id').innerText;
            const customerPhone = document.getElementById('print-customer-phone').innerText.replace(/\D/g, '');
            const grandTotalStr = document.getElementById('print-grand-total').innerText;
            
            const textMsg = `Thank you for shopping at Q3 Fit. Your bill total is ${grandTotalStr}.`;
            const fileName = `Q3Fit-Bill-${billId.replace('#', '')}.png`;

            let imageBlob = null;
            let sharedViaAPI = false;

            try {
                imageBlob = await this.generateImageBlob('png');
                const file = new File([imageBlob], fileName, { type: 'image/png' });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Q3 Fit Invoice',
                        text: textMsg
                    });
                    sharedViaAPI = true;
                    return; // Success natively
                } else {
                    console.log("Web Share API not supported for files, falling back to WA link.");
                }
            } catch(imgErr) {
                console.error("Image Generation failed for share, falling back to WA link immediately:", imgErr);
            }

            // Fallback natively to WhatsApp link without the file attached, but try clipboard
            if (!sharedViaAPI && imageBlob && navigator.clipboard && navigator.clipboard.write) {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            [imageBlob.type]: imageBlob
                        })
                    ]);
                    alert("Bill screenshot copied to clipboard! Please paste it in the WhatsApp chat that opens.");
                } catch(clipErr) {
                    console.error("Clipboard copy failed:", clipErr);
                }
            }

            let waLink = `https://wa.me/`;
            if(customerPhone && customerPhone.length >= 10) waLink += `${customerPhone}?text=${encodeURIComponent(textMsg)}`;
            else waLink += `?text=${encodeURIComponent(textMsg)}`;
            window.open(waLink, '_blank');

        } catch(err) {
            console.error("Critical error in share flow:", err);
            alert("Failed to share the bill.");
        } finally {
            if(btn) {
                btn.innerHTML = origContent;
                btn.disabled = false;
            }
        }
    },

    printBill: function() {
        window.print();
    },

    downloadPDF: async function() {
        const btn = document.getElementById('btn-download-pdf');
        let origContent = '';
        if(btn) {
            origContent = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';
            btn.disabled = true;
        }

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const billId = document.getElementById('print-bill-id').innerText;
            const fileName = `Q3Fit-Bill-${billId.replace('#', '')}.pdf`;
            
            const pdfBlob = await this.generatePdfBlob(fileName);

            if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(pdfBlob, fileName);
            } else {
                const blobUrl = window.URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = blobUrl;
                a.download = fileName;
                document.body.appendChild(a);
                
                try {
                    a.click();
                } catch(e) {
                    window.open(blobUrl, '_blank');
                }
                
                setTimeout(() => {
                    if(document.body.contains(a)) document.body.removeChild(a);
                    window.URL.revokeObjectURL(blobUrl);
                }, 2000);
            }
        } catch(err) {
            console.error("PDF Generation fallback initiated:", err);
            alert("PDF generation failed unexpectedly. Opening native print dialog as a fallback.");
            
            const modal = document.getElementById('billPreviewModal');
            if(modal) modal.style.opacity = '0'; // Hide modal purely visually for a cleaner print raster
            setTimeout(() => {
                window.print();
                if(modal) modal.style.opacity = '1';
            }, 300);
        } finally {
            if(btn) {
                btn.innerHTML = origContent;
                btn.disabled = false;
            }
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    // Add search ui dynamically via JS to avoid rewriting HTML structure
    setTimeout(() => {
        const historyHeader = document.querySelector('#history .d-flex');
        if(historyHeader && !document.getElementById('history-search-input')) {
            const wrap = document.createElement('div');
            wrap.className = 'input-group input-group-sm w-auto';
            wrap.innerHTML = `
                <input type="text" id="history-search-input" class="form-control bg-light border-0 px-3 rounded-start-pill" placeholder="Search customer..." oninput="billing.loadHistory()">
                <button class="btn btn-light border px-3 rounded-end-pill" type="button" onclick="document.getElementById('history-search-input').value=''; billing.loadHistory();"><i class="bi bi-x"></i></button>
            `;
            historyHeader.insertBefore(wrap, historyHeader.children[1]);
        }
    }, 100);
});
