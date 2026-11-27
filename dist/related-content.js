import { enableMouseDrag } from './carousel-drag.js?v=20261127-1';

for (const section of document.querySelectorAll('.related-section')) {
  const track = section.querySelector('.related-track');
  enableMouseDrag(track);
  const previous = section.querySelector('[data-related-previous]');
  const next = section.querySelector('[data-related-next]');
  const controls = section.querySelector('.related-controls');
  let frame = 0;
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    controls.hidden = max < 2;
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
  };
  const move = direction => {
    const card = track.firstElementChild;
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap);
    const reduceMotion = window.childpagePreferences?.prefersReducedMotion() || matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({left:step * direction, behavior:reduceMotion ? 'instant' : 'smooth'});
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('keydown', event => {
    if (event.target !== track) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
  });
  track.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); });
  }, {passive:true});
  new ResizeObserver(update).observe(track);
  update();
}
