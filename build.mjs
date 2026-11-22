import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDirectory = join(dirname(fileURLToPath(import.meta.url)), 'dist');
const articles = [];

async function collectArticles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectArticles(file);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

    const html = await readFile(file, 'utf8');
    const meta = new Map();
    for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
      const attributes = new Map();
      for (const [, name, , value] of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi)) {
        attributes.set(name.toLowerCase(), value);
      }
      if (attributes.has('name')) meta.set(attributes.get('name'), attributes.get('content'));
    }

    const published = meta.get('article:published');
    if (!published) continue;
    const title = meta.get('article:title');
    const description = meta.get('article:description');
    const image = meta.get('article:image');
    if (!title || !description || !image || !Number.isFinite(Date.parse(published))) {
      throw new Error(`Invalid article metadata in ${file}`);
    }
    articles.push({
      title,
      description,
      image,
      published,
      url: relative(outputDirectory, file).split(sep).join('/'),
    });
  }
}

await collectArticles(outputDirectory);
articles.sort((a, b) => Date.parse(b.published) - Date.parse(a.published) || a.title.localeCompare(b.title, 'ru'));
await writeFile(join(outputDirectory, 'articles-data.js'), `window.siteArticles = ${JSON.stringify(articles, null, 2)};\n`);
console.log(`Indexed ${articles.length} article(s).`);
