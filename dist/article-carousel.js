import { enableMouseDrag } from './carousel-drag.js?v=20261127-1';

export function initPhotoCarousel(carousel) {
  const track = carousel.querySelector('.article-carousel-track');
  const previous = carousel.querySelector('[data-carousel-previous]');
  const next = carousel.querySelector('[data-carousel-next]');
  if (!track || !previous || !next) return;
  enableMouseDrag(track);
  const counter = carousel.querySelector('.article-carousel-count');

  const slides = [...track.querySelectorAll('.article-carousel-slide')];
  const firstImage = slides[0]?.querySelector('img');
  const fitSlides = () => {
    if (firstImage?.naturalWidth && firstImage.naturalHeight) {
      carousel.style.setProperty('--carousel-aspect-ratio', `${firstImage.naturalWidth} / ${firstImage.naturalHeight}`);
    }
  };
  if (firstImage?.complete) fitSlides();
  else firstImage?.addEventListener('load', fitSlides, { once: true });

  const update = () => {
    const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    previous.disabled = index <= 0;
    next.disabled = index >= slides.length - 1;
    if (counter) {
      const label = `${Math.max(1, Math.min(slides.length, index + 1))} из ${slides.length}`;
      if (counter.textContent !== label) counter.textContent = label;
    }
  };
  const move = direction => {
    const index = Math.round(track.scrollLeft / track.clientWidth);
    const target = Math.max(0, Math.min(slides.length - 1, index + direction));
    const reduceMotion = window.childpagePreferences?.prefersReducedMotion() || matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: target * track.clientWidth, behavior: reduceMotion ? 'instant' : 'smooth' });
  };

  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
  });
  track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  update();
}
document.querySelectorAll('[data-carousel]').forEach(initPhotoCarousel);
