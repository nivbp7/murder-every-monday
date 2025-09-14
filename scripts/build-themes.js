// Scrape the WordPress theme list and write ./public/themes.json
// Usage: node scripts/build-themes.js [--debug]
import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';

const DEBUG = process.argv.includes('--debug');

const SOURCE =
  process.env.THEMES_SOURCE_URL ||
  'https://crossexaminingcrime.wordpress.com/murdereverymonday-theme-list/';

// Helpers
const MONTHS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];
const monthToNum = (name) => {
  if (!name) return null;
  const i = MONTHS.indexOf(name.toLowerCase());
  return i >= 0 ? i + 1 : null;
};
const stripOrdinal = (s) => Number(String(s).trim().replace(/(st|nd|rd|th)$/i, ''));
const clean = (s) =>
  String(s)
    // normalize NBSP and fancy dashes
    .replace(/\u00a0/g, ' ')
    .replace(/\u2013|\u2014/g, '–')
    .replace(/\s+/g, ' ')
    .trim();

const isMonthYear = (s) => /^[A-Za-z]+\s+\d{4}$/.test(s);

// Matches:
//  "13th – Love ..."
//  "1st January: Cover ..."
//  "5th June – Cover ..."
//  "20th: Something ..." (month comes from header)
const DATE_LINE = /^(\d{1,2})(?:st|nd|rd|th)?\s*([A-Za-z]+)?\s*[:–-]\s*(.+)$/;

// Fetch & load article HTML
async function fetchHTML(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'gh-action-mem' } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return res.text();
}

async function build() {
  const html = await fetchHTML(SOURCE);
  const $ = cheerio.load(html);

  // WordPress usually puts the post body in .entry-content within <article>
  const $content =
    $('article .entry-content').first().length
      ? $('article .entry-content').first()
      : $('.entry-content').first();

  // Walk paragraph-like blocks in order; split into logical lines.
  const rawLines = [];
  $content.children().each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    if (['p','div','li'].includes(tag)) {
      const t = clean($(el).text());
      if (t) rawLines.push(...t.split(/\n/).map(clean).filter(Boolean));
    }
  });

  if (DEBUG) {
    console.log('First 30 lines:\n', rawLines.slice(0, 30));
  }

  let curMonth = null;
  let curYear = null;
  const items = [];

  for (const line0 of rawLines) {
    const line = clean(line0);

    // Month header? e.g. "September 2025"
    if (isMonthYear(line)) {
      const [mName, yStr] = line.split(/\s+/);
      curMonth = mName;
      curYear = Number(yStr);
      continue;
    }

    // Date line?
    const m = line.match(DATE_LINE);
    if (m) {
      const day = stripOrdinal(m[1]);
      const inlineMonthName = m[2]; // may be undefined
      const themeText = clean(m[3]);

      const month = inlineMonthName ? monthToNum(inlineMonthName) : monthToNum(curMonth);
      const year = curYear;

      if (!day || !month || !year) {
        if (DEBUG) console.warn('Skip (missing y/m/d):', { line, day, month, year });
        continue;
      }

      const iso = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
      items.push({ date: iso, theme: themeText });
      continue;
    }
  }

  // De-duplicate by date (keep last occurrence), then sort
  const map = new Map();
  for (const it of items) map.set(it.date, it.theme);
  const dedup = Array.from(map.entries())
    .map(([date, theme]) => ({ date, theme }))
    .sort((a, b) => a.date.localeCompare(b.date));

  await fs.mkdir('public', { recursive: true });
  await fs.writeFile('public/themes.json', JSON.stringify(dedup, null, 2));
  console.log(`Wrote ${dedup.length} records to public/themes.json`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
