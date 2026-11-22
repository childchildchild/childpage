import { createHmac, timingSafeEqual } from 'node:crypto';

const repo = 'childchildchild/childpage';
const contentPath = 'content/content.json';
const cookieName = 'childpage_admin';
const maxAge = 12 * 60 * 60;
const kinds = new Set(['article', 'story', 'video', 'audio', 'game']);
const activeStatuses = new Set(['draft', 'planned', 'published']);
const statuses = new Set([...activeStatuses, 'trashed']);
const categories = new Set(['cartoons', 'games', 'for_all', 'tales', 'medicine', 'more']);
const ages = new Set(['0-3', '4-11', '12+']);
const trashLifetime = 7 * 24 * 60 * 60 * 1000;

function configurationReady() {
  return Boolean(process.env.ADMIN_SESSION_SECRET && process.env.GITHUB_CONTENT_TOKEN && process.env.ADMIN_USER_ONE && process.env.ADMIN_PASSWORD_ONE && process.env.ADMIN_USER_TWO && process.env.ADMIN_PASSWORD_TWO);
}
function constantEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}
function sign(value) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(value).digest('base64url');
}
function sessionFrom(req) {
  if (!configurationReady()) return null;
  const raw = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!raw) return null;
  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature || !constantEqual(signature, sign(encoded))) return null;
  try {
    const session = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (session.expires < Date.now() || ![process.env.ADMIN_USER_ONE, process.env.ADMIN_USER_TWO].includes(session.user)) return null;
    return session;
  } catch { return null; }
}
function setCookie(res, value, lifetime) {
  res.setHeader('Set-Cookie', `${cookieName}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${lifetime}`);
}
function response(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(payload);
}
async function github(path, options = {}) {
  const result = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_CONTENT_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(result.status === 409 ? 'Материалы изменились у другого редактора. Обновите список и повторите правку.' : `GitHub: ${data.message || result.status}`);
    error.status = result.status;
    throw error;
  }
  return data;
}
function text(value, max = 20000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
async function validate(input) {
  const { hasRichText, normalizeRichBlocks } = await import('../content/rich-content.mjs');
  if (!input || input.version !== 1 || !Array.isArray(input.items) || input.items.length > 500) throw new Error('Неверный формат материалов.');
  const seen = new Set();
  const items = input.items.map(item => {
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(item.id) || seen.has(item.id)) throw new Error('Повторяется или неверно указан идентификатор материала.');
    seen.add(item.id);
    if (!kinds.has(item.type) || !statuses.has(item.status)) throw new Error(`Проверьте тип и состояние: ${item.id}`);
    const normalized = {
      id: item.id,
      type: item.type,
      status: item.status,
      title: text(item.title, 160),
      description: text(item.description, 400),
      category: categories.has(item.category) ? item.category : 'more',
      ages: Array.isArray(item.ages) ? item.ages.filter(age => ages.has(age)) : [],
      image: text(item.image, 500),
      imageAlt: text(item.imageAlt, 200),
      label: text(item.label, 80),
      body: text(item.body, 30000),
      mediaUrl: text(item.mediaUrl, 500),
      gameUrl: text(item.gameUrl, 500),
      linkedId: text(item.linkedId, 64),
      publishedAt: text(item.publishedAt, 40),
      updatedAt: text(item.updatedAt, 40),
    };
    if (item.status === 'trashed') {
      const deletedAt = text(item.deletedAt, 40);
      if (!activeStatuses.has(item.previousStatus) || !Number.isFinite(Date.parse(deletedAt))) throw new Error(`Проверьте данные корзины: ${item.id}`);
      normalized.deletedAt = deletedAt;
      normalized.previousStatus = item.previousStatus;
    }
    if (item.bodyBlocks !== undefined) normalized.bodyBlocks = normalizeRichBlocks(item.bodyBlocks);
    if (!normalized.title || !normalized.description) throw new Error(`Заполните название и описание: ${item.id}`);
    if (item.status === 'published' && !Number.isFinite(Date.parse(item.publishedAt))) throw new Error(`Укажите дату публикации: ${item.id}`);
    if (item.status === 'published' && item.type === 'article' && !(item.bodyBlocks !== undefined ? hasRichText(normalized.bodyBlocks) : normalized.body)) throw new Error(`Добавьте текст статьи: ${item.id}`);
    if (item.status === 'published' && item.type === 'story' && !normalized.image) throw new Error(`Добавьте фото сторис: ${item.id}`);
    if (item.status === 'published' && ['video', 'audio'].includes(item.type) && !/^https:\/\//.test(normalized.mediaUrl) && !/^assets\/[a-zA-Z0-9/_\-.]+$/.test(normalized.mediaUrl)) throw new Error(`Добавьте ссылку на медиафайл: ${item.id}`);
    if (item.status === 'published' && item.type === 'game' && !/^https:\/\//.test(normalized.gameUrl) && !/^assets\/[a-zA-Z0-9/_\-.]+$/.test(normalized.gameUrl)) throw new Error(`Добавьте ссылку на игру: ${item.id}`);
    return normalized;
  });
  return { version: 1, items };
}

export default async function handler(req, res) {
  if (!configurationReady()) return response(res, 503, { error: 'Админка ещё не настроена на Vercel.' });
  if (!['GET', 'POST'].includes(req.method)) return response(res, 405, { error: 'Метод не поддерживается.' });
  const action = req.method === 'GET' ? req.query.action : req.body?.action;
  const session = sessionFrom(req);
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (origin && new URL(origin).host !== host) return response(res, 403, { error: 'Запрос с другого сайта отклонён.' });
  }

  if (action === 'login' && req.method === 'POST') {
    const user = String(req.body?.user || '');
    const password = String(req.body?.password || '');
    const valid = (
      (constantEqual(user, process.env.ADMIN_USER_ONE) && constantEqual(password, process.env.ADMIN_PASSWORD_ONE)) ||
      (constantEqual(user, process.env.ADMIN_USER_TWO) && constantEqual(password, process.env.ADMIN_PASSWORD_TWO))
    );
    if (!valid) return response(res, 401, { error: 'Неверный логин или пароль.' });
    const encoded = Buffer.from(JSON.stringify({ user, expires: Date.now() + maxAge * 1000 })).toString('base64url');
    setCookie(res, `${encoded}.${sign(encoded)}`, maxAge);
    return response(res, 200, { user });
  }
  if (action === 'logout' && req.method === 'POST') {
    setCookie(res, '', 0);
    return response(res, 200, { ok: true });
  }
  if (!session) return response(res, 401, { error: 'Войдите в админку.' });
  if (action === 'session' && req.method === 'GET') return response(res, 200, { user: session.user });
  try {
    if (action === 'content' && req.method === 'GET') {
      const file = await github(`${contentPath}?ref=main`);
      const content = JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8'));
      const items = content.items.filter(item => item.status !== 'trashed' || Date.parse(item.deletedAt) > Date.now() - trashLifetime);
      if (items.length !== content.items.length) {
        const cleaned = await validate({ version: content.version, items });
        const updated = await github(contentPath, { method: 'PUT', body: JSON.stringify({ message: `Content: expire trash by ${session.user}`, content: Buffer.from(JSON.stringify(cleaned, null, 2) + '\n').toString('base64'), sha: file.sha, branch: 'main' }) });
        return response(res, 200, { content: cleaned, sha: updated.content.sha });
      }
      return response(res, 200, { content, sha: file.sha });
    }
    if (action === 'save' && req.method === 'POST') {
      const content = await validate(req.body?.content);
      const sha = String(req.body?.sha || '');
      if (!/^[a-f0-9]{40}$/.test(sha)) return response(res, 400, { error: 'Обновите список материалов.' });
      const file = await github(contentPath, { method: 'PUT', body: JSON.stringify({ message: `Content: update by ${session.user}`, content: Buffer.from(JSON.stringify(content, null, 2) + '\n').toString('base64'), sha, branch: 'main' }) });
      return response(res, 200, { sha: file.content.sha, commit: file.commit.sha });
    }
    if (action === 'upload' && req.method === 'POST') {
      const type = String(req.body?.mime || '');
      const formats = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
      if (!formats[type]) return response(res, 400, { error: 'Загрузите JPG, PNG, WebP или AVIF.' });
      const data = String(req.body?.base64 || '');
      if (data.length > 3_700_000 || !/^[a-zA-Z0-9+/=]+$/.test(data)) return response(res, 400, { error: 'Изображение должно быть меньше 2,5 МБ.' });
      const path = `dist/assets/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${formats[type]}`;
      await github(path, { method: 'PUT', body: JSON.stringify({ message: `Content: upload image by ${session.user}`, content: data, branch: 'main' }) });
      return response(res, 200, { path: path.replace(/^dist\//, '') });
    }
    return response(res, 404, { error: 'Действие не найдено.' });
  } catch (error) {
    return response(res, error.status === 409 ? 409 : 500, { error: error.message || 'Не удалось выполнить действие.' });
  }
}
