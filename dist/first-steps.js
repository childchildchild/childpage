const steps = [...document.querySelectorAll('[data-activity]')];
const progress = document.querySelector('.progress');
const progressNumber = document.querySelector('.progress-number');
const dialog = document.querySelector('#activity-dialog');
const dialogTitle = document.querySelector('#dialog-title');
const dialogPlaceholder = document.querySelector('#activity-placeholder');
const completeButton = document.querySelector('.complete-button');
const totalActivities = 11;
const storageKey = 'childpage-first-steps-completed';
const names = ['игры', 'медицина', 'мультики', 'книги', 'логика'];

let completed = 0;
let openedStep = -1;

try {
  const saved = Number.parseInt(localStorage.getItem(storageKey), 10);
  if (Number.isFinite(saved)) completed = Math.max(0, Math.min(steps.length, saved));
} catch {
  // The screen still works when browser storage is unavailable.
}

function renderProgress() {
  const percent = Math.round(completed / totalActivities * 100);
  progress.style.setProperty('--progress', `${percent}%`);
  progress.setAttribute('aria-label', `Прогресс: ${percent} процентов`);
  progressNumber.textContent = `${percent}%`;

  steps.forEach((step, index) => {
    const state = index < completed ? 'completed' : index === completed ? 'current' : 'locked';
    step.classList.remove('completed', 'current', 'locked');
    step.classList.add(state);
    step.disabled = state !== 'current';
    step.setAttribute('aria-label', `Занятие ${index + 1}: ${names[index]}, ${state === 'completed' ? 'пройдено' : state === 'current' ? 'можно начать' : 'пока закрыто'}`);
  });
}

steps.forEach((step, index) => {
  step.addEventListener('click', () => {
    if (index !== completed) return;
    openedStep = index;
    dialogTitle.textContent = `Занятие ${index + 1}`;
    dialogPlaceholder.replaceChildren(step.querySelector('img, svg').cloneNode(true));
    dialog.showModal();
  });
});

document.querySelector('.dialog-back').addEventListener('click', () => dialog.close());
completeButton.addEventListener('click', () => {
  if (openedStep !== completed) return;
  completed += 1;
  try { localStorage.setItem(storageKey, String(completed)); } catch {}
  dialog.close();
  renderProgress();
  steps[completed]?.focus({ preventScroll: true });
});

renderProgress();
