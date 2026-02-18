/**
 * Ask For Data - Global Scripts
 * Shared utilities across all pages
 */
(function() {
    'use strict';

    // Mobile nav toggle
    const navToggle = document.querySelector('.nav-toggle');
    const mobileMenu = document.querySelector('.nav-mobile-menu');
    if (navToggle && mobileMenu) {
        const icon = navToggle.querySelector('i');

        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = mobileMenu.classList.toggle('active');
            if (icon) icon.className = open ? 'fas fa-times' : 'fas fa-bars';
            navToggle.setAttribute('aria-expanded', open);
        });

        // Close menu when a link is clicked
        mobileMenu.querySelectorAll('.nav-mobile-link').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
                if (icon) icon.className = 'fas fa-bars';
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });

        // Close menu on outside click
        document.addEventListener('click', (e) => {
            if (mobileMenu.classList.contains('active') && !mobileMenu.contains(e.target) && !navToggle.contains(e.target)) {
                mobileMenu.classList.remove('active');
                if (icon) icon.className = 'fas fa-bars';
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Auto-dismiss alerts after 5s
    document.querySelectorAll('.alert-dismissible').forEach(alert => {
        setTimeout(() => alert.remove(), 5000);
    });
})();
