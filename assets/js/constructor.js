/* ============================================================
   Gravity Moments — КОНСТРУКТОР ПОДІЇ

   Ціни тут не живуть: усі цифри беруться з assets/js/prices.js.
   Якщо той файл не завантажився або в ньому помилка, конструктор
   просто не вмикається — на сторінці лишається статична таблиця
   орієнтовних бюджетів і звичайна форма заявки. Лід не губиться.
   ============================================================ */
(function () {
  'use strict';

  var GM = window.GM_PRICES;
  if (!GM || !GM.items || !GM.occasions) {
    // Конструктор свідомо не вмикаємо: краще статична таблиця,
    // ніж калькулятор, що показує неправильні суми.
    if (window.console) console.warn('[Gravity] prices.js не завантажився — конструктор вимкнено');
    return;
  }

  var form = document.getElementById('gmCalc');
  if (!form) return;

  // Степер і панель результату вмикаються лише коли скрипт справді
  // виконався. Без нього розмітка лишається звичайною довгою формою.
  document.documentElement.classList.add('gm-on');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function track(name, params) {
    if (typeof window.gmTrack === 'function') window.gmTrack(name, params);
  }

  /* ----------------------------------------------------------
     КОЛЬОРИ СЕГМЕНТІВ
     Один масив на смугу й на квадратики в списку, щоб вони не
     могли розійтися.
     ---------------------------------------------------------- */
  var COLORS = {
    venue:    '#D9B26A',
    catering: '#B98F4A',
    decor:    '#8C6A2E',
    tech:     '#6C5CE0',
    artists:  '#4F43A8',
    agency:   '#6E6B7A'
  };

  /* ----------------------------------------------------------
     ЧИСЛА
     ---------------------------------------------------------- */
  var nf = null;
  try { nf = new Intl.NumberFormat('uk-UA'); } catch (e) { nf = null; }

  function group(n) {
    n = Math.round(n || 0);
    if (nf) return nf.format(n);
    // запасний варіант, якщо Intl недоступний
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function money(n) { return group(n) + ' ' + GM.currency; }
  function roundTo(n, step) {
    step = step || 1;
    return Math.round(n / step) * step;
  }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

  /* ----------------------------------------------------------
     РОЗРАХУНОК — чиста функція.
     Приймає стан, повертає статті, вилку й відсотки. Нічого не
     знає про DOM, тому її можна перевірити окремо в консолі:
       GMCalc({ev:'wedding',g:80,city:'kyiv',loc:'loft',lvl:'full',opt:['host']})
     ---------------------------------------------------------- */
  function calc(st) {
    var occ  = GM.occasions[st.ev]   || GM.occasions[Object.keys(GM.occasions)[0]];
    var city = GM.cities[st.city]    || GM.cities[Object.keys(GM.cities)[0]];
    var vt   = GM.venueTypes[st.loc] || GM.venueTypes[Object.keys(GM.venueTypes)[0]];
    var lvl  = GM.levels[st.lvl]     || GM.levels.full;
    var g    = clamp(st.g || GM.guests.def, GM.guests.min, GM.guests.max);

    var keys = Object.keys(GM.items);
    var low = {}, high = {};

    // 1) детермінована частина по кожній статті
    keys.forEach(function (key) {
      var it = GM.items[key];
      var kLvl = (lvl.k && lvl.k[key] !== undefined) ? lvl.k[key]
               : (lvl.k && lvl.k._ !== undefined ? lvl.k._ : 1);
      var kVt  = (vt.k && vt.k[key]) ? vt.k[key] : 1;
      var k    = occ.k * city.k * kLvl * kVt;
      var mid  = (it.fixed + it.perGuest * g) * k;
      // floor не дає камерній події показати «техніка 4 000 ₴»
      low[key]  = Math.max(it.floor, mid * GM.spread.low);
      high[key] = Math.max(it.floor, mid * GM.spread.high);
    });

    // 2) опції — вже у грошах, мають власну вилку.
    //    Мінімуми йдуть у low, максимуми у high: хедлайнер чесно
    //    розширює вилку, а не зсуває її середину.
    (st.opt || []).forEach(function (id) {
      var o = GM.options[id] || GM.upsell[id];
      if (!o || low[o.to] === undefined) return;
      var n = o.perGuest ? g : 1;
      low[o.to]  += o.price[0] * n * city.k;
      high[o.to] += o.price[1] * n * city.k;
    });

    // 3) робота організатора — відсоток від усього іншого
    var sumLow = 0, sumHigh = 0;
    keys.forEach(function (key) { sumLow += low[key]; sumHigh += high[key]; });
    var workLow  = Math.max(GM.agency.min, sumLow  * GM.agency.pct);
    var workHigh = Math.max(GM.agency.min, sumHigh * GM.agency.pct);

    // 4) складаємо список статей, порожні відкидаємо
    var rows = [];
    keys.forEach(function (key) {
      if (high[key] <= 0) return;
      rows.push({ key: key, label: GM.items[key].label, low: low[key], high: high[key] });
    });
    rows.push({ key: 'agency', label: GM.agency.label, low: workLow, high: workHigh });

    // 5) відсотки — від середини статті. Останньому віддаємо
    //    залишок, інакше сума дасть 99% або 101%.
    var totalMid = 0;
    rows.forEach(function (r) { r.mid = (r.low + r.high) / 2; totalMid += r.mid; });
    var acc = 0;
    rows.forEach(function (r, i) {
      if (i === rows.length - 1) { r.pct = Math.max(0, 100 - acc); return; }
      r.pct = totalMid > 0 ? Math.round(r.mid / totalMid * 100) : 0;
      acc += r.pct;
    });

    var totalLow  = roundTo(sumLow  + workLow,  GM.round);
    var totalHigh = roundTo(sumHigh + workHigh, GM.round);

    return {
      rows: rows,
      total: { low: totalLow, high: totalHigh, mid: Math.round((totalLow + totalHigh) / 2) },
      guests: g,
      labels: {
        occasion: occ.label, city: city.label, venue: vt.label, level: lvl.label,
        options: (st.opt || []).map(function (id) {
          var o = GM.options[id] || GM.upsell[id];
          return o ? o.label : null;
        }).filter(Boolean)
      }
    };
  }
  // відкрито назовні спеціально — щоб перевіряти розрахунок у консолі
  window.GMCalc = calc;

  /* ----------------------------------------------------------
     СТАН
     ---------------------------------------------------------- */
  var STEPS = 5;
  var firstOcc = Object.keys(GM.occasions)[0];

  var state = {
    ev: firstOcc,
    g: GM.occasions[firstOcc].guests || GM.guests.def,
    city: Object.keys(GM.cities)[0],
    loc: Object.keys(GM.venueTypes)[0],
    lvl: 'full',
    opt: (GM.occasions[firstOcc].pre || []).slice(),
    step: 1
  };

  /* Посилання має бути читабельним, щоб його можна було вручну
     вписати в рекламу або в пост:
     ?ev=corporate&g=150&city=kyiv&loc=loft&lvl=premium&opt=host,show&step=3 */
  function readURL() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return false; }
    var got = false;

    function pick(param, dict, field) {
      var v = q.get(param);
      if (v && dict[v]) { state[field] = v; got = true; }
    }
    pick('ev', GM.occasions, 'ev');
    pick('city', GM.cities, 'city');
    pick('loc', GM.venueTypes, 'loc');
    pick('lvl', GM.levels, 'lvl');

    // привід тягне за собою типову кількість гостей і набір опцій,
    // але тільки якщо їх не задали в посиланні явно
    if (got && q.get('ev')) {
      var occ = GM.occasions[state.ev];
      state.g = occ.guests || GM.guests.def;
      state.opt = (occ.pre || []).slice();
    }

    var g = parseInt(q.get('g'), 10);
    if (!isNaN(g)) { state.g = clamp(g, GM.guests.min, GM.guests.max); got = true; }

    var opt = q.get('opt');
    if (opt !== null) {
      state.opt = opt.split(',').filter(function (id) {
        return GM.options[id] || GM.upsell[id];
      });
      got = true;
    }

    var step = parseInt(q.get('step'), 10);
    if (!isNaN(step)) { state.step = clamp(step, 1, STEPS); got = true; }

    return got;
  }

  function restore() {
    try {
      var raw = sessionStorage.getItem('gmState');
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s || !GM.occasions[s.ev]) return false;
      state.ev = s.ev;
      state.g = clamp(parseInt(s.g, 10) || GM.guests.def, GM.guests.min, GM.guests.max);
      if (GM.cities[s.city]) state.city = s.city;
      if (GM.venueTypes[s.loc]) state.loc = s.loc;
      if (GM.levels[s.lvl]) state.lvl = s.lvl;
      if (Object.prototype.toString.call(s.opt) === '[object Array]') {
        state.opt = s.opt.filter(function (id) { return GM.options[id] || GM.upsell[id]; });
      }
      state.step = clamp(parseInt(s.step, 10) || 1, 1, STEPS);
      return true;
    } catch (e) { return false; }
  }

  function query() {
    return 'ev=' + state.ev + '&g=' + state.g + '&city=' + state.city +
           '&loc=' + state.loc + '&lvl=' + state.lvl +
           '&opt=' + state.opt.join(',') + '&step=' + state.step;
  }
  // Посилання для пересилання веде одразу на конструктор — на відміну
  // від адреси в рядку браузера, яку ми якорем не чіпаємо.
  function shareURL() {
    return location.origin + location.pathname + '?' + query() + '#constructor';
  }

  var syncTimer = 0;
  function syncURL() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      try {
        // replaceState, а не pushState: інакше «Назад» ходило б по
        // кроках конструктора і людина втратила б сторінку.
        // Якір лишаємо той, що вже є: дописати свій — означає
        // смикнути сторінку до конструктора, щойно людина щось обрала.
        history.replaceState(null, '', location.pathname + '?' + query() + location.hash);
      } catch (e) {}
      try { sessionStorage.setItem('gmState', JSON.stringify(state)); } catch (e) {}
    }, 300);
  }

  /* ----------------------------------------------------------
     ВІДМАЛЮВАННЯ РЕЗУЛЬТАТУ
     ---------------------------------------------------------- */
  var elTotal = $('#gmTotal');
  var elBar   = $('#gmBar');
  var elItems = $('#gmItems');
  var elNote  = $('#gmNote');
  var elLive  = $('#gmLive');
  var elUp    = $('#gmUpGrid');

  var liveTimer = 0;
  var current = null;

  function render() {
    current = calc(state);
    var r = current;

    if (elTotal) {
      elTotal.innerHTML =
        '<span class="gm-total-lbl">Орієнтовний бюджет</span>' +
        '<b>' + group(r.total.low) + '</b>' +
        '<em>–</em>' +
        '<b>' + group(r.total.high) + '</b>' +
        '<em>' + GM.currency + '</em>';
    }

    if (elBar) {
      elBar.innerHTML = r.rows.map(function (row) {
        return '<i style="flex-basis:' + row.pct + '%;background:' +
               (COLORS[row.key] || '#6E6B7A') + '"></i>';
      }).join('');
    }

    if (elItems) {
      var html = r.rows.map(function (row) {
        // Частку саме цієї статті не показуємо: сума роботи організатора
        // у відсотках від бюджету — це, по суті, оголошена ставка, а її
        // ми на сайті не називаємо. У смузі сегмент лишається: він
        // пропорційний і без підпису.
        var pct = row.key === 'agency' ? '' : row.pct + '%';
        return '<li>' +
          '<span class="k">' +
            '<span class="sw" style="background:' + (COLORS[row.key] || '#6E6B7A') + '"></span>' +
            row.label +
          '</span>' +
          '<span class="p">' + pct + '</span>' +
          '<span class="v">' + group(row.low) + '–' + group(row.high) + '</span>' +
        '</li>';
      }).join('');
      html += '<li class="sum">' +
                '<span class="k">Разом</span>' +
                '<span class="v">' + money(r.total.low) + ' – ' + money(r.total.high) + '</span>' +
              '</li>';
      elItems.innerHTML = html;
    }

    // застереження від опцій із дуже широкою вилкою (хедлайнер)
    if (elNote) {
      var notes = (state.opt || []).map(function (id) {
        var o = GM.options[id] || GM.upsell[id];
        return o && o.note ? o.note : null;
      }).filter(Boolean);
      elNote.innerHTML = notes.join('<br>');
      elNote.hidden = !notes.length;
    }

    renderUpsell();

    // Скрінрідеру віддаємо окремий короткий рядок із затримкою:
    // інакше він бубонів би на кожен рух повзунка.
    if (elLive) {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(function () {
        elLive.textContent = 'Орієнтовний бюджет: ' +
          money(r.total.low) + ' – ' + money(r.total.high) +
          '. ' + r.labels.occasion + ', ' + r.guests + ' гостей.';
      }, 400);
    }

    window.GM_CALC = payload();
    syncURL();
  }

  function renderUpsell() {
    if (!elUp) return;
    elUp.innerHTML = Object.keys(GM.upsell).map(function (id) {
      var o = GM.upsell[id];
      var on = state.opt.indexOf(id) !== -1;
      return '<button class="gm-up-btn" type="button" data-up="' + id + '"' +
             ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
             '<b>' + o.label + '</b>' +
             '<span>+ ' + group(o.price[0]) + '–' + group(o.price[1]) + ' ' + GM.currency + '</span>' +
             '</button>';
    }).join('');
  }

  if (elUp) {
    elUp.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-up]') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-up');
      var i = state.opt.indexOf(id);
      if (i === -1) { state.opt.push(id); track('calc_upsell_add', { option: id }); }
      else { state.opt.splice(i, 1); }
      render();
    });
  }

  /* ----------------------------------------------------------
     ПЕЙЛОАД ДЛЯ ЗАЯВКИ
     Підписи й числа готуються тут, на клієнті. Worker їх не
     рахує — інакше прайс доведеться тримати у двох місцях,
     і він розійдеться першого ж місяця.
     ---------------------------------------------------------- */
  function payload() {
    var r = current || calc(state);
    return {
      pricesVersion: GM.updated,
      occasion: r.labels.occasion,
      guests: r.guests,
      city: r.labels.city,
      venue: r.labels.venue,
      level: r.labels.level,
      options: r.labels.options,
      total: { low: r.total.low, high: r.total.high },
      items: r.rows.map(function (row) {
        return { label: row.label, low: Math.round(row.low), high: Math.round(row.high), pct: row.pct };
      })
    };
  }

  /* ----------------------------------------------------------
     КРОКИ
     ---------------------------------------------------------- */
  var steps = $$('.gm-step', form);
  var indicator = $('#gmSteps');
  var btnNext = $('#gmNext');
  var btnBack = $('#gmBack');
  var started = false;
  var seen = {};

  function goStep(n, focus) {
    state.step = clamp(n, 1, STEPS);
    steps.forEach(function (fs) {
      fs.hidden = parseInt(fs.getAttribute('data-step'), 10) !== state.step;
    });
    if (indicator) {
      $$('li', indicator).forEach(function (li, i) {
        li.classList.toggle('now', i + 1 === state.step);
        li.classList.toggle('done', i + 1 < state.step);
      });
    }
    if (btnBack) btnBack.hidden = state.step === 1;
    if (btnNext) {
      btnNext.textContent = state.step === STEPS
        ? 'Надіслати цей розрахунок Марині'
        : 'Далі';
    }
    if (focus !== false) {
      var lg = $('legend', steps[state.step - 1]);
      if (lg) {
        lg.focus();
        lg.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }
    if (!seen[state.step]) {
      seen[state.step] = true;
      track('calc_step', { step: state.step });
    }
    syncURL();
  }

  if (btnBack) {
    btnBack.addEventListener('click', function () { goStep(state.step - 1); });
  }

  if (btnNext) {
    btnNext.addEventListener('click', function () {
      if (state.step < STEPS) { goStep(state.step + 1); return; }
      handoff();
    });
  }

  /* Перехід у заявку: форма отримує повну конфігурацію, а людина
     бачить зведення того, що саме вона надсилає. */
  function handoff() {
    var r = current || calc(state);
    var box = $('#applyCalc');
    var txt = $('#applyCalcText');
    var hidden = $('#f-calc');

    if (hidden) hidden.value = JSON.stringify(payload());
    if (txt) {
      txt.innerHTML =
        r.labels.occasion + ' · ' + r.guests + ' гостей · ' +
        r.labels.city + ', ' + r.labels.venue.toLowerCase() + ' · ' + r.labels.level +
        (r.labels.options.length ? ' · ' + r.labels.options.join(', ') : '') +
        '<br><b>' + money(r.total.low) + ' – ' + money(r.total.high) + '</b>';
    }
    if (box) box.classList.add('show');

    track('lead_open', { source: 'constructor', value: r.total.mid, currency: 'UAH' });

    var apply = document.getElementById('apply');
    if (apply) apply.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    var nameInput = document.getElementById('f-name');
    if (nameInput) setTimeout(function () { nameInput.focus({ preventScroll: true }); }, reduceMotion ? 0 : 600);
  }

  /* ----------------------------------------------------------
     ВВІД
     ---------------------------------------------------------- */
  function firstTouch() {
    if (started) return;
    started = true;
    var entry = location.search.indexOf('ev=') !== -1 ? 'deeplink' : 'scroll';
    track('calc_start', { entry: entry });
  }

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.name) return;
    firstTouch();

    if (t.name === 'ev') {
      state.ev = t.value;
      // привід задає типову кількість гостей і набір опцій —
      // людина далі правитиме це руками
      var occ = GM.occasions[state.ev];
      state.g = occ.guests || GM.guests.def;
      state.opt = (occ.pre || []).slice();
      syncGuests();
      syncOptions();
    } else if (t.name === 'city') { state.city = t.value; }
    else if (t.name === 'loc')  { state.loc = t.value; }
    else if (t.name === 'lvl')  { state.lvl = t.value; }
    else if (t.name === 'opt') {
      var i = state.opt.indexOf(t.value);
      if (t.checked && i === -1) state.opt.push(t.value);
      if (!t.checked && i !== -1) state.opt.splice(i, 1);
    }
    render();
  });

  // повзунок і числове поле живуть парою
  var range = $('#gmRange');
  var num   = $('#gmNum');

  function setGuests(v, from) {
    var g = clamp(parseInt(v, 10) || GM.guests.def, GM.guests.min, GM.guests.max);
    state.g = g;
    if (range && from !== 'range') range.value = g;
    if (num && from !== 'num') num.value = g;
    render();
  }
  function syncGuests() {
    if (range) range.value = state.g;
    if (num) num.value = state.g;
  }
  if (range) {
    range.addEventListener('input', function () { firstTouch(); setGuests(range.value, 'range'); });
  }
  if (num) {
    num.addEventListener('input', function () { firstTouch(); setGuests(num.value, 'num'); });
    // на blur дотягуємо значення в межі, щоб поле не лишалось порожнім
    num.addEventListener('blur', function () { num.value = state.g; });
  }

  function syncOptions() {
    $$('input[name="opt"]', form).forEach(function (cb) {
      cb.checked = state.opt.indexOf(cb.value) !== -1;
    });
  }

  function syncRadios() {
    [['ev', state.ev], ['city', state.city], ['loc', state.loc], ['lvl', state.lvl]]
      .forEach(function (pair) {
        var el = form.querySelector('input[name="' + pair[0] + '"][value="' + pair[1] + '"]');
        if (el) el.checked = true;
      });
  }

  /* Копіювання посилання на розрахунок — щоб людина могла
     переслати його партнеру або собі. */
  var copyBtn = $('#gmCopy');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var url = shareURL();
      function done() {
        var old = copyBtn.textContent;
        copyBtn.textContent = 'Посилання скопійовано';
        setTimeout(function () { copyBtn.textContent = old; }, 2200);
        track('calc_share', {});
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, fallback);
      } else { fallback(); }

      function fallback() {
        var inp = document.createElement('input');
        inp.value = url;
        inp.setAttribute('readonly', '');
        inp.style.position = 'fixed';
        inp.style.left = '-9999px';
        document.body.appendChild(inp);
        inp.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(inp);
      }
    });
  }

  /* ----------------------------------------------------------
     СТАРТ
     ---------------------------------------------------------- */
  var fromURL = readURL();
  if (!fromURL) restore();

  syncRadios();
  syncGuests();
  syncOptions();
  render();
  // Посилання з ?step=3 має відкрити потрібний крок, але не
  // перетягувати фокус, якщо людина ще не доскролила до блоку.
  goStep(state.step, fromURL && state.step > 1 ? true : false);

  if (fromURL) {
    var sec = document.getElementById('constructor');
    if (sec && location.hash === '#constructor') {
      sec.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  var resultSeen = false;
  if ('IntersectionObserver' in window && elTotal) {
    new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || resultSeen) return;
      resultSeen = true;
      var r = current || calc(state);
      track('calc_result', {
        low: r.total.low, high: r.total.high, mid: r.total.mid,
        occasion: state.ev, level: state.lvl, guests: r.guests,
        options_count: state.opt.length
      });
    }, { threshold: 0.4 }).observe(elTotal);
  }
})();
