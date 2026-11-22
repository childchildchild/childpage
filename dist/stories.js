const stories = [
  {
    kicker: 'Полезный совет',
    title: 'Моем руки',
    text: 'Мой руки с мылом перед едой и после туалета. Маленьким детям может помочь взрослый.',
    link: 'handwashing.html',
    image: 'assets/story_hands.png',
  },
  {
    kicker: 'Вместе почитаем',
    title: 'Сказка на ночь',
    text: 'Выберите короткую сказку и попробуйте читать её по ролям. Какой герой понравится тебе больше всего?',
    image: 'assets/story_tale.png',
  },
  {
    kicker: 'Интересный вопрос',
    title: 'Звёздное небо',
    text: 'А ты когда-нибудь считал звёзды? Посмотри вечером в окно и попробуй найти самую яркую.',
    image: 'assets/story_stars.png',
  },
];

const storyScreen = document.querySelector('#story-screen');
const storyKicker = storyScreen.querySelector('.story-kicker');
const storyTitle = storyScreen.querySelector('#story-title');
const storyText = storyScreen.querySelector('.story-text');
const storyArt = storyScreen.querySelector('.story-art');
const storyLink = storyScreen.querySelector('.story-link');
const storyCounter = storyScreen.querySelector('.story-counter');
const storyBars = [...storyScreen.querySelectorAll('.story-progress>span')];
const storyPrevious = storyScreen.querySelector('.story-previous');
const storyNext = storyScreen.querySelector('.story-next');
const storyDuration = 10000;

let storyIndex = 0;
let storyElapsed = 0;
let storyFrame = 0;
let storyTimeout = 0;
let storyLastTime = 0;
let storyTrigger;
let storyTouchStart;

function paintStoryProgress() {
  storyBars.forEach((bar, index) => {
    bar.classList.toggle('finished', index < storyIndex);
    bar.firstElementChild.style.width = index === storyIndex ? `${Math.min(100, storyElapsed / storyDuration * 100)}%` : '';
  });
}

function tickStory(now) {
  if (!storyScreen.open) return;
  if (storyLastTime && !document.hidden) storyElapsed += now - storyLastTime;
  storyLastTime = now;
  if (storyElapsed >= storyDuration) {
    goToStory(storyIndex + 1);
    return;
  }
  paintStoryProgress();
  storyFrame = requestAnimationFrame(tickStory);
}

function goToStory(index) {
  if (index >= stories.length) {
    storyScreen.close();
    return;
  }
  storyIndex = Math.max(0, index);
  storyElapsed = 0;
  storyLastTime = 0;
  const story = stories[storyIndex];
  storyKicker.textContent = story.kicker;
  storyTitle.textContent = story.title;
  storyText.textContent = story.text;
  storyArt.style.backgroundImage = story.imageLoaded ? `url("${story.image}")` : '';
  storyCounter.textContent = `${storyIndex + 1} / ${stories.length}`;
  storyPrevious.disabled = storyIndex === 0;
  storyNext.setAttribute('aria-label', storyIndex === stories.length - 1 ? 'Закрыть сторис' : 'Следующая сторис');
  storyLink.hidden = !story.link;
  if (story.link) storyLink.href = story.link;
  paintStoryProgress();
  cancelAnimationFrame(storyFrame);
  clearTimeout(storyTimeout);
  storyFrame = requestAnimationFrame(tickStory);
  storyTimeout = setTimeout(() => goToStory(storyIndex + 1), storyDuration);
}

function openStory(index, trigger) {
  storyTrigger = trigger;
  document.body.classList.add('story-open');
  storyScreen.showModal();
  goToStory(index);
  storyScreen.querySelector('.story-close').focus({ preventScroll: true });
}

document.querySelectorAll('.story-preview').forEach(button => {
  button.addEventListener('click', () => openStory(Number(button.dataset.story), button));
});

stories.forEach((story, index) => {
  const image = new Image();
  image.onload = () => {
    story.imageLoaded = true;
    document.querySelectorAll(`.story-preview[data-story="${index}"]`).forEach(button => {
      button.style.backgroundImage = `url("${story.image}")`;
    });
    if (storyScreen.open && storyIndex === index) storyArt.style.backgroundImage = `url("${story.image}")`;
  };
  image.src = story.image;
});

storyScreen.querySelector('.story-close').addEventListener('click', () => storyScreen.close());
storyPrevious.addEventListener('click', () => goToStory(storyIndex - 1));
storyNext.addEventListener('click', () => goToStory(storyIndex + 1));
storyScreen.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); goToStory(storyIndex + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); goToStory(storyIndex - 1); }
});
storyScreen.addEventListener('click', event => {
  if (event.target.closest('button, a')) return;
  const rect = storyScreen.getBoundingClientRect();
  if (event.clientX < rect.left + rect.width / 3) goToStory(storyIndex - 1);
  else goToStory(storyIndex + 1);
});
storyScreen.addEventListener('touchstart', event => {
  storyTouchStart = event.touches[0].clientX;
}, { passive: true });
storyScreen.addEventListener('touchend', event => {
  if (storyTouchStart === undefined) return;
  const distance = event.changedTouches[0].clientX - storyTouchStart;
  if (Math.abs(distance) > 55) {
    event.preventDefault();
    goToStory(storyIndex + (distance < 0 ? 1 : -1));
  }
  storyTouchStart = undefined;
}, { passive: false });
document.addEventListener('visibilitychange', () => {
  storyLastTime = 0;
  clearTimeout(storyTimeout);
  if (!document.hidden && storyScreen.open) {
    storyTimeout = setTimeout(() => goToStory(storyIndex + 1), Math.max(0, storyDuration - storyElapsed));
  }
});
storyScreen.addEventListener('close', () => {
  cancelAnimationFrame(storyFrame);
  clearTimeout(storyTimeout);
  storyLastTime = 0;
  document.body.classList.remove('story-open');
  storyTrigger?.focus({ preventScroll: true });
});
