const initialized = new WeakSet();
export function enableMouseDrag(track) {
  if (initialized.has(track)) return;
  initialized.add(track);
  track.classList.add('carousel-draggable');
  let drag = null;
  let suppressClick = false;
  track.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    suppressClick = false;
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY, left:track.scrollLeft, active:false};
  });
  track.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.active && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(event.clientY - drag.y)) {
      drag.active = true;
      track.classList.add('is-dragging');
      track.setPointerCapture(event.pointerId);
    }
    if (!drag.active) return;
    event.preventDefault();
    track.scrollLeft = drag.left - dx;
  });
  const finish = event => {
    if (!drag || event.pointerId !== drag.id) return;
    suppressClick = drag.active;
    const id = drag.id;
    drag = null;
    track.classList.remove('is-dragging');
    if (track.hasPointerCapture(id)) track.releasePointerCapture(id);
  };
  track.addEventListener('pointerup', finish);
  track.addEventListener('pointercancel', finish);
  track.addEventListener('lostpointercapture', finish);
  track.addEventListener('pointerleave', () => { if (drag && !drag.active) drag = null; });
  track.addEventListener('dragstart', event => event.preventDefault());
  track.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    event.preventDefault(); event.stopPropagation(); suppressClick = false;
  }, true);
}
