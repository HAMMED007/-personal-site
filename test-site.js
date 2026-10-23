const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { escapeHtml, prepareEntries, renderList, collectionSchema } = require('./render-press');

const read = file => fs.readFileSync(path.join(__dirname, 'dist', file), 'utf8');
const data = JSON.parse(read('content/press.json'));
const entries = prepareEntries(data);
const homepage = read('index.html');
const press = read('press.html');
const conferences = read('conferences.html');

assert.equal(entries.length, data.forbes.length + data.media.length + data.partners.length);
assert.equal((homepage.match(/class="press-title"/g) || []).length, entries.length);
assert.equal((press.match(/class="press-title"/g) || []).length, entries.length);
for (const item of entries) {
  for (const html of [homepage, press]) {
    assert.ok(html.includes(`href="${escapeHtml(item.url)}"`), `Missing link: ${item.url}`);
    assert.ok(html.includes(escapeHtml(item.title)), `Missing title: ${item.title}`);
  }
}
assert.ok(homepage.includes('<details class="press-more">'));
assert.ok(!press.includes("fetch('/content/press.json')"));
assert.ok(!/<!-- PRESS_/.test(homepage + press));
assert.ok(homepage.includes('conferences.html#canada-fintech-symposium-2026'));
assert.ok(conferences.includes('id="canada-fintech-symposium-2026"'));
assert.ok(conferences.includes('2026-10-08T09:00:00-06:00'));
assert.ok(conferences.includes('Cameron Horb'));
assert.ok(conferences.includes('Jairo Riveros'));
assert.ok(homepage.includes('conferences.html#ottawa-responsible-ai-2026'));
assert.ok(homepage.includes('Spoke on the Institutional Readiness'));
assert.ok(conferences.includes('id="ottawa-responsible-ai-2026"'));
assert.ok(conferences.includes('"startDate": "2026-10-21"'));
assert.ok(conferences.includes('Charlie Cattran'));
assert.ok(conferences.includes('https://deltahacks-12.devpost.com/'));
assert.ok(conferences.includes('January 10–11, 2026'));
assert.ok(homepage.includes('id="homepage-partner-entries"'));
assert.ok(press.includes('id="partners-container"'));
assert.ok(press.includes('Forbes Japan'));
assert.ok(press.includes('Interview with OwlTing CEO featuring Oneremit'));
assert.ok(press.includes('Brand Press from Oneremit'));

const latestPress = homepage.split('id="homepage-press-entries">')[1].split('<details')[0];
assert.equal((latestPress.match(/class="press-title"/g) || []).length, 6);
assert.ok(latestPress.includes('businessday.ng'));
assert.ok(latestPress.includes('thesun.ng'));
assert.ok(latestPress.includes('thepaypers.com'));
assert.ok(!latestPress.includes('redchip.com'), 'Partner features stay separate from the latest media list.');

const schema = collectionSchema(entries);
for (const item of data.partners) {
  assert.equal(schema.hasPart.find(part => part.url === item.url)['@type'], 'WebPage');
}
const japanArticle = schema.hasPart.find(part => part.url.endsWith('/91724'));
assert.equal(japanArticle.publisher.name, 'Forbes Japan');
assert.equal(japanArticle.author.name, 'Hammed Afenifere');
const speakingSchema = JSON.parse(conferences.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(speakingSchema.itemListElement.map(item => item.position), [1, 2, 3, 4, 5, 6]);
assert.equal(prepareEntries({forbes: [], media: []}).length, 0, 'Support older CMS data without partner features.');

for (const file of fs.readdirSync(path.join(__dirname, 'dist')).filter(file => file.endsWith('.html'))) {
  const html = read(file);
  assert.ok(html.includes('data-target="200" data-suffix="M+">$200M+</span>'), `Missing updated counter: ${file}`);
  assert.ok(!html.includes('data-target="100"'), `Old current counter: ${file}`);
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    JSON.parse(match[1]);
  }
}
assert.ok(read('about.html').includes('$100M+ in payments'), 'Preserve the historical 2025 milestone.');
const article = read('posts/every-industry-comes-full-circle.html');
assert.ok(article.includes('$200M+'));
assert.ok(article.includes('<p>'));
assert.equal(collectionSchema(entries).hasPart.length, entries.length);
assert.equal(escapeHtml('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
assert.throws(() => prepareEntries({forbes: [], media: [{title:'Test', source:'Test', url:'javascript:alert(1)'}]}), /Unsafe/);
assert.throws(() => prepareEntries({forbes: [], media: [{title:'Test', source:'Test', url:'https://example.com', date:'2026-02-30'}]}), /Invalid/);
assert.throws(() => prepareEntries({forbes: [], media: [data.media[0], data.media[0]]}), /Duplicate/);
const escaped = renderList([{title:'<img src=x>', url:'https://example.com/?a=1&b=2', publisher:'A & B', group:'media'}]);
assert.ok(!escaped.includes('<img'));
assert.ok(escaped.includes('a=1&amp;b=2'));
console.log(`PASS: ${entries.length} links, static press and partner rendering, Ottawa and Calgary panels, DeltaHacks, all counters, schemas, historical figures and input safety.`);
