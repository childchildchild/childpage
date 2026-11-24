const publishedStories = (window.siteContent || []).filter(item => item.type === 'story' && item.status === 'published').sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
const stories = publishedStories.map(item => ({
  kicker: item.label,
  title: item.title,
  text: item.description,
  image: item.image,
  video: item.mediaUrl,
  link: item.link,
}));

const storyScreen = document.querySelector('#story-screen');
const storyKicker = storyScreen.querySelector('.story-kicker');
const storyTitle = storyScreen.querySelector('#story-title');
const storyText = storyScreen.querySelector('.story-text');
const storyArt = storyScreen.querySelector('.story-art');
const storyVideo = storyScreen.querySelector('.story-video');
const storySound = storyScreen.querySelector('.story-sound');
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
let storyResumeVideo = false;
let storyClosing = false;
let storyMotion = [];
const storyMotionDuration = 360;
const reduceStoryMotion = () => window.childpagePreferences?.prefersReducedMotion() || matchMedia('(prefers-reduced-motion: reduce)').matches;

function storySourceRect() {
  if (!storyTrigger?.isConnected) return null;
  const rect = storyTrigger.getBoundingClientRect();
  if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return null;
  return rect;
}

async function animateStory(opening) {
  if (reduceStoryMotion()) return;
  const source = storySourceRect();
  const target = storyScreen.getBoundingClientRect();
  const circle = source && target.width >= innerWidth - 1 && innerWidth < 700;
  const options = { duration: storyMotionDuration, easing: opening ? 'cubic-bezier(.2,.7,.2,1)' : 'cubic-bezier(.4,0,.8,.3)', fill: 'both' };
  let frames;
  if (circle) {
    const x = source.left + source.width / 2 - target.left;
    const y = source.top + source.height / 2 - target.top;
    const start = `circle(${source.width / 2}px at ${x}px ${y}px)`;
    const end = `circle(${Math.hypot(Math.max(x, target.width - x), Math.max(y, target.height - y)) + 2}px at ${x}px ${y}px)`;
    frames = opening ? [{ clipPath: start }, { clipPath: end }] : [{ clipPath: end }, { clipPath: start }];
  } else {
    frames = opening
      ? [{ opacity: 0, transform: 'translateY(18px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }]
      : [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(18px) scale(.96)' }];
  }
  const animations = [storyScreen.animate(frames, options)];
  const contentFrames = opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }];
  for (const element of [storyScreen.querySelector('.story-header'), storyScreen.querySelector('.story-content')]) {
    animations.push(element.animate(contentFrames, { duration: opening ? 180 : 110, delay: opening ? 130 : 0, fill: 'both' }));
  }
  if (storyScreen.classList.contains('has-video')) {
    animations.push(storyVideo.animate(contentFrames, { duration: opening ? 180 : 110, delay: opening ? 130 : 0, fill: 'both' }));
  }
  storyMotion = animations;
  try {
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  } finally {
    if (storyMotion === animations) storyMotion = [];
    animations.forEach(animation => animation.cancel());
  }
}

async function closeStory() {
  if (!storyScreen.open || storyClosing) return;
  storyClosing = true;
  cancelAnimationFrame(storyFrame);
  storyVideo.pause();
  clearTimeout(storyTimeout);
  storyMotion.forEach(animation => animation.cancel());
  storyScreen.classList.remove('story-entering');
  storyScreen.classList.add('story-leaving');
  await animateStory(false);
  storyScreen.close();
}

function paintStoryProgress() {
  const duration = storyVideoCurrent() ? (Number.isFinite(storyVideo.duration) ? storyVideo.duration * 1000 : storyDuration) : storyDuration;
  storyBars.forEach((bar, index) => {
    bar.classList.toggle('finished', index < storyIndex);
    bar.firstElementChild.style.width = index === storyIndex ? `${Math.min(100, storyElapsed / duration * 100)}%` : '';
  });
}

function storyVideoCurrent() {
  return Boolean(stories[storyIndex]?.video && storyScreen.classList.contains('has-video'));
}

function tickStory(now) {
  if (!storyScreen.open) return;
  if (storyVideoCurrent()) storyElapsed = storyVideo.currentTime * 1000;
  else if (storyLastTime && !document.hidden) storyElapsed += now - storyLastTime;
  storyLastTime = now;
  if (!storyVideoCurrent() && storyElapsed >= storyDuration) {
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
  storyResumeVideo = false;
  storyVideo.pause();
  storyVideo.removeAttribute('src');
  storyVideo.load();
  const story = stories[storyIndex];
  storyKicker.textContent = story.kicker;
  storyTitle.textContent = story.title;
  storyText.textContent = story.text;
  storyArt.style.backgroundImage = story.imageLoaded ? `url("${story.image}")` : '';
  storyScreen.classList.toggle('has-video', Boolean(story.video));
  storySound.hidden = !story.video;
  storyVideo.controls = false;
  storyVideo.muted = true;
  storySound.setAttribute('aria-label', 'Включить звук');
  storySound.firstElementChild.className = 'ph-bold ph-speaker-slash';
  if (story.video) {
    storyVideo.poster = story.image || '';
    storyVideo.src = story.video;
    storyVideo.play().catch(() => { storyVideo.controls = true; });
  }
  storyLink.hidden = !story.link;
  if (story.link) storyLink.href = story.link;
  paintStoryProgress();
  cancelAnimationFrame(storyFrame);
  clearTimeout(storyTimeout);
  storyFrame = requestAnimationFrame(tickStory);
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
  if (!storyClosing) storyScreen.classList.remove('story-entering');
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
storySound.addEventListener('click', () => {
  storyVideo.muted = !storyVideo.muted;
  storySound.setAttribute('aria-label', storyVideo.muted ? 'Включить звук' : 'Выключить звук');
  storySound.firstElementChild.className = `ph-bold ph-speaker-${storyVideo.muted ? 'slash' : 'high'}`;
});
storyVideo.addEventListener('ended', () => goToStory(storyIndex + 1));
storyVideo.addEventListener('error', () => {
  if (!storyScreen.open || !storyVideoCurrent()) return;
  storyScreen.classList.remove('has-video');
  storySound.hidden = true;
  storyElapsed = 0;
  storyLastTime = 0;
});
storyScreen.addEventListener('cancel', event => { event.preventDefault(); closeStory(); });
storyScreen.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); goToStory(storyIndex + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); goToStory(storyIndex - 1); }
});
storyScreen.addEventListener('click', event => {
  if (event.target.closest('button, a') || (event.target === storyVideo && storyVideo.controls)) return;
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
  if (document.hidden && storyVideoCurrent()) {
    storyResumeVideo = !storyVideo.paused;
    storyVideo.pause();
  } else if (!document.hidden && storyVideoCurrent() && storyResumeVideo) {
    storyResumeVideo = false;
    storyVideo.play().catch(() => { storyVideo.controls = true; });
  }
});
storyScreen.addEventListener('close', () => {
  storyScreen.classList.remove('story-entering', 'story-leaving');
  storyClosing = false;
  cancelAnimationFrame(storyFrame);
  storyVideo.pause();
  clearTimeout(storyTimeout);
  storyLastTime = 0;
  document.body.classList.remove('story-open');
  document.documentElement.classList.remove('story-open');
  storyTrigger?.focus({ preventScroll: true });
});
