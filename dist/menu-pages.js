const settingsScreen = document.querySelector('#settings-screen');
const aboutScreen = document.querySelector('#about-screen');
const supportScreen = document.querySelector('#support-screen');
const installScreen = document.querySelector('#install-screen');
const resetConfirm = document.querySelector('#reset-progress-confirm');
const resetButton = document.querySelector('#reset-progress');
const settingsFeedback = document.querySelector('#settings-feedback');
const progressKey = 'childpage-first-steps-completed';
const infoScreens = [settingsScreen, aboutScreen, supportScreen, installScreen];

function lessMotion() {
  return window.childpagePreferences?.prefersReducedMotion() || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readProgress() {
  try {
    const value = Number.parseInt(localStorage.getItem(progressKey), 10);
    return Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
  } catch {
    return null;
  }
}

function updateProgressSetting() {
  const count = readProgress();
  const status = document.querySelector('#settings-progress-status');
  if (count === null) status.textContent = 'Сохранение в этом браузере недоступно';
  else if (count === 0) status.textContent = 'Пока нет пройденных занятий';
  else status.textContent = `Пройдено ${count} ${count === 1 ? 'занятие' : count < 5 ? 'занятия' : 'занятий'}`;
  resetButton.disabled = !count;
}

function openInfo(screen, trigger) {
  if (screen.open) return;
  screen.returnFocus = trigger;
  screen.querySelector('.info-scroll').scrollTop = 0;
  if (screen === settingsScreen) updateProgressSetting();
  document.documentElement.classList.add('info-open');
  document.body.classList.add('info-open');
  screen.showModal();
  const heading = screen.querySelector('.info-header h2');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

async function closeInfo(screen) {
  if (!screen.open || screen.closing) return;
  screen.closing = true;
  if (!lessMotion()) {
    screen.getAnimations().forEach(animation => animation.cancel());
    await screen.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], {
      duration: 240, easing: 'cubic-bezier(.55,0,.9,.45)', fill: 'forwards',
    }).finished.catch(() => {});
  }
  screen.close();
}

for (const screen of infoScreens) {
  screen.querySelector('.info-back').addEventListener('click', () => closeInfo(screen));
  screen.addEventListener('cancel', event => { event.preventDefault(); closeInfo(screen); });
  screen.addEventListener('close', () => {
    screen.closing = false;
    screen.getAnimations().forEach(animation => animation.cancel());
    if (!infoScreens.some(item => item.open)) {
      document.documentElement.classList.remove('info-open');
      document.body.classList.remove('info-open');
    }
    screen.returnFocus?.focus({ preventScroll: true });
  });
}

document.querySelector('#open-settings').addEventListener('click', event => openInfo(settingsScreen, event.currentTarget));
document.querySelector('#open-about').addEventListener('click', event => openInfo(aboutScreen, event.currentTarget));
document.querySelector('#open-support').addEventListener('click', event => openInfo(supportScreen, event.currentTarget));
document.querySelector('#open-install').addEventListener('click', event => {
  updateInstallScreen();
  openInfo(installScreen, event.currentTarget);
});

const installPromptButton = document.querySelector('#install-prompt-button');
const installFeedback = document.querySelector('#install-feedback');
let pendingInstallPrompt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function updateInstallScreen() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  document.querySelector('#install-ios').hidden = android;
  document.querySelector('#install-android').hidden = ios;
  document.querySelector('#install-already').hidden = !isStandalone();
  installPromptButton.hidden = isStandalone() || !pendingInstallPrompt;
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  pendingInstallPrompt = event;
  updateInstallScreen();
});
window.addEventListener('appinstalled', () => {
  pendingInstallPrompt = null;
  installFeedback.textContent = 'Ярлык добавлен. Найдите «Детскую страницу» на экране телефона.';
  updateInstallScreen();
});
installPromptButton.addEventListener('click', async () => {
  if (!pendingInstallPrompt) return;
  const prompt = pendingInstallPrompt;
  pendingInstallPrompt = null;
  installPromptButton.hidden = true;
  try {
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'dismissed') installFeedback.textContent = 'Установку можно повторить через меню браузера.';
  } catch {
    installFeedback.textContent = 'Откройте меню браузера и выберите установку на главный экран.';
  }
});
document.querySelector('#install-copy-button').addEventListener('click', async () => {
  const address = new URL('index.html', document.baseURI).href;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(address);
    installFeedback.textContent = 'Адрес скопирован. Откройте его в браузере телефона.';
  } catch {
    const field = document.createElement('textarea');
    field.value = address;
    field.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    installFeedback.textContent = copied ? 'Адрес скопирован. Откройте его в браузере телефона.' : `Адрес сайта: ${address}`;
  }
});

const settings = [
  ['#setting-large-text', 'largeText'],
  ['#setting-reduce-motion', 'reduceMotion'],
];
for (const [selector, name] of settings) {
  const input = document.querySelector(selector);
  input.checked = window.childpagePreferences.get()[name];
  input.addEventListener('change', () => {
    const saved = window.childpagePreferences.set(name, input.checked);
    settingsFeedback.hidden = saved;
    if (!saved) settingsFeedback.textContent = 'Настройка действует сейчас, но браузер не разрешил её сохранить.';
  });
}

resetButton.addEventListener('click', () => {
  if (!resetButton.disabled) resetConfirm.showModal();
});
document.querySelector('#cancel-reset').addEventListener('click', () => resetConfirm.close());
document.querySelector('#confirm-reset').addEventListener('click', () => {
  try {
    localStorage.removeItem(progressKey);
    settingsFeedback.hidden = true;
  } catch {
    settingsFeedback.textContent = 'Не удалось сбросить прогресс в этом браузере.';
    settingsFeedback.hidden = false;
  }
  resetConfirm.close();
  updateProgressSetting();
  resetButton.focus({ preventScroll: true });
});
