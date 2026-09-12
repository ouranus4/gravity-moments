/* ============================================================
   Gravity Moments — приймач заявок
   Cloudflare Worker. Стоїть між формою на сайті та Telegram.

   Навіщо: репозиторій сайту публічний. Якщо вписати токен бота
   в assets/js/main.js, його побачить будь-хто, хто відкриє сторінку,
   і зможе слати повідомлення у ваш чат від імені бота.
   Тут токен лежить у змінних Worker'а і назовні не виходить.

   Розгортання (з теки telegram-worker):
     npx wrangler secret put BOT_TOKEN     — токен від @BotFather
     npx wrangler deploy

   Перевірка після розгортання — відкрити адресу Worker'а в браузері
   звичайним GET. У відповіді буде список дозволених доменів. Саме
   відсутність такої перевірки на попередньому проєкті й призвела до
   того, що форма мовчки перестала приймати заявки після переїзду
   на власний домен.
   ============================================================ */

// Куди падають заявки — група «Gravity / заявки».
// Замінити на реальний id: додайте бота в групу, напишіть туди
// повідомлення й відкрийте
// https://api.telegram.org/bot<TOKEN>/getUpdates — там буде chat.id
const DEFAULT_CHAT_ID = '';

// Звідки дозволено надсилати. Список, а не одна адреса: під час
// переїзду на власний домен сайт якийсь час живе за кількома
// адресами одночасно, і з однією дозволеною форма мовчки
// перестала б приймати заявки.
const ALLOWED = [
  'https://gravity-moments.com.ua',
  'https://www.gravity-moments.com.ua',
  'https://ouranus4.github.io'
];

const FIELDS = {
  name:      { label: 'Імʼя',          max: 120 },
  contact:   { label: 'Телефон',       max: 80 },
  messenger: { label: 'Звʼязок',       max: 20 },
  date:      { label: 'Дата події',    max: 40 },
  comment:   { label: 'Коментар',      max: 2000 }
};

// Межі для блоку розрахунку. Приходить він від клієнта, тому
// обрізаємо все: і довжину підписів, і кількість рядків.
const CALC_MAX = { label: 80, options: 12, items: 10 };

// Telegram ріже повідомлення на 4096 символах і повертає помилку.
// Різати треба на своєму боці, інакше лід просто зникне.
const TEXT_MAX = 3900;

export default {
  async fetch(request, env) {
    // Дозволені адреси можна перекрити змінною: кілька через кому.
    const allowed = (env.ALLOWED_ORIGIN || '').trim()
      ? env.ALLOWED_ORIGIN.split(',').map(v => v.trim()).filter(Boolean)
      : ALLOWED;
    // Браузер порівнює відповідь із власним Origin, тож повертаємо
    // саме його, якщо він у списку. Інакше — першу дозволену адресу.
    const from = request.headers.get('Origin');
    const origin = allowed.includes(from) ? from : allowed[0];
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Перевірка перед запуском: видно, чи прод-домен у списку
    // і чи заданий чат. Нічого секретного не віддає.
    if (request.method === 'GET') {
      return reply({
        ok: true,
        service: 'gravity-form',
        allowed,
        yourOrigin: from || null,
        originAllowed: allowed.includes(from),
        chatConfigured: Boolean(env.CHAT_ID || DEFAULT_CHAT_ID),
        tokenConfigured: Boolean(env.BOT_TOKEN)
      }, 200, cors);
    }

    if (request.method !== 'POST') {
      return reply({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    // Явна відмова чужому Origin. Без неї Worker приймає POST
    // звідусіль і лише не віддає CORS-заголовок — тобто браузер
    // не може прочитати відповідь, а повідомлення в Telegram
    // уже пішло. Це відкриті двері для флуду в чат.
    if (from && !allowed.includes(from)) {
      return reply({ ok: false, error: 'forbidden_origin' }, 403, cors);
    }

    const chatId = env.CHAT_ID || DEFAULT_CHAT_ID;
    if (!env.BOT_TOKEN || !chatId) {
      return reply({ ok: false, error: 'not_configured' }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ ok: false, error: 'bad_json' }, 400, cors);
    }

    // Приховане поле, якого людина не бачить і не заповнює.
    // Заповнене — значить, це бот: мовчки вдаємо успіх.
    if (typeof body.company === 'string' && body.company.trim() !== '') {
      return reply({ ok: true }, 200, cors);
    }

    const data = {};
    for (const key of Object.keys(FIELDS)) {
      const raw = body[key];
      data[key] = typeof raw === 'string' ? raw.trim().slice(0, FIELDS[key].max) : '';
    }
    if (!data.name || !data.contact) {
      return reply({ ok: false, error: 'missing_required' }, 400, cors);
    }

    let text = format(data, body);
    if (text.length > TEXT_MAX) text = text.slice(0, TEXT_MAX) + '…';

    const tg = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      }
    );

    const out = await tg.json().catch(() => null);
    if (!out || out.ok !== true) {
      // опис від Telegram лишається в логах Worker'а, назовні не йде
      console.error('telegram rejected', out && out.description);
      return reply({ ok: false, error: 'telegram_failed' }, 502, cors);
    }
    return reply({ ok: true }, 200, cors);
  }
};

/* ---------- допоміжне ---------- */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function str(v, max) { return esc(v).slice(0, max); }
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function money(n) {
  return String(num(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴';
}

/* Розкладка конструктора.
   Підписи й числа приходять від клієнта вже готовими — Worker їх
   не рахує. Інакше прайс довелося б тримати у двох місцях, і він
   розійшовся б першого ж місяця. Тут — лише санітарія. */
function formatCalc(c) {
  if (!c || typeof c !== 'object') return [];
  const L = ['', '<b>── Розрахунок із конструктора ──</b>'];
  L.push(`Привід: ${str(c.occasion, CALC_MAX.label)}`);
  L.push(`Гостей: ${num(c.guests)}`);
  L.push(`Місто / локація: ${str(c.city, 60)} · ${str(c.venue, 60)}`);
  L.push(`Рівень: ${str(c.level, 40)}`);

  if (Array.isArray(c.options) && c.options.length) {
    L.push('Опції: ' + c.options.slice(0, CALC_MAX.options)
      .map(o => str(o, CALC_MAX.label)).join(', '));
  }

  const t = c.total || {};
  L.push('', `<b>Бюджет: ${money(t.low)} – ${money(t.high)}</b>`);

  (Array.isArray(c.items) ? c.items : []).slice(0, CALC_MAX.items).forEach(it => {
    L.push(`• ${str(it.label, CALC_MAX.label)} — ${money(it.low)} – ${money(it.high)} (${num(it.pct)}%)`);
  });

  if (c.pricesVersion) L.push('', `<i>прайс від ${str(c.pricesVersion, 20)}</i>`);
  return L;
}

function format(d, body) {
  const withCalc = body && body.calc && typeof body.calc === 'object';
  const lines = [
    withCalc
      ? '<b>Нова заявка з розрахунком — Gravity Moments</b>'
      : '<b>Нова заявка — Gravity Moments</b>',
    ''
  ];

  for (const key of Object.keys(FIELDS)) {
    if (d[key]) lines.push(`<b>${FIELDS[key].label}:</b> ${esc(d[key])}`);
  }

  if (withCalc) lines.push(...formatCalc(body.calc));

  // UTM і сторінка — щоб було видно, з якого посту прийшов лід
  // і за яким посиланням відновити розрахунок.
  const utm = body && body.utm;
  if (utm && typeof utm === 'object') {
    const parts = Object.keys(utm).slice(0, 5)
      .map(k => `${str(k, 20)}=${str(utm[k], 80)}`);
    if (parts.length) lines.push('', `<i>Джерело: ${parts.join(' · ')}</i>`);
  }
  if (body && typeof body.page === 'string') {
    lines.push(`<i>Сторінка:</i> ${str(body.page, 400)}`);
  }

  return lines.join('\n');
}

function reply(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
