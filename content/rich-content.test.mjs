import assert from 'node:assert/strict';
import test from 'node:test';
import { hasRichText, normalizeRichBlocks, renderRichBody } from './rich-content.mjs';

test('normalizes formatted text, links, images, and carousels', () => {
  const blocks = normalizeRichBlocks([
    { type: 'paragraph', runs: [{ text: 'Пример', marks: ['bold', 'italic'], color: '#2962c8', href: 'https://example.com' }] },
    { type: 'image', src: 'assets/uploads/photo.jpg', alt: 'Фото' },
    { type: 'carousel', images: [{ src: 'https://example.com/1.gif', alt: 'Кадр 1' }, { src: 'assets/photo-2.png', alt: 'Кадр 2' }] },
  ]);
  assert.deepEqual(blocks[0].runs[0], { text: 'Пример', marks: ['bold', 'italic'], color: '#2962c8', href: 'https://example.com' });
  assert.equal(blocks[1].src, 'assets/uploads/photo.jpg');
  assert.equal(blocks[2].images.length, 2);
  assert.equal(hasRichText(blocks), true);
});

test('rejects unsafe media links and colors', () => {
  assert.throws(() => normalizeRichBlocks([{ type: 'image', src: 'javascript:alert(1)' }]));
  assert.throws(() => normalizeRichBlocks([{ type: 'paragraph', runs: [{ text: 'Опасный цвет', color: 'red' }] }]));
});

test('requires textual content for publish validation', () => {
  assert.equal(hasRichText([{ type: 'image', src: 'assets/photo.jpg', alt: '' }]), false);
  assert.equal(hasRichText([{ type: 'list', ordered: false, items: [[{ text: 'Пункт' }]] }]), true);
});

test('renders rich blocks with escaped text and page-relative assets', () => {
  const html = renderRichBody([
    { type: 'paragraph', runs: [{ text: '<script>alert(1)</script>', marks: ['underline'] }] },
    { type: 'image', src: 'assets/photo.jpg', alt: '"Кот"' },
  ], '../');
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /src="\.\.\/assets\/photo\.jpg"/);
  assert.match(html, /<u>/);
});
