const fs = require('fs');
const path = require('path');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function prepareEntries(data) {
  const seen = new Set();
  return ['forbes', 'media'].flatMap(group => {
    if (!Array.isArray(data[group])) throw new Error(`Missing press group: ${group}`);
    return data[group].map(item => {
      if (!item.title || !item.source) throw new Error('Press entries need a title and source.');
      const url = new URL(item.url);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsafe press URL.');
      if (seen.has(url.href)) throw new Error(`Duplicate press URL: ${url.href}`);
      seen.add(url.href);
      if (item.date && (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
          Number.isNaN(Date.parse(item.date)) || new Date(item.date).toISOString().slice(0, 10) !== item.date)) {
        throw new Error(`Invalid publication date: ${item.date}`);
      }
      return { ...item, group, publisher: group === 'forbes' ? 'Forbes Business Council' : item.source };
    });
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function renderList(entries) {
  return `<ul class="press-list">\n${entries.map(item => {
    const date = item.date
      ? `<time datetime="${item.date}">${new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>`
      : (item.group === 'forbes' ? escapeHtml(item.source) : '');
    const meta = [escapeHtml(item.publisher), date, item.format ? escapeHtml(item.format) : ''].filter(Boolean).join(' &middot; ');
    return `  <li class="press-item"><a class="press-title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a><span class="press-meta">${meta}</span></li>`;
  }).join('\n')}\n</ul>`;
}

function collectionSchema(entries) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Press, Media & Commentary - Hammed Afenifere',
    url: 'https://www.hammed.ca/press.html',
    description: 'Coverage of Hammed Afenifere and Oneremit, with published articles and expert commentary.',
    about: {
      '@type': 'Person', name: 'Hammed Afenifere', url: 'https://www.hammed.ca/',
      alternateName: ['Afenifere Hammed Adewumi', 'Hammed Adewumi Afenifere'],
      sameAs: [
        'https://www.linkedin.com/in/hammed-adewumi-afenifere-2169a5116/',
        'https://councils.forbes.com/profile/Hammed-Afenifere-CEO-%7C-Co-Founder-Spark-Tech-Hub-Limited/c7e782ab-624e-449c-8b92-30f391980abb'
      ]
    },
    hasPart: entries.map(item => ({
      '@type': 'Article', name: item.title, url: item.url,
      publisher: { '@type': 'Organization', name: item.publisher },
      ...(item.date ? { datePublished: item.date } : {}),
      ...(item.group === 'forbes' && item.format === 'Authored article'
        ? { author: { '@type': 'Person', name: 'Hammed Afenifere', url: 'https://www.hammed.ca/' } } : {})
    }))
  };
}

function replaceRequired(html, marker, replacement) {
  if (!html.includes(marker)) throw new Error(`Missing press template marker: ${marker}`);
  // Callback avoids interpreting dollar amounts as replacement patterns.
  return html.replace(marker, () => replacement);
}

function renderPressAssets(distDir) {
  const data = JSON.parse(fs.readFileSync(path.join(distDir, 'content', 'press.json'), 'utf8'));
  const entries = prepareEntries(data);
  const homePath = path.join(distDir, 'index.html');
  let home = fs.readFileSync(homePath, 'utf8');
  const older = entries.slice(6);
  const homeList = renderList(entries.slice(0, 6)) + (older.length
    ? `\n<details class="press-more"><summary>More press &amp; commentary (${older.length})</summary>\n${renderList(older)}\n</details>` : '');
  home = replaceRequired(home, '<!-- PRESS_HOME -->', homeList);
  fs.writeFileSync(homePath, home, 'utf8');

  const pressPath = path.join(distDir, 'press.html');
  let press = fs.readFileSync(pressPath, 'utf8');
  press = replaceRequired(press, '<!-- PRESS_FORBES -->', renderList(entries.filter(item => item.group === 'forbes')));
  press = replaceRequired(press, '<!-- PRESS_MEDIA -->', renderList(entries.filter(item => item.group === 'media')));
  const schema = JSON.stringify(collectionSchema(entries), null, 2).replace(/</g, '\\u003c');
  press = replaceRequired(press, '<!-- PRESS_SCHEMA -->', `<script type="application/ld+json">\n${schema}\n</script>`);
  fs.writeFileSync(pressPath, press, 'utf8');
  console.log(`Rendered ${entries.length} press and commentary links into the homepage and press archive.`);
}

module.exports = { escapeHtml, prepareEntries, renderList, collectionSchema, renderPressAssets };
