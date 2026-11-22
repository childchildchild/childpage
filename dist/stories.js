const publishedStories = (window.siteContent || []).filter(item => item.type === 'story' && item.status === 'published').sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
const stories = publishedStories.map(item => ({
  kicker: item.label,
  title: item.title,
  text: item.description,
  image: item.image,
  link: item.link,
}));

const storyScreen = document.querySelector('#story-screen');
const storyKicker = storyScreen.querySelector('.story-kicker');
const storyTitle = storyScreen.querySelector('#story-title');
const storyText = storyScreen.querySelector('.story-text');
const storyArt = storyScreen.querySelector('.story-art');
const storyLink = storyScreen.querySelector('.story-link');
document.querySelectorAll('.preview-bubbles').forEach(group => {
  stories.slice(0, group.classList.contains('small') ? 3 : 5).forEach((story, index) => {
    const button = document.createElement('button');
    button.className = 'story-preview';
    button.type = 'button';
    button.dataset.story = String(index);
    button.setAttribute('aria-label', `Открыть сторис: ${story.title}`);
    group.append(button);
  });
});
const progress = storyScreen.querySelector('.story-progress');
progress.replaceChildren(...stories.map(() => {
  const segment = document.createElement('span');
  segment.append(document.createElement('b'));
  return segment;
}));
const storyBars = [...storyScreen.querySelectorAll('.story-progress>span')];
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
  document.documentElement.classList.add('story-open');
  storyScreen.showModal();
  goToStory(index);
  storyScreen.querySelector('.story-close').focus({ preventScroll: true });
}

document.querySelectorAll('.story-preview').forEach(button => {
  button.addEventListener('click', () => openStory(Number(button.dataset.story), button));
});
const requestedStory = new URLSearchParams(location.search).get('story');
const requestedStoryIndex = publishedStories.findIndex(item => item.id === requestedStory);
if (requestedStoryIndex >= 0) requestAnimationFrame(() => openStory(requestedStoryIndex));

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
  document.documentElement.classList.remove('story-open');
  storyTrigger?.focus({ preventScroll: true });
});
