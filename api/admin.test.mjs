import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { validImageBytes, validStoryVideoBytes, validate, validMaterialUrl } from './admin.js';

test('allows unfinished drafts while keeping published and planned cards complete', async () => {
  const item = { id: 'unfinished-draft', type: 'article', status: 'draft', title: '', description: '', body: '', mediaUrl: 'unfinished link' };
  const result = await validate({ version: 1, items: [item] });
  assert.equal(result.items[0].title, '');
  for (const status of ['published', 'planned']) await assert.rejects(validate({ version: 1, items: [{ ...item, status }] }));
});

test('accepts HTTPS and site assets, rejects malformed URLs and traversal', async () => {
  for (const url of ['https://example.org/video.mp4?key=public', 'assets/uploads/video.mp4']) assert.equal(validMaterialUrl(url, true), true);
  for (const url of ['https://', 'javascript:alert(1)', 'http://example.org/', 'assets/../api/admin', 'assets//file.png']) assert.equal(validMaterialUrl(url), false, url);
  const item = { id: 'bad-video', type: 'video', status: 'published', title: 'Video', description: 'Description', publishedAt: '2026-11-27T00:00:00Z', mediaUrl: 'https://' };
  await assert.rejects(validate({ version: 1, items: [item] }));
});

test('keeps card badges separate from publication status when saving content', async () => {
  const item = { id: 'badge-example', type: 'article', status: 'published', title: 'Example', description: 'Description', body: 'Article text', publishedAt: '2026-11-27T00:00:00Z', cardType: 'tale', cardStatus: 'interesting' };
  const saved = await validate({ version: 1, items: [item] });
  assert.equal(saved.items[0].status, 'published');
  assert.equal(saved.items[0].type, 'article');
  assert.equal(saved.items[0].cardType, 'tale');
  assert.equal(saved.items[0].cardStatus, 'interesting');
  const legacy = await validate({ version: 1, items: [{ ...item, cardType: undefined, cardStatus: undefined }] });
  assert.equal(legacy.items[0].cardStatus, '');
});

test('rejects unknown card types and multiple status stickers', async () => {
  const item = { id: 'badge-example', type: 'article', status: 'draft', title: 'Example', description: 'Description' };
  for (const metadata of [{ cardType: 'unknown' }, { cardStatus: ['new', 'interesting'] }, { cardStatus: 'published' }]) {
    await assert.rejects(validate({ version: 1, items: [{ ...item, ...metadata }] }));
  }
});

test('accepts image signatures only for their declared formats', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const webp = Buffer.from('RIFF0000WEBP', 'ascii');
  const avif = Buffer.from('0000ftypavif0000', 'ascii');
  assert.equal(validImageBytes('image/jpeg', jpeg), true);
  assert.equal(validImageBytes('image/png', png), true);
  assert.equal(validImageBytes('image/webp', webp), true);
  assert.equal(validImageBytes('image/avif', avif), true);
  assert.equal(validImageBytes('image/png', jpeg), false);
  assert.equal(validImageBytes('image/jpeg', Buffer.from('<html>')), false);
  assert.equal(validImageBytes('image/jpeg', Buffer.alloc(2_500_001)), false);
});

test('accepts small MP4 uploads with an MP4 file signature', () => {
  assert.equal(validStoryVideoBytes('video/mp4', Buffer.from('0000ftypisom0000', 'ascii')), true);
  assert.equal(validStoryVideoBytes('video/mp4', Buffer.from('<html>not a video</html>')), false);
  assert.equal(validStoryVideoBytes('video/webm', Buffer.from('0000ftypisom0000', 'ascii')), false);
  assert.equal(validStoryVideoBytes('video/mp4', Buffer.alloc(2_500_001)), false);
});

test('rejects cross-site and malformed Origin headers before login', async () => {
  const names = ['ADMIN_SESSION_SECRET', 'GITHUB_CONTENT_TOKEN', 'ADMIN_USER_ONE', 'ADMIN_PASSWORD_ONE', 'ADMIN_USER_TWO', 'ADMIN_PASSWORD_TWO'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  names.forEach(name => { process.env[name] = 'test-value'; });
  try {
    for (const origin of ['https://other.example', 'http://childpage.example', 'null']) {
      const headers = {};
      const res = {
        setHeader(name, value) { headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
      };
      await handler({ method: 'POST', headers: { host: 'childpage.example', origin }, body: { action: 'login' } }, res);
      assert.equal(res.statusCode, 403, origin);
      assert.equal(headers['Cache-Control'], 'no-store');
    }
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
