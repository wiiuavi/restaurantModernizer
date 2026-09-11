const revealElements = document.querySelectorAll(".reveal-section");
const yearElement = document.getElementById("currentYear");
const assetFrames = document.querySelectorAll(".asset-frame");
const menuSlides = [...document.querySelectorAll(".menu-slide")];
const slideDots = [...document.querySelectorAll(".slide-dot")];
const previousSlideButton = document.querySelector(".slide-previous");
const nextSlideButton = document.querySelector(".slide-next");
let activeSlideIndex = 0;

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}

assetFrames.forEach(frame => {
    const image = frame.querySelector("img");
    if (!image) return;

    image.addEventListener("error", () => {
        frame.classList.add("image-missing");
    });

    if (image.complete && image.naturalWidth === 0) {
        frame.classList.add("image-missing");
    }
});

menuSlides.forEach(slide => {
    const image = slide.querySelector("img");
    if (!image) return;

    image.addEventListener("error", () => {
        slide.classList.add("image-missing");
    });

    if (image.complete && image.naturalWidth === 0) {
        slide.classList.add("image-missing");
    }
});

function showMenuSlide(index) {
    if (!menuSlides.length) return;
    activeSlideIndex = (index + menuSlides.length) % menuSlides.length;
    menuSlides.forEach((slide, slideIndex) => {
        slide.classList.toggle("is-active", slideIndex === activeSlideIndex);
    });
    slideDots.forEach((dot, dotIndex) => {
        dot.classList.toggle("is-active", dotIndex === activeSlideIndex);
    });
}

previousSlideButton?.addEventListener("click", () => showMenuSlide(activeSlideIndex - 1));
nextSlideButton?.addEventListener("click", () => showMenuSlide(activeSlideIndex + 1));
slideDots.forEach((dot, dotIndex) => {
    dot.addEventListener("click", () => showMenuSlide(dotIndex));
});

if (menuSlides.length > 1) {
    setInterval(() => showMenuSlide(activeSlideIndex + 1), 5000);
}

const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

revealElements.forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index * 70, 350)}ms`;
    revealObserver.observe(element);
});
