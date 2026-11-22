for (const carousel of document.querySelectorAll('[data-carousel]')) {
  const track = carousel.querySelector('.article-carousel-track');
  const previous = carousel.querySelector('[data-carousel-previous]');
  const next = carousel.querySelector('[data-carousel-next]');
  if (!track || !previous || !next) continue;

  const slides = [...track.querySelectorAll('.article-carousel-slide')];
  const update = () => {
    const index = Math.round(track.scrollLeft / track.clientWidth);
    previous.disabled = index <= 0;
    next.disabled = index >= slides.length - 1;
  };
  const move = direction => {
    const index = Math.round(track.scrollLeft / track.clientWidth);
    const target = Math.max(0, Math.min(slides.length - 1, index + direction));
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  };

  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  update();
}
