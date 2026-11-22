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
let storyClosing = false;
let storyMotion;
let storyAnimations = 0;
const storyMotionDuration = 420;
const reduceStoryMotion = () => window.childpagePreferences?.prefersReducedMotion() || matchMedia('(prefers-reduced-motion: reduce)').matches;

function storySourceRect() {
  if (!storyTrigger?.isConnected) return null;
  const rect = storyTrigger.getBoundingClientRect();
  if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return null;
  return rect;
}

async function animateStory(opening) {
  if (reduceStoryMotion()) return;
  const rect = storySourceRect();
  if (!rect) {
    const fade = storyScreen.animate([{ opacity: opening ? 0 : 1 }, { opacity: opening ? 1 : 0 }], {
      duration: 180, easing: 'ease-in-out', fill: 'both',
    });
    storyMotion = fade;
    await fade.finished.catch(() => {});
    fade.cancel();
    return;
  }

  const image = document.createElement('div');
  image.className = 'story-transition-image';
  image.style.backgroundImage = getComputedStyle(storyTrigger).backgroundImage;
  storyScreen.append(image);
  storyAnimations += 1;
  storyScreen.classList.add('story-animating');
  const small = {
    left: `${rect.left}px`, top: `${rect.top}px`,
    width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: '50%',
  };
  const large = {
    left: '0px', top: '0px', width: `${innerWidth}px`, height: `${innerHeight}px`, borderRadius: '0px',
  };
  let animation;
  try {
    animation = image.animate(opening ? [small, large] : [large, small], {
      duration: storyMotionDuration,
      easing: opening ? 'cubic-bezier(.2,.75,.2,1)' : 'cubic-bezier(.6,0,.8,.25)',
      fill: 'both',
    });
    storyMotion = animation;
    await animation.finished;
  } catch (_) {
    // A resize or a quick second tap can interrupt the transition.
  } finally {
    if (storyMotion === animation) storyMotion = null;
    image.remove();
    storyAnimations -= 1;
    if (!storyAnimations) storyScreen.classList.remove('story-animating');
  }
}

async function closeStory() {
  if (!storyScreen.open || storyClosing) return;
  storyClosing = true;
  cancelAnimationFrame(storyFrame);
  clearTimeout(storyTimeout);
  storyMotion?.cancel();
  storyScreen.classList.remove('story-entering');
  storyScreen.classList.add('story-leaving');
  await animateStory(false);
  storyScreen.close();
}

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
    closeStory();
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

async function openStory(index, trigger) {
  if (storyScreen.open) return;
  storyTrigger = trigger;
  storyClosing = false;
  storyScreen.classList.add('story-entering');
  document.body.classList.add('story-open');
  document.documentElement.classList.add('story-open');
  storyScreen.showModal();
  goToStory(index);
  storyScreen.querySelector('.story-close').focus({ preventScroll: true });
  await animateStory(true);
  storyScreen.classList.remove('story-entering');
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

storyScreen.querySelector('.story-close').addEventListener('click', closeStory);
storyScreen.addEventListener('cancel', event => { event.preventDefault(); closeStory(); });
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
  storyScreen.classList.remove('story-entering', 'story-leaving', 'story-animating');
  storyClosing = false;
  cancelAnimationFrame(storyFrame);
  clearTimeout(storyTimeout);
  storyLastTime = 0;
  document.body.classList.remove('story-open');
  document.documentElement.classList.remove('story-open');
  storyTrigger?.focus({ preventScroll: true });
});
