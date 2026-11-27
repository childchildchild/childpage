const groups = [
  ['Настроение', [['😀','улыбка'],['😊','радость'],['😍','восхищение'],['🥰','любовь'],['😂','смех'],['😮','удивление'],['🤔','задумался'],['😴','сон'],['😎','круто'],['🥳','праздник']]],
  ['Природа и животные', [['🐶','собака'],['🐱','кошка'],['🐻','медведь'],['🦊','лиса'],['🦋','бабочка'],['🌸','цветок'],['🌈','радуга'],['⭐','звезда'],['☀️','солнце'],['🌙','луна']]],
  ['Игры и открытия', [['📚','книги'],['🎨','рисование'],['🎮','игра'],['🧩','пазл'],['🎵','музыка'],['🎧','наушники'],['⚽','мяч'],['🚀','ракета'],['🔬','наука'],['💡','идея']]],
  ['Еда и добро', [['🍎','яблоко'],['🍉','арбуз'],['🍓','клубника'],['🥕','морковь'],['🍕','пицца'],['🍦','мороженое'],['🍪','печенье'],['🧃','сок'],['❤️','сердце'],['👍','нравится']]],
];

export function initEmojiPicker(trigger, picker, insert) {
  for (const [name, emojis] of groups) {
    const section = document.createElement('section');
    const heading = document.createElement('h4'); heading.textContent = name;
    const grid = document.createElement('div'); grid.className = 'emoji-grid';
    for (const [emoji, label] of emojis) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = emoji; button.dataset.emoji = emoji;
      button.setAttribute('aria-label', label);
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('click', () => { close(); insert(emoji); });
      grid.append(button);
    }
    section.append(heading, grid); picker.append(section);
  }
  function close() { picker.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }
  trigger.addEventListener('mousedown', event => event.preventDefault());
  trigger.addEventListener('click', () => {
    if (!picker.hidden) { close(); return; }
    picker.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(328, innerWidth - 24);
    const height = picker.getBoundingClientRect().height;
    const actionsTop = document.querySelector('.editor-actions')?.getBoundingClientRect().top ?? innerHeight;
    const usableBottom = Math.min(innerHeight, actionsTop);
    picker.style.width = `${width}px`;
    picker.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
    picker.style.top = `${usableBottom - rect.bottom >= height + 12 ? rect.bottom + 6 : Math.max(12, rect.top - height - 6)}px`;
    picker.querySelector('button')?.focus({preventScroll:true});
  });
  document.addEventListener('pointerdown', event => { if (!picker.hidden && !picker.contains(event.target) && !trigger.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !picker.hidden) { close(); trigger.focus(); } });
  document.addEventListener('scroll', event => { if (!picker.hidden && !picker.contains(event.target)) close(); }, true);
  window.addEventListener('resize', close);
  return close;
}
