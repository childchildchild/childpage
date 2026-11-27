(() => {
  const types = {
    video: { label: 'Видео', icon: 'play-circle' },
    article: { label: 'Статья', icon: 'article' },
    tale: { label: 'Сказка', icon: 'book-open' },
    game: { label: 'Игра', icon: 'puzzle-piece' },
    audio: { label: 'Слушать', icon: 'headphones' },
  };
  const statuses = {
    new: { label: 'Новое', icon: 'sparkle' },
    interesting: { label: 'Интересно', icon: 'fire' },
  };

  function badge(doc, className, data) {
    const element = doc.createElement('span');
    element.className = className;
    const icon = doc.createElement('i');
    icon.className = `ph-bold ph-${data.icon}`;
    icon.setAttribute('aria-hidden', 'true');
    const label = doc.createElement('span');
    label.textContent = data.label;
    element.append(icon, label);
    return element;
  }

  window.childpageCardBadges = {
    decorate(visual, item) {
      visual.querySelectorAll('.card-type-badge, .card-status-badge').forEach(element => element.remove());
      visual.classList.add('card-visual');
      const doc = visual.ownerDocument;
      const inferredType = item.type === 'article' && item.category === 'tales' ? 'tale' : item.type;
      const type = Object.hasOwn(types, item.cardType || '') ? types[item.cardType]
        : Object.hasOwn(types, inferredType) ? types[inferredType] : types.article;
      visual.append(badge(doc, 'card-type-badge', type));
      if (Object.hasOwn(statuses, item.cardStatus || '')) {
        visual.append(badge(doc, `card-status-badge card-status-${item.cardStatus}`, statuses[item.cardStatus]));
      }
    },
  };
})();
