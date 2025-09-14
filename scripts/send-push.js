// Schedules a Monday-morning local-time push with the current Monday's theme.
// Requires env: ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY
// Usage: node scripts/send-push.js
import fs from 'node:fs/promises';

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_API_KEY;

if (!APP_ID || !API_KEY) {
  console.error('Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY');
  process.exit(1);
}

function mondayOfWeek(d) {
  const day = d.getUTCDay(); // 0=Sun..6=Sat, in UTC
  const delta = day === 0 ? -6 : (1 - day);
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() + delta);
  m.setUTCHours(0,0,0,0);
  return m;
}

function toISODateUTC(d) { return d.toISOString().slice(0,10); }

async function main() {
  const raw = await fs.readFile('public/themes.json', 'utf-8');
  const themes = JSON.parse(raw);

  // We’re running this on (or before) Monday. Find this week's Monday in UTC.
  const now = new Date();
  const monday = mondayOfWeek(now);
  const iso = toISODateUTC(monday);
  const rec = themes.find(t => t.date === iso);

  const contentsText = rec
    ? `New #MurderEveryMonday theme: ${rec.theme}`
    : `It’s #MurderEveryMonday! Check today’s theme.`;

  // Schedule at 9:00 local time for each subscriber (OneSignal handles TZ)
  // If you want a different hour, change the time string.
  const payload = {
    app_id: APP_ID,
    included_segments: ['Subscribed Users'],
    contents: { en: contentsText },
    headings: { en: '#MurderEveryMonday' },
    url: 'https://YOUR_DOMAIN_HERE/', // your site URL behind Cloudflare
    delayed_option: 'timezone',
    send_after: '2025-01-01 09:00:00 GMT-0700' // time is ignored except for hour/min; OneSignal uses recipient local TZ
  };

  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('OneSignal error:', json);
    process.exit(1);
  }
  console.log('OneSignal scheduled:', json.id);
}
main().catch(e => { console.error(e); process.exit(1); });
