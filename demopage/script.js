const yearElement = document.getElementById("currentYear");
if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}

const panelsData = [
    {
        title: "Customer menu",
        number: "01",
        description: "This is where customers make their orders! centered for mobile useage, clear prices, descriptions, images and full page control, all optional and ready to deploy!",
        url: "/menu/?restaurantId=1&tableNum=1",
        image: "menu-image.png",
        linkText: "Open menu ↗",
        shadowColor: "rgba(66, 174, 245, 0.4)"
    },
    {
        title: "Kitchen display",
        number: "02",
        description: "Simple. A dashboard to show orders, their notes, with functionality to track progress and priorites in the kitchen.",
        url: "/kitchen/?restaurantId=1",
        image: "kitchen-image.png",
        linkText: "Open kitchen ↗",
        shadowColor: "rgba(243, 126, 157, 0.4)"
    },
    {
        title: "Management panel",
        number: "03",
        description: "The master control! Add/remove/edit items, item tags, orders, prices (easy discounts/price rises), and stats dashboard for insights!",
        url: "/management/?restaurantId=1",
        image: "management-image.png",
        linkText: "Open management ↗",
        shadowColor: "rgba(142, 212, 255, 0.4)"
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const panelsContainer = document.getElementById('panels-container');
    if (panelsContainer) {
        panelsData.forEach(panel => {
            const linkWrapper = document.createElement('a');
            linkWrapper.href = panel.url;
            linkWrapper.className = 'project-card-link mobile-hover-target';
            
            linkWrapper.innerHTML = `
                <div class="project-card" style="--hover-shadow: ${panel.shadowColor};">
                    <div class="card-image-placeholder">
                        <img src="${panel.image}" alt="${panel.title}" onerror="this.style.display='none'; this.parentNode.innerHTML='${panel.image}'">
                    </div>
                    <h3><span>${panel.number}</span>${panel.title}</h3>
                    <p>${panel.description}</p>
                    <span class="card-link-text">${panel.linkText}</span>
                </div>
            `;

            panelsContainer.appendChild(linkWrapper);
        });
    }

    const heroImages = ['menu-image.png', 'menu-image-2.png', 'menu-image-3.png']; 
    const slideshowContainer = document.getElementById('hero-slideshow');
    
    if (slideshowContainer) {
        heroImages.forEach((src, index) => {
            const img = document.createElement('img');
            img.src = src;
            img.alt = `Menu preview ${index + 1}`; 
            
            img.onerror = () => {
                img.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.style.position = 'absolute';
                placeholder.style.inset = '0';
                placeholder.style.display = 'flex';
                placeholder.style.alignItems = 'center';
                placeholder.style.justifyContent = 'center';
                placeholder.style.color = '#555';
                placeholder.style.fontFamily = 'monospace';
                placeholder.textContent = src;
                if(index === 0) placeholder.classList.add('active');
                slideshowContainer.appendChild(placeholder);
            };

            if(index === 0) img.classList.add('active');
            slideshowContainer.appendChild(img);
        });

        let currentSlide = 0;
        const slides = slideshowContainer.children;
        if (slides.length > 1) {
            setInterval(() => {
                if(slides[currentSlide]) slides[currentSlide].classList.remove('active');
                currentSlide = (currentSlide + 1) % slides.length;
                if(slides[currentSlide]) slides[currentSlide].classList.add('active');
            }, 4000);
        }
    }

    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
    }

    if (window.innerWidth <= 768) {
        const hoverTargets = document.querySelectorAll('.mobile-hover-target');
        const observerOptions = {
            root: null,
            rootMargin: '-40% 0px -40% 0px', 
            threshold: 0
        };
        const middleObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const card = entry.target.querySelector('.project-card') || entry.target; 
                
                if (entry.isIntersecting) {
                    card.classList.add('hover-active');
                } else {
                    card.classList.remove('hover-active');
                }
            });
        }, observerOptions);
        hoverTargets.forEach(target => middleObserver.observe(target));
    }

    const navbar = document.querySelector('.navbar');
    if (navbar) {
        const onScroll = () => {
            if (window.scrollY > 20) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }
});