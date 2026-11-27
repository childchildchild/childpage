import { normalizeTags } from '../content-tags.js?v=20261127-1';

export function createTagInput(root) {
  const input = root.querySelector('#tags-entry');
  const source = root.querySelector('[name=tags]');
  const chips = root.querySelector('.tag-chips');
  const error = root.querySelector('.tag-error');
  const count = root.querySelector('.tag-count');
  const feedback = root.querySelector('.tag-feedback');
  let tags = [];
  let lastError = '';
  let composing = false;
  const parts = () => input.value.split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
  const changed = () => source.dispatchEvent(new Event('input', {bubbles:true}));
  const clearError = () => { lastError = ''; error.textContent = ''; error.hidden = true; root.classList.remove('has-error'); };
  function remove(index) {
    const removed = tags[index]; tags.splice(index, 1); clearError(); render(); changed();
    feedback.textContent = `Тема «${removed}» удалена.`;
    (chips.children[Math.min(index, tags.length - 1)]?.querySelector('button') || input).focus();
  }
  function render() {
    chips.replaceChildren();
    tags.forEach((tag, index) => {
      const chip = document.createElement('span'); chip.className = 'tag-chip';
      const text = document.createElement('span'); text.className = 'tag-chip-text'; text.textContent = tag; text.title = tag;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'tag-chip-remove'; button.disabled = input.disabled; button.setAttribute('aria-label', `Удалить тему «${tag}»`);
      const icon = document.createElement('i'); icon.className = 'ph-bold ph-x'; icon.setAttribute('aria-hidden','true'); button.append(icon);
      button.addEventListener('click', () => remove(index));
      button.addEventListener('keydown', event => { if (['Backspace','Delete'].includes(event.key)) { event.preventDefault(); remove(index); } });
      chip.append(text, button); chips.append(chip);
    });
    source.value = tags.join(', '); count.textContent = `${tags.length} / 10`;
    input.placeholder = tags.length ? 'Ещё тема' : 'Например, собаки';
  }
  function commit() {
    if (composing) { lastError = 'Завершите ввод темы.'; return false; }
    clearError();
    if (!parts().length) { input.value = ''; return true; }
    try {
      const previous = tags.length;
      tags = normalizeTags([...tags, ...parts()]); input.value = ''; render(); changed();
      feedback.textContent = previous === tags.length ? 'Такая тема уже добавлена.' : `Добавлено тем: ${tags.length - previous}. Всего ${tags.length} из 10.`;
      return true;
    } catch (reason) {
      lastError = reason.message; error.textContent = lastError; error.hidden = false; root.classList.add('has-error');
      return false;
    }
  }
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if ([',',';','Enter'].includes(event.key)) { event.preventDefault(); commit(); }
    else if (event.key === 'Backspace' && !input.value && tags.length) { event.preventDefault(); chips.lastElementChild.querySelector('button').focus(); }
  });
  input.addEventListener('input', event => { clearError(); if (!event.isComposing && /[,;\n]/.test(input.value)) commit(); });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; if (/[,;\n]/.test(input.value)) commit(); });
  input.addEventListener('blur', event => { if (!input.disabled && !root.contains(event.relatedTarget)) commit(); });
  input.addEventListener('paste', event => {
    const text = event.clipboardData?.getData('text');
    if (!text || !/[,;\n]/.test(text)) return;
    event.preventDefault();
    input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end'); commit();
  });
  root.querySelector('.tag-control').addEventListener('click', event => { if (event.target.classList.contains('tag-control') || event.target === chips) input.focus(); });
  render();
  return {
    load(values) { composing = false; tags = normalizeTags(values); input.value = ''; feedback.textContent = ''; clearError(); render(); },
    values: () => [...tags, ...parts()],
    commit,
    get error() { return lastError; },
  };
}
