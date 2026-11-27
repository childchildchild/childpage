import { normalizeTags } from '../content-tags.js?v=20261127-1';
import { collectTagCatalog, autocompleteTags, suggestTags } from '../tag-suggestions.js?v=20261127-1';

export function createTagInput(root) {
  const input = root.querySelector('#tags-entry');
  const source = root.querySelector('[name=tags]');
  const chips = root.querySelector('.tag-chips');
  const error = root.querySelector('.tag-error');
  const count = root.querySelector('.tag-count');
  const feedback = root.querySelector('.tag-feedback');
  const options = root.querySelector('.tag-autocomplete');
  const suggestions = root.querySelector('.tag-suggestions');
  const suggestedList = root.querySelector('.tag-suggestions-list');
  const suggestedNote = root.querySelector('.tag-suggestions-note') || document.createElement('p');
  if(!suggestedNote.parentElement){suggestedNote.className='tag-suggestions-note';suggestedNote.setAttribute('role','status');suggestions.append(suggestedNote);}
  let tags = [];
  let catalog = [];
  let context = {};
  let contextItems;
  let matches = [];
  let active = -1;
  let optionsKey = '';
  let suggestionsKey = '';
  let lastError = '';
  let composing = false;
  const parts = () => input.value.split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
  const changed = () => source.dispatchEvent(new Event('input', {bubbles:true}));
  const clearError = () => { lastError = ''; error.textContent = ''; error.hidden = true; root.classList.remove('has-error'); };
  function closeOptions() {
    options.hidden = true; active = -1; optionsKey = ''; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant');
  }
  function activate(index) {
    active = index;
    [...options.children].forEach((row,i) => { row.classList.toggle('is-active',i===index); row.setAttribute('aria-selected',String(i===index)); });
    input.setAttribute('aria-activedescendant',`tag-option-${index}`); options.children[index]?.scrollIntoView({block:'nearest'});
  }
  function addSuggested(tag, replaceInput) {
    if (input.disabled) return;
    try {
      tags = normalizeTags([...tags,tag]);
      if(replaceInput) input.value = ''; clearError(); closeOptions(); render(); changed(); input.focus();
      feedback.textContent = `Тема «${tag}» добавлена.`;
    } catch(reason) { lastError=reason.message; error.textContent=lastError; error.hidden=false; root.classList.add('has-error'); closeOptions(); }
  }
  function updateOptions() {
    const focused = input.ownerDocument.activeElement === input;
    if (!focused || composing || input.disabled || /[,;\n]/.test(input.value) || tags.length>=10) { closeOptions(); return; }
    matches = autocompleteTags(catalog,input.value,tags);
    const key=JSON.stringify(matches);
    if(key===optionsKey&&!options.hidden)return;
    optionsKey=key;
    options.replaceChildren(); active = -1;
    for (const [index,item] of matches.entries()) {
      const row = document.createElement('div'); row.className='tag-option'; row.id=`tag-option-${index}`; row.setAttribute('role','option'); row.setAttribute('aria-selected','false');
      const label=document.createElement('span');label.textContent=item.tag;
      const usage=document.createElement('small');usage.textContent=`В материалах: ${item.count}`;row.append(label,usage);
      row.addEventListener('pointerdown',event=>event.preventDefault());row.addEventListener('mousedown',event=>event.preventDefault());row.addEventListener('click',()=>addSuggested(item.tag,true));options.append(row);
    }
    options.hidden = matches.length===0; input.setAttribute('aria-expanded',String(matches.length>0)); input.removeAttribute('aria-activedescendant');
    const rect=root.querySelector('.tag-entry-area').getBoundingClientRect();const below=innerHeight-rect.bottom;options.classList.toggle('is-above',below<Math.min(260,options.scrollHeight)+8&&rect.top>below);
  }
  function updateSuggestions() {
    const proposed=suggestTags(catalog,context,tags);
    const hasText=Boolean((context.title||'').trim()||(context.description||'').trim()||(context.text||'').trim());
    const note=tags.length>=10?'Добавлено 10 тем. Удалите ненужную тему, чтобы выбрать другую.'
      : proposed.length?''
      : !catalog.length?'Сохранённых тем пока нет. Добавьте тему вручную и сохраните материал — она появится в общем списке.'
      : !hasText?'Добавьте название или текст материала — здесь появятся подходящие темы с кнопкой «+».'
      : suggestTags(catalog,context,[],1).length?'Все подходящие темы уже добавлены.'
      : 'Совпадений с существующими темами пока нет. Нужную тему можно добавить вручную в поле выше.';
    suggestions.hidden=false;suggestedNote.hidden=!note;if(suggestedNote.textContent!==note)suggestedNote.textContent=note;
    const key=JSON.stringify(proposed.map(item=>item.tag));
    if(key===suggestionsKey){suggestedList.querySelectorAll('button').forEach(button=>{button.disabled=input.disabled||tags.length>=10;});return;}
    suggestionsKey=key;
    suggestedList.replaceChildren();
    for(const item of proposed) {
      const button=document.createElement('button');button.type='button';button.className='tag-suggestion';button.disabled=input.disabled||tags.length>=10;button.setAttribute('aria-label',`Добавить тему «${item.tag}»`);
      const icon=document.createElement('i');icon.className='ph-bold ph-plus';icon.setAttribute('aria-hidden','true');
      const text=document.createElement('span');text.textContent=item.tag;button.append(icon,text);
      button.addEventListener('click',()=>addSuggested(item.tag,false));suggestedList.append(button);
    }
  }
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
    updateSuggestions(); updateOptions();
  }
  function commit() {
    if (composing) { lastError = 'Завершите ввод темы.'; return false; }
    clearError();
    if (!parts().length) { input.value = ''; return true; }
    try {
      const previous = tags.length;
      tags = normalizeTags([...tags, ...parts()]); input.value = ''; closeOptions(); render(); changed();
      feedback.textContent = previous === tags.length ? 'Такая тема уже добавлена.' : `Добавлено тем: ${tags.length - previous}. Всего ${tags.length} из 10.`;
      return true;
    } catch (reason) {
      lastError = reason.message; error.textContent = lastError; error.hidden = false; root.classList.add('has-error');
      return false;
    }
  }
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key==='Escape'&&!options.hidden) {event.preventDefault();event.stopPropagation();closeOptions();return;}
    if (['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault();if(options.hidden)updateOptions();if(!options.hidden)activate(active<0?(event.key==='ArrowDown'?0:matches.length-1):(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length);return;
    }
    if(['Enter',','].includes(event.key)&&active>=0&&!options.hidden){event.preventDefault();addSuggested(matches[active].tag,true);return;}
    if ([',',';','Enter'].includes(event.key)) { event.preventDefault(); commit(); }
    else if (event.key === 'Backspace' && !input.value && tags.length) { event.preventDefault(); chips.lastElementChild.querySelector('button').focus(); }
  });
  input.addEventListener('input', event => { clearError(); if (!event.isComposing && /[,;\n]/.test(input.value)) commit(); else updateOptions(); });
  input.addEventListener('focus',updateOptions);
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; if (/[,;\n]/.test(input.value)) commit(); else updateOptions(); });
  input.addEventListener('blur', event => { closeOptions();if (!input.disabled && !root.contains(event.relatedTarget)) commit(); });
  input.addEventListener('paste', event => {
    const text = event.clipboardData?.getData('text');
    if (!text || !/[,;\n]/.test(text)) return;
    event.preventDefault();
    input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end'); commit();
  });
  root.querySelector('.tag-control').addEventListener('click', event => { if (event.target.classList.contains('tag-control') || event.target === chips) input.focus(); });
  render();
  new MutationObserver(() => { if(input.disabled)closeOptions();suggestedList.querySelectorAll('button').forEach(button=>{button.disabled=input.disabled||tags.length>=10;}); }).observe(input,{attributes:true,attributeFilter:['disabled']});
  return {
    load(values) { composing = false; tags = normalizeTags(values); input.value = ''; feedback.textContent = ''; clearError(); closeOptions(); render(); },
    setContext(material) { context=material;if(contextItems!==material.items){contextItems=material.items;catalog=collectTagCatalog(material.items||[]);}updateSuggestions();updateOptions(); },
    values: () => [...tags, ...parts()],
    commit,
    get error() { return lastError; },
  };
}
