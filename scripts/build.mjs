// Builds the animated SVGs for the profile README from live GitHub data.
// Run: GITHUB_TOKEN=... node scripts/build.mjs   (the daily workflow does this)
import { mkdirSync, writeFileSync } from 'node:fs';

const LOGIN = 'Yungflashh';
const OUT = new URL('../assets/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ── Look ──
const C = {
  bg: '#07090f',
  panel: '#0c111c',
  line: 'rgba(255,255,255,0.07)',
  text: '#eef1f7',
  muted: '#8a94a8',
  orange: '#ff8c42',
  pink: '#ff3d81',
  violet: '#7c5cff',
  teal: '#2dd4bf',
};
const SANS = `'Segoe UI', Ubuntu, 'Helvetica Neue', Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => Number(n).toLocaleString('en-US');
const gradient = (id, extra = '') => `
  <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0" ${extra}>
    <stop offset="0" stop-color="${C.orange}"/>
    <stop offset="0.5" stop-color="${C.pink}"/>
    <stop offset="1" stop-color="${C.violet}"/>
  </linearGradient>`;
const write = (name, svg) => writeFileSync(new URL(name, OUT), svg.trim() + '\n');

// ── Data ──
async function fetchData() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required');
  const query = `query {
    user(login: "${LOGIN}") {
      createdAt
      followers { totalCount }
      repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100, orderBy: {field: PUSHED_AT, direction: DESC}) {
        totalCount
        nodes { languages(first: 6, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name color } } } }
      }
      contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } } }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-builder' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!json.data?.user) throw new Error(`GitHub said: ${JSON.stringify(json.errors || json).slice(0, 300)}`);
  const u = json.data.user;

  const days = u.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  const weeks = u.contributionsCollection.contributionCalendar.weeks;
  let longest = 0, run = 0;
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  // Current streak: today may still be empty, so start from yesterday in that case
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) current++;
    else if (i === days.length - 1) continue;
    else break;
  }
  const best = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a), days[0]);

  const langs = new Map();
  for (const r of u.repositories.nodes) {
    for (const e of r.languages.edges) {
      const cur = langs.get(e.node.name) || { size: 0, color: e.node.color || C.muted };
      cur.size += e.size;
      langs.set(e.node.name, cur);
    }
  }
  const totalSize = [...langs.values()].reduce((a, l) => a + l.size, 0) || 1;
  const topLangs = [...langs.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 6)
    .map(([name, l]) => ({ name, color: l.color, pct: (l.size / totalSize) * 100 }));

  return {
    total: u.contributionsCollection.contributionCalendar.totalContributions,
    activeDays: days.filter((d) => d.contributionCount > 0).length,
    dayCount: days.length,
    current, longest, best,
    repos: u.repositories.totalCount,
    followers: u.followers.totalCount,
    since: new Date(u.createdAt).getFullYear(),
    weeks, topLangs,
  };
}

// ── 1. Hero ──
function hero(d) {
  const W = 1200, H = 420;
  const lines = [
    ['Roomie', 'find a roommate you can actually live with'],
    ['SharpLook', 'book your barber or stylist in two taps'],
    ['VendorSpot', '120+ endpoints, one marketplace for local vendors'],
    ['GadgetVault', 'check a phone is legit before you pay for it'],
  ];
  const cycle = lines.length * 3.2;
  const ticker = lines.map(([name, what], i) => `
    <g class="tick" style="animation-delay:${(i * 3.2).toFixed(1)}s"${i ? ' opacity="0"' : ''}>
      <text x="72" y="304" font-family="${MONO}" font-size="19" fill="${C.muted}">
        <tspan fill="${C.teal}">▸ </tspan><tspan fill="${C.text}" font-weight="700">${esc(name)}</tspan><tspan dx="12">${esc(what)}</tspan>
      </text>
    </g>`).join('');

  const cx = 975, cy = 205;
  const orbit = (r, dur, dots, colour, reverse) => `
    <g class="spin" style="animation-duration:${dur}s;${reverse ? 'animation-direction:reverse;' : ''}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.line}" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#g)" stroke-width="1.4" stroke-dasharray="${(r * 0.9).toFixed(0)} ${(r * 5.4).toFixed(0)}" stroke-linecap="round" opacity="0.9"/>
      ${dots.map((a) => {
        const x = cx + r * Math.cos((a * Math.PI) / 180), y = cy + r * Math.sin((a * Math.PI) / 180);
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${colour}" filter="url(#glow)"/>`;
      }).join('')}
    </g>`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="David Adenusi. I ship products people actually use.">
  <defs>
    ${gradient('g')}
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.orange}"/><stop offset="0.35" stop-color="${C.pink}"/>
      <stop offset="0.5" stop-color="#ffffff"/><stop offset="0.65" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.violet}"/>
      <animate attributeName="x1" values="-1;1" dur="6s" repeatCount="indefinite"/>
      <animate attributeName="x2" values="0;2" dur="6s" repeatCount="indefinite"/>
    </linearGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
    <filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="rgba(255,255,255,0.045)" stroke-width="1"/>
    </pattern>
    <clipPath id="card"><rect width="${W}" height="${H}" rx="26"/></clipPath>
    <style>
      .pre { white-space: pre; }
      .blob { animation: drift 18s ease-in-out infinite alternate; }
      .b2 { animation-duration: 23s; animation-delay: -6s; }
      .b3 { animation-duration: 27s; animation-delay: -12s; }
      @keyframes drift { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(90px,-40px) scale(1.15); } 100% { transform: translate(-60px,50px) scale(0.92); } }
      .gridmove { animation: grid 8s linear infinite; }
      @keyframes grid { to { transform: translate(40px,40px); } }
      .rise { animation: rise 0.9s cubic-bezier(.2,.8,.2,1) backwards; }
      @keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
      .tick { animation: tick ${cycle}s ease-in-out infinite; }
      @keyframes tick { 0% { opacity: 0; transform: translateY(10px); } 3%, 22% { opacity: 1; transform: none; } 25%, 100% { opacity: 0; transform: translateY(-10px); } }
      .spin { transform-origin: ${cx}px ${cy}px; animation: spin 20s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .pulse { transform-origin: ${cx}px ${cy}px; animation: pulse 3.2s ease-in-out infinite; }
      @keyframes pulse { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.12); opacity: .9; } }
      .blink { animation: blink 1.1s steps(1) infinite; }
      @keyframes blink { 50% { opacity: 0; } }
    </style>
  </defs>

  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    <g opacity="0.75">
      <circle class="blob" cx="260" cy="120" r="170" fill="${C.orange}" filter="url(#blur)" opacity="0.45"/>
      <circle class="blob b2" cx="760" cy="330" r="190" fill="${C.pink}" filter="url(#blur)" opacity="0.35"/>
      <circle class="blob b3" cx="1050" cy="80" r="160" fill="${C.violet}" filter="url(#blur)" opacity="0.45"/>
    </g>
    <g class="gridmove"><rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" fill="url(#grid)"/></g>

    <g class="rise" style="animation-delay:.1s">
      <rect x="72" y="62" width="250" height="32" rx="16" fill="rgba(255,255,255,0.06)" stroke="${C.line}"/>
      <circle cx="92" cy="78" r="5" fill="${C.teal}"><animate attributeName="opacity" values="1;.25;1" dur="1.6s" repeatCount="indefinite"/></circle>
      <text x="106" y="83" font-family="${MONO}" font-size="14" fill="${C.text}">shipping from Lagos, NG</text>
    </g>

    <g class="rise" style="animation-delay:.35s">
      <text x="70" y="160" font-family="${SANS}" font-size="62" font-weight="800" fill="${C.text}" letter-spacing="-1.5">Hi, I'm David.</text>
    </g>
    <g class="rise" style="animation-delay:.6s">
      <text x="70" y="232" font-family="${SANS}" font-size="56" font-weight="800" fill="url(#shine)" letter-spacing="-1.5">I ship what people use.</text>
    </g>

    <g class="rise" style="animation-delay:.95s">${ticker}</g>

    <g class="rise" style="animation-delay:1.2s" font-family="${MONO}" font-size="14">
      <text x="72" y="362" fill="${C.muted}">
        <tspan fill="${C.orange}" font-weight="700">${fmt(d.total)}</tspan> contributions this year  <tspan fill="${C.line}">/</tspan>
        <tspan fill="${C.pink}" font-weight="700">${d.activeDays}</tspan> of ${d.dayCount} days active  <tspan fill="${C.line}">/</tspan>
        full-stack · mobile · founder<tspan class="blink" fill="${C.teal}"> ▌</tspan>
      </text>
    </g>

    <circle class="pulse" cx="${cx}" cy="${cy}" r="58" fill="url(#g)" opacity="0.6" filter="url(#blur)"/>
    ${orbit(92, 14, [0, 180], C.orange, false)}
    ${orbit(132, 22, [60, 240], C.pink, true)}
    ${orbit(172, 32, [120, 300], C.violet, false)}
    <circle cx="${cx}" cy="${cy}" r="46" fill="${C.panel}" stroke="url(#g)" stroke-width="2"/>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="${MONO}" font-size="34" font-weight="800" fill="url(#g)">&lt;/&gt;</text>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="26" fill="none" stroke="rgba(255,255,255,0.08)"/>
</svg>`;
}

// ── 2. Terminal ──
function terminal(d) {
  const W = 1200, H = 400;
  const rows = [
    ['cmd', 'whoami'],
    ['out', `David Adenusi  (@${LOGIN})  full-stack engineer and founder, Lagos`],
    ['cmd', 'cat stack.txt'],
    ['out', 'React Native  Expo  TypeScript  Node.js  MongoDB  Postgres  Socket.IO  Paystack'],
    ['cmd', 'git log --since="1 year ago" | wc -l'],
    ['out', `${fmt(d.total)} contributions   ${d.current}-day streak   best day: ${d.best.contributionCount}`],
    ['cmd', './now --building'],
    ['out', 'Roomie: roommates, chat, games, points. Heading to the Play Store.'],
  ];
  let t = 0.4;
  const body = rows.map(([kind, text], i) => {
    const y = 108 + i * 34;
    if (kind === 'cmd') {
      const w = Math.ceil(text.length * 10.2) + 40;
      const start = t;
      const dur = Math.max(0.5, text.length * 0.045);
      t += dur + 0.25;
      const total = start + dur;
      const steps = Array.from({ length: text.length + 1 }, (_, k) => 40 + k * 10.2);
      const keyTimes = ['0', (start / total).toFixed(4), ...steps.slice(1).map((_, k) => ((start + ((k + 1) / text.length) * dur) / total).toFixed(4))];
      const values = ['0', '40', ...steps.slice(1).map((v) => v.toFixed(1))];
      return `
      <clipPath id="c${i}"><rect x="58" y="${y - 20}" height="30" width="${w}">
        <animate attributeName="width" begin="0s" dur="${total.toFixed(2)}s" fill="freeze" calcMode="discrete" keyTimes="${keyTimes.join(';')}" values="${values.join(';')}"/>
      </rect></clipPath>
      <g clip-path="url(#c${i})">
        <text x="60" y="${y}" font-family="${MONO}" font-size="17"><tspan fill="${C.teal}">❯</tspan><tspan fill="${C.text}" dx="12">${esc(text)}</tspan></text>
      </g>`;
    }
    const start = t;
    t += 0.55;
    return `
      <text x="84" y="${y}" font-family="${MONO}" font-size="17" style="white-space:pre" fill="${i === rows.length - 1 ? C.orange : C.muted}"><animate attributeName="opacity" values="0;0;1" keyTimes="0;${(start / (start + 0.35)).toFixed(4)};1" dur="${(start + 0.35).toFixed(2)}s" begin="0s" fill="freeze"/>${esc(text)}</text>`;
  }).join('');
  const caretY = 108 + rows.length * 34;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Terminal: who I am, my stack, my numbers and what I'm building now">
  <defs>
    ${gradient('g')}
    <style>
      .caret { animation: blink 1s steps(1) infinite; }
      @keyframes blink { 50% { opacity: 0; } }
      .scan { animation: scan 6s linear infinite; }
      @keyframes scan { from { transform: translateY(-40px); } to { transform: translateY(${H}px); } }
    </style>
    <linearGradient id="scanline" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.035"/></linearGradient>
    <clipPath id="win"><rect width="${W}" height="${H}" rx="18"/></clipPath>
  </defs>
  <g clip-path="url(#win)">
    <rect width="${W}" height="${H}" fill="${C.panel}"/>
    <rect width="${W}" height="48" fill="rgba(255,255,255,0.035)"/>
    <circle cx="30" cy="24" r="7" fill="#ff5f57"/><circle cx="54" cy="24" r="7" fill="#febc2e"/><circle cx="78" cy="24" r="7" fill="#28c840"/>
    <text x="${W / 2}" y="29" text-anchor="middle" font-family="${MONO}" font-size="13" fill="${C.muted}">david@lagos: ~/shipped</text>
    <rect x="0" y="47" width="${W}" height="1.5" fill="url(#g)" opacity="0.8"/>
    ${body}
    <g>
      <text x="60" y="${caretY}" font-family="${MONO}" font-size="17"><tspan fill="${C.teal}">❯</tspan></text>
      <rect class="caret" x="84" y="${caretY - 16}" width="10" height="20" fill="${C.text}"/>
      <animate attributeName="opacity" values="0;0;1" keyTimes="0;${(t / (t + 0.2)).toFixed(4)};1" dur="${(t + 0.2).toFixed(2)}s" begin="0s" fill="freeze"/>
    </g>
    <rect class="scan" width="${W}" height="40" fill="url(#scanline)"/>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="rgba(255,255,255,0.09)"/>
</svg>`;
}

// ── 3. Shipped ──
function shipped() {
  const W = 1200, H = 560;
  const items = [
    ['01', 'Roomie', 'Roommate matching for Nigeria: discovery,', 'real-time chat, games and a points economy.', 'React Native · Node · Socket.IO', 'Play Store soon', C.teal],
    ['02', 'SharpLook', 'Book barbers, salons and stylists near you.', 'Wallet, Paystack, chat and reviews.', 'React Native · MongoDB · Paystack', 'Booking', C.orange],
    ['03', 'VendorSpot', 'Marketplace for local vendors. 120+ endpoints,', 'shipping, KYC and digital products.', 'MERN · TypeScript · ShipBubble', 'Commerce', C.pink],
    ['04', 'GadgetVault', 'IMEI checks before you buy a phone, with', 'Tecno, Itel and Infinix in the database.', 'React Native · Next.js · Supabase', 'Trust', C.violet],
    ['05', 'TradeMe', 'Paper trading for Nigerian investors:', 'stocks and crypto at live prices, no risk.', 'MERN · Next.js · TypeScript', 'Fintech', C.orange],
    ['06', 'Mowdministries', 'Church app with a Bible reader, groups,', 'a shop and an events calendar.', 'React Native · NativeWind · Node', 'Community', C.pink],
  ];
  const cw = 356, ch = 200, gx = 26, gy = 24, x0 = 40, y0 = 104;
  const cards = items.map(([n, name, l1, l2, stack, tag, col], i) => {
    const x = x0 + (i % 3) * (cw + gx), y = y0 + Math.floor(i / 3) * (ch + gy);
    const per = 2 * (cw + ch);
    return `
    <g class="card" style="animation-delay:${(0.15 + i * 0.12).toFixed(2)}s">
      <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="18" fill="${C.panel}" stroke="${C.line}"/>
      <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="18" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="120 ${per - 120}" class="sweep" style="animation-delay:${(-i * 1.1).toFixed(1)}s"/>
      <text x="${x + 24}" y="${y + 42}" font-family="${MONO}" font-size="13" fill="${col}" font-weight="700">${n}</text>
      <rect x="${x + cw - 24 - (tag.length * 7.4 + 20)}" y="${y + 24}" width="${tag.length * 7.4 + 20}" height="24" rx="12" fill="rgba(255,255,255,0.05)" stroke="${C.line}"/>
      <text x="${x + cw - 24 - (tag.length * 7.4 + 20) / 2}" y="${y + 40}" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${C.muted}">${esc(tag)}</text>
      <text x="${x + 24}" y="${y + 86}" font-family="${SANS}" font-size="28" font-weight="800" fill="${C.text}" letter-spacing="-0.5">${esc(name)}</text>
      <text x="${x + 24}" y="${y + 118}" font-family="${SANS}" font-size="14.5" fill="${C.muted}">${esc(l1)}</text>
      <text x="${x + 24}" y="${y + 139}" font-family="${SANS}" font-size="14.5" fill="${C.muted}">${esc(l2)}</text>
      <line x1="${x + 24}" y1="${y + 160}" x2="${x + cw - 24}" y2="${y + 160}" stroke="${C.line}"/>
      <text x="${x + 24}" y="${y + 182}" font-family="${MONO}" font-size="12.5" fill="${col}" opacity="0.9">${esc(stack)}</text>
    </g>`;
  }).join('');
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Six products I've shipped: Roomie, SharpLook, VendorSpot, GadgetVault, TradeMe, Mowdministries">
  <defs>
    ${gradient('g')}
    <style>
      .card { animation: up .8s cubic-bezier(.2,.8,.2,1) backwards; }
      @keyframes up { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
      .sweep { animation: sweep 6.5s linear infinite; }
      @keyframes sweep { to { stroke-dashoffset: -${2 * (356 + 200)}; } }
    </style>
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="26"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    <text x="40" y="62" font-family="${SANS}" font-size="34" font-weight="800" fill="${C.text}" letter-spacing="-0.8">Shipped, <tspan fill="url(#g)">not just started.</tspan></text>
    <text x="${W - 40}" y="62" text-anchor="end" font-family="${MONO}" font-size="13" fill="${C.muted}">designed, built and run end to end</text>
    ${cards}
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="26" fill="none" stroke="rgba(255,255,255,0.08)"/>
</svg>`;
}

// ── 4. Numbers + contribution wave ──
function pulse(d) {
  const W = 1200, cell = 15, gap = 4, step = cell + gap;
  const weeks = d.weeks.slice(-53);
  const gridW = weeks.length * step - gap;
  const gx = Math.round((W - gridW) / 2), gy = 252;
  const H = gy + 7 * step + 64;
  const max = Math.max(1, ...weeks.flatMap((w) => w.contributionDays.map((x) => x.contributionCount)));
  const palette = ['rgba(255,255,255,0.05)', '#4a2a2f', '#a8423f', C.orange, C.pink];
  const level = (n) => (n === 0 ? 0 : n < max * 0.08 ? 1 : n < max * 0.2 ? 2 : n < max * 0.45 ? 3 : 4);
  const cells = weeks.map((w, wi) => `
    <g class="col" style="animation-delay:${(wi * 0.028).toFixed(3)}s">${w.contributionDays.map((day) => {
      const dow = new Date(day.date + 'T00:00:00Z').getUTCDay();
      return `<rect x="${gx + wi * step}" y="${gy + dow * step}" width="${cell}" height="${cell}" rx="3.5" fill="${palette[level(day.contributionCount)]}"><title>${day.contributionCount} on ${day.date}</title></rect>`;
    }).join('')}</g>`).join('');

  const tiles = [
    [fmt(d.total), 'contributions in a year', C.orange],
    [`${d.current}`, `day streak${d.current >= d.dayCount - 1 ? ', every single day' : ''}`, C.pink],
    [`${d.best.contributionCount}`, 'on my busiest day', C.violet],
    [`${d.repos}`, `public repos since ${d.since}`, C.teal],
  ];
  const tw = 266, tg = 18, tx0 = Math.round((W - (4 * tw + 3 * tg)) / 2);
  const tileSvg = tiles.map(([big, label, col], i) => {
    const x = tx0 + i * (tw + tg);
    return `
    <g class="tile" style="animation-delay:${(0.1 + i * 0.12).toFixed(2)}s">
      <rect x="${x}" y="40" width="${tw}" height="120" rx="18" fill="${C.panel}" stroke="${C.line}"/>
      <rect x="${x + 22}" y="40" width="44" height="3" rx="1.5" fill="${col}"/>
      <text x="${x + 22}" y="106" font-family="${SANS}" font-size="44" font-weight="800" fill="${C.text}" letter-spacing="-1">${esc(big)}</text>
      <text x="${x + 22}" y="136" font-family="${MONO}" font-size="13" fill="${C.muted}">${esc(label)}</text>
    </g>`;
  }).join('');

  // Languages as one bar
  let lx = tx0;
  const barW = 4 * tw + 3 * tg;
  const bar = d.topLangs.map((l, i) => {
    const w = Math.max(4, (l.pct / 100) * barW);
    const seg = `<rect x="${lx.toFixed(1)}" y="186" width="${w.toFixed(1)}" height="10" fill="${l.color}" class="seg" style="animation-delay:${(0.6 + i * 0.1).toFixed(2)}s"/>`;
    lx += w;
    return seg;
  }).join('');
  let kx = tx0;
  const keys = d.topLangs.map((l) => {
    const label = `${l.name} ${l.pct.toFixed(0)}%`;
    const g = `<circle cx="${kx + 5}" cy="220" r="5" fill="${l.color}"/><text x="${kx + 16}" y="225" font-family="${MONO}" font-size="12.5" fill="${C.muted}">${esc(label)}</text>`;
    kx += label.length * 7.8 + 40;
    return g;
  }).join('');

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${fmt(d.total)} contributions in the last year, ${d.current}-day streak">
  <defs>
    ${gradient('g')}
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="26"/></clipPath>
    <clipPath id="barclip"><rect x="${tx0}" y="186" width="${barW}" height="10" rx="5"/></clipPath>
    <clipPath id="gridclip"><rect x="${gx}" y="${gy}" width="${gridW}" height="${7 * step}"/></clipPath>
    <style>
      .tile { animation: up .8s cubic-bezier(.2,.8,.2,1) backwards; }
      @keyframes up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
      .col { animation: pop .5s ease-out backwards; }
      @keyframes pop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .seg { transform-box: fill-box; transform-origin: left; animation: grow .9s cubic-bezier(.2,.8,.2,1) backwards; }
      @keyframes grow { from { transform: scaleX(0); } }
      .beam { animation: beam 5s ease-in-out infinite; animation-delay: 2s; }
      @keyframes beam { from { transform: translateX(-160px); } to { transform: translateX(${gridW + 160}px); } }
    </style>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    ${tileSvg}
    <g clip-path="url(#barclip)"><rect x="${tx0}" y="186" width="${barW}" height="10" fill="rgba(255,255,255,0.05)"/>${bar}</g>
    ${keys}
    ${cells}
    <g clip-path="url(#gridclip)"><rect class="beam" x="${gx - 160}" y="${gy}" width="160" height="${7 * step}" fill="url(#beam)"/></g>
    <text x="${gx}" y="${H - 24}" font-family="${MONO}" font-size="12.5" fill="${C.muted}">the last 12 months, one square a day</text>
    <g transform="translate(${gx + gridW - 150}, ${H - 36})" font-family="${MONO}" font-size="12" fill="${C.muted}">
      <text x="0" y="12">less</text>
      ${palette.map((p, i) => `<rect x="${38 + i * 18}" y="1" width="13" height="13" rx="3" fill="${p}"/>`).join('')}
      <text x="${38 + 5 * 18 + 4}" y="12">more</text>
    </g>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="26" fill="none" stroke="rgba(255,255,255,0.08)"/>
</svg>`;
}

// ── 5. Footer ──
function footer() {
  const W = 1200, H = 120;
  const path = (amp) => {
    let p = `M0 60`;
    for (let i = 0; i < 40; i++) p += ` q 30 ${i % 2 ? amp : -amp} 60 0`;
    return p;
  };
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Thanks for stopping by">
  <defs>
    ${gradient('g')}
    <style>
      .w1 { animation: flow 7s linear infinite; }
      .w2 { animation: flow 11s linear infinite reverse; opacity: .45; }
      @keyframes flow { to { transform: translateX(-120px); } }
    </style>
  </defs>
  <path class="w1" d="${path(16)}" fill="none" stroke="url(#g)" stroke-width="2.4" stroke-linecap="round"/>
  <path class="w2" d="${path(26)}" fill="none" stroke="url(#g)" stroke-width="1.4" stroke-linecap="round"/>
  <rect x="${W / 2 - 170}" y="40" width="340" height="40" rx="20" fill="${C.bg}" stroke="rgba(255,255,255,0.1)"/>
  <text x="${W / 2}" y="66" text-anchor="middle" font-family="${MONO}" font-size="15" fill="${C.text}">built for users, not demos <tspan fill="${C.pink}">♥</tspan></text>
</svg>`;
}

const data = await fetchData();
write('hero.svg', hero(data));
write('terminal.svg', terminal(data));
write('shipped.svg', shipped());
write('pulse.svg', pulse(data));
write('footer.svg', footer());
console.log(`Built: ${fmt(data.total)} contributions, ${data.current}-day streak (longest ${data.longest}), ${data.repos} public repos, top: ${data.topLangs.map((l) => l.name).join(', ')}`);
