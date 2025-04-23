// Homepage/js/script.js
document.addEventListener('DOMContentLoaded', () => {
    // Scroll-to-top button
    const scrollBtn = document.getElementById('scroll-to-top');
    window.addEventListener('scroll', () => {
        scrollBtn.classList.toggle('visible', window.scrollY > 300);
    });
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Optional: filter projects by name
    const search = document.getElementById('search-projects');
    search.addEventListener('input', () => {
        const term = search.value.toLowerCase();
        document.querySelectorAll('.project-card').forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            card.style.display = title.includes(term) ? '' : 'none';
        });
    });
});
