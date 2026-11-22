import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { validImageBytes } from './admin.js';

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
