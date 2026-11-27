import '../card-badges.js?v=20261127-2';

const icon = name => `<i class="ph-bold ph-${name}" aria-hidden="true"></i>`;
const selects = new Map();
let opened;
function optionPresentation(select, option) {
  const content=document.createElement('span');content.className='select-presentation';
  if(!option){content.textContent='Выберите';return content;}
  if(select.id==='rich-color'){
    const swatch=document.createElement('span');swatch.className='select-color-swatch';swatch.style.backgroundColor=option.value;swatch.setAttribute('aria-hidden','true');content.append(swatch);
  }
  if(select.name==='cardType'||(select.name==='cardStatus'&&option.value)){
    const visual=document.createElement('span');
    window.childpageCardBadges.decorate(visual,{type:select.form?.elements.type.value||'article',category:select.form?.elements.category.value,cardType:select.name==='cardType'?option.value:undefined,cardStatus:select.name==='cardStatus'?option.value:undefined});
    content.append(visual.querySelector(select.name==='cardType'?'.card-type-badge':'.card-status-badge'));
    if(select.name==='cardType'&&!option.value){const note=document.createElement('small');note.textContent='Автоматически';content.append(note);}
  }else{const label=document.createElement('span');label.className='select-option-label';label.textContent=option.textContent;content.append(label);}
  return content;
}
export function syncSelects() {
  for (const [select, ui] of selects) {
    const option=select.selectedOptions[0];
    const signature=JSON.stringify([option?.value,option?.textContent,select.name==='cardType'?select.form?.elements.type.value:'',select.name==='cardType'?select.form?.elements.category.value:'']);
    if(signature!==ui.signature){ui.button.querySelector('.select-presentation').replaceWith(optionPresentation(select,option));ui.signature=signature;}
    ui.button.disabled=select.disabled;
  }
}
function closeSelect() { if (!opened) return; opened.menu.remove(); opened.button.setAttribute('aria-expanded', 'false'); opened.button.removeAttribute('aria-activedescendant'); opened = null; }
function enhanceSelect(select, index) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'select-trigger'; button.id = `select-control-${index}`;
  button.append(optionPresentation(select,select.selectedOptions[0]));button.insertAdjacentHTML('beforeend',icon('caret-down'));
  button.setAttribute('role', 'combobox'); button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', select.getAttribute('aria-label') || select.closest('label')?.childNodes[0]?.textContent.trim() || 'Выберите значение');
  select.hidden = true; select.after(button);
  const label = select.closest('label'); if (label) label.htmlFor = button.id;
  const ui = { button, select }; selects.set(select, ui);
  const open = () => {
    if (opened?.select === select) { closeSelect(); return; }
    closeSelect(); const menu = document.createElement('div'); menu.className = 'select-menu'; menu.id = `select-menu-${index}`; menu.setAttribute('role', 'listbox');
    button.setAttribute('aria-controls', menu.id); button.setAttribute('aria-expanded', 'true');
    let active = Math.max(0, select.selectedIndex);
    const options = [...select.options];
    const setActive = value => { active = value; [...menu.children].forEach((row, i) => row.classList.toggle('highlighted', i === active)); button.setAttribute('aria-activedescendant', `${menu.id}-${active}`); menu.children[active]?.scrollIntoView({block:'nearest'}); };
    const choose = i => { if (options[i].disabled) return; select.value = options[i].value; select.dispatchEvent(new Event('input', {bubbles:true})); select.dispatchEvent(new Event('change', {bubbles:true})); closeSelect(); syncSelects(); button.focus(); };
    options.forEach((option, i) => { const row = document.createElement('div'); row.id = `${menu.id}-${i}`; row.className = 'select-option'; row.setAttribute('role', 'option'); row.setAttribute('aria-label',option.textContent); row.setAttribute('aria-selected', String(option.selected)); row.setAttribute('aria-disabled', String(option.disabled)); row.append(optionPresentation(select,option)); if (option.selected) row.insertAdjacentHTML('beforeend', icon('check')); row.addEventListener('mousedown', e => e.preventDefault()); row.addEventListener('click', () => choose(i)); menu.append(row); });
    (select.closest('dialog') || document.body).append(menu);
    const rect = button.getBoundingClientRect(); const height = Math.min(280, menu.scrollHeight); const below = innerHeight - rect.bottom - 12;
    menu.style.width = `${Math.min(Math.max(rect.width, 190), innerWidth - 24)}px`; menu.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - parseFloat(menu.style.width) - 12))}px`;
    menu.style.top = `${below >= height || rect.top < height ? rect.bottom + 6 : Math.max(12, rect.top - height - 6)}px`;
    opened = {...ui, menu, setActive, choose, options, get active(){return active;}}; setActive(active);
  };
  button.addEventListener('click', open);
  button.addEventListener('keydown', event => {
    if (['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape','Tab'].includes(event.key)) {
      if (event.key === 'Tab') { closeSelect(); return; }
      event.preventDefault(); if (event.key === 'Escape') { closeSelect(); return; }
      if (!opened || opened.select !== select) { open(); return; }
      if (['Enter',' '].includes(event.key)) { opened.choose(opened.active); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? opened.options.length - 1 : Math.max(0, Math.min(opened.options.length - 1, opened.active + (event.key === 'ArrowDown' ? 1 : -1)));
      opened.setActive(next);
    } else if (event.key.length === 1 && opened?.select === select) { const i = opened.options.findIndex(o => o.textContent.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase())); if (i >= 0) opened.setActive(i); }
  });
  select.addEventListener('change', syncSelects);
  new MutationObserver(syncSelects).observe(select, {childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
}
export function ask({title, message, action = 'Продолжить', danger = false, input = false}) {
  const dialog = document.querySelector('#action-dialog');
  if (dialog.open) return Promise.resolve(input ? null : false);
  dialog.querySelector('h2').textContent = title; dialog.querySelector('p').textContent = message;
  const field = dialog.querySelector('label'); field.hidden = !input; field.querySelector('input').value = '';
  const accept = dialog.querySelector('[value="accept"]'); accept.textContent = action; accept.className = danger ? 'danger-button' : 'primary';
  dialog.returnValue = 'cancel'; dialog.showModal();
  (input ? field.querySelector('input') : dialog.querySelector('[value="cancel"]')).focus();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'accept' ? (input ? field.querySelector('input').value : true) : (input ? null : false)), {once:true}));
}
export function initUI(updatePreview) {
  document.querySelector('#action-dialog input').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.form.requestSubmit(event.currentTarget.form.querySelector('[value="accept"]')); }
  });
  document.querySelectorAll('select').forEach(enhanceSelect); syncSelects();
  document.querySelectorAll('dialog').forEach(dialog => new MutationObserver(() => { closeSelect(); syncSelects(); }).observe(dialog, {attributes:true,attributeFilter:['open']}));
  document.addEventListener('mousedown', e => { if (opened && !opened.menu.contains(e.target) && !opened.button.contains(e.target)) closeSelect(); });
  window.addEventListener('resize', closeSelect); document.addEventListener('scroll', e => { if (opened && !opened.menu.contains(e.target)) closeSelect(); }, true);
  document.addEventListener('reset', () => queueMicrotask(syncSelects));
  const icons = {all:'squares-four',article:'article',story:'circle',video:'play-circle',audio:'headphones',game:'puzzle-piece',trash:'trash'};
  document.querySelectorAll('.side-nav button').forEach(b => b.insertAdjacentHTML('afterbegin', icon(icons[b.dataset.filter])));
  const commands = {bold:'text-b',italic:'text-italic',underline:'text-underline',strikeThrough:'text-strikethrough',formatBlock:'text-h-two',insertUnorderedList:'list-bullets',insertOrderedList:'list-numbers'};
  document.querySelectorAll('[data-rich-command]').forEach(b => { b.innerHTML = icon(commands[b.dataset.richCommand]); b.title = b.getAttribute('aria-label'); });
  const buttonIcons = {'new-item':'plus','logout':'sign-out','back-list':'arrow-left','delete-item':'trash','crop-cover':'crop','save-draft':'floppy-disk','publish':'upload-simple','rich-insert-link':'link','rich-insert-image':'image','rich-insert-carousel':'images','expand-preview':'arrows-out','expand-preview-mobile':'arrows-out','close-preview':'x'};
  const decorate = () => { for (const [id, name] of Object.entries(buttonIcons)) { const b = document.getElementById(id); if (b && !b.querySelector('i')) b.insertAdjacentHTML('afterbegin', icon(name)); } };
  decorate(); new MutationObserver(decorate).observe(document.querySelector('#app-view'), {childList:true,subtree:true});
  document.querySelectorAll('#type-dialog .type-options button').forEach(b => { b.insertAdjacentHTML('afterbegin', icon(icons[b.value])); const small = document.createElement('small'); small.textContent = {article:'Текст, фото и карусели',story:'Короткое фото или видео',video:'Видеоматериал',audio:'Аудиозапись',game:'Ссылка на игру'}[b.value]; b.append(small); });
  const preview = document.querySelector('.preview-card'), home = preview.parentElement, modal = document.querySelector('#preview-dialog');
  for (const trigger of document.querySelectorAll('#expand-preview, #expand-preview-mobile')) trigger.addEventListener('click', () => { modal.append(preview); modal.showModal(); updatePreview(); });
  document.querySelector('#close-preview').addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => { home.prepend(preview); updatePreview(); });
  document.querySelectorAll('.media-dialog-form input[type=file]').forEach(input => {
    input.classList.add('file-input'); const label = document.createElement('label'); label.className = 'file-picker'; label.htmlFor = input.id; label.tabIndex = 0; label.setAttribute('role','button'); label.innerHTML = `${icon('upload-simple')}<span>Выбрать ${input.multiple ? 'изображения' : 'изображение'}</span>`; input.after(label);
    label.addEventListener('keydown', e => { if (['Enter',' '].includes(e.key)) { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { label.querySelector('span').textContent = input.files.length ? (input.multiple ? `Выбрано файлов: ${input.files.length}` : input.files[0].name) : 'Выбрать изображение'; });
  });
}
