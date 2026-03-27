// app.js - Main Application Logic & SPA Routing

const app = {
    currentSection: 'dashboard',
    
    init: function() {
        window.addEventListener('hashchange', () => this.handleHashChange());
        
        let initialSection = window.location.hash.replace('#', '');
        if (!initialSection) {
            initialSection = localStorage.getItem('last_section') || 'dashboard';
            window.location.hash = initialSection;
        } else {
            this.handleHashChange();
        }
    },

    handleHashChange: function() {
        let sectionId = window.location.hash.replace('#', '');
        const validSections = ['dashboard', 'inventory', 'billing', 'customers', 'history'];
        
        if (!validSections.includes(sectionId)) {
            sectionId = 'dashboard';
        }

        // Hide all
        document.querySelectorAll('.app-section').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show target
        const target = document.getElementById(sectionId);
        if(target) {
            target.style.display = 'block';
            this.currentSection = sectionId;
            localStorage.setItem('last_section', sectionId);
            
            // Trigger section specific loads
            if(sectionId === 'inventory' && typeof inventory !== 'undefined') inventory.load();
            if(sectionId === 'customers' && typeof customers !== 'undefined') customers.load();
            if(sectionId === 'billing' && typeof billing !== 'undefined') billing.init();
            if(sectionId === 'history' && typeof billing !== 'undefined') billing.loadHistory();
            if(sectionId === 'dashboard' && typeof dashboard !== 'undefined') dashboard.update();
        }
        
        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[href="#${sectionId}"]`) || document.querySelector(`.nav-link[onclick*="${sectionId}"]`);
        if(activeLink) activeLink.classList.add('active');
        
        // Close mobile menu if open
        const navbarCollapse = document.getElementById('navbarNav');
        if(navbarCollapse && navbarCollapse.classList.contains('show')) {
            const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
            if(bsCollapse) bsCollapse.hide();
        }
    },
    
    showSection: function(sectionId) {
        window.location.hash = sectionId;
    },
    
    formatCurrency: function(amount) {
        return '₹' + parseFloat(amount).toFixed(2);
    },
    
    formatDate: function(dateInfo) {
        const d = new Date(dateInfo);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    },

    showLoading: function(containerId) {
        const container = document.getElementById(containerId);
        if(container) {
            container.innerHTML = '<tr><td colspan="10" class="text-center py-5"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div><div class="mt-2 small text-muted">Loading data...</div></td></tr>';
        }
    },

    confirmAction: function(title, text, confirmCallback) {
        document.getElementById('confirmModalTitle').innerText = title;
        document.getElementById('confirmModalText').innerText = text;
        const btn = document.getElementById('confirmModalBtn');
        
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            const modalEl = document.getElementById('confirmModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if(modalInstance) modalInstance.hide();
            confirmCallback();
        });

        const modalEl = document.getElementById('confirmModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalInstance.show();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
