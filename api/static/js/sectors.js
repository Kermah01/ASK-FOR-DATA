// Sectors Page Logic

// Simple animation on hover for sector cards
document.addEventListener('DOMContentLoaded', () => {
    const sectorCards = document.querySelectorAll('.sector-card');

    sectorCards.forEach((card, index) => {
        // Stagger animation on load
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
});
