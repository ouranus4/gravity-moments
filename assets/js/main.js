/* ============================================================
   Gravity Moments — поведінка сторінки
   Без залежностей. Усе деградує без помилок.
   Конструктор живе окремо: assets/js/constructor.js
   ============================================================ */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     НАЛАШТУВАННЯ — три константи, які треба заповнити
     ---------------------------------------------------------- */

  // Адреса Cloudflare Worker, який приймає заявки й пересилає їх
  // у Telegram. Токен бота лежить усередині Worker'а і в цей файл
  // не потрапляє. Інструкція: telegram-worker/README.md
  var TG_ENDPOINT = 'https://gravity-form.workers.dev';

  // Куди вести людину, якщо мережа підвела
  var TG_FALLBACK = 'https://t.me/marina_philipenko';

  // Аналітика. Поки рядки порожні — нічого не вантажиться і нічого
  // не відправляється. Впишіть ідентифікатори, і воронка почне
  // збиратися сама: події вже розставлені по сторінці.
  var GA4_ID    = '';     // напр. 'G-XXXXXXXXXX'
  var PIXEL_ID  = '';     // напр. '1234567890'


  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Ефекти, що ховають вміст (маска заголовка, промальовка ліній),
  // вмикаються лише коли цей скрипт справді виконався. Без нього —
  // і якщо він упаде — сторінка лишається повністю читабельною.
  if (!reduceMotion) document.documentElement.classList.add('fx');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ----------------------------------------------------------
     АНАЛІТИКА
     GA4 і Pixel — це ~150 КБ чужих скриптів. Синхронно в <head>
     вони б'ють прямо по першому екрану, тому вантажимо їх після
     load, у простій. Події до завантаження складаємо в чергу.
     ---------------------------------------------------------- */
  var queue = [];
  var ready = false;

  function flush() {
    if (!ready) return;
    while (queue.length) {
      var ev = queue.shift();
      var name = ev[0], params = ev[1] || {};
      // Перевірка типу обов'язкова: у людини з блокувальником
      // gtag/fbq не існує, і без неї ReferenceError зірвав би
      // відправку заявки — track() викликається в тому ж ланцюжку.
      try { if (typeof window.gtag === 'function') window.gtag('event', name, params); } catch (e) {}
      try {
        if (typeof window.fbq === 'function') {
          var std = { generate_lead: 'Lead', lead_open: 'InitiateCheckout', contact_click: 'Contact' };
          if (std[name]) window.fbq('track', std[name], params);
          else window.fbq('trackCustom', name, params);
        }
      } catch (e) {}
    }
  }

  // Глобальна — її викликає і constructor.js
  window.gmTrack = function (name, params) {
    queue.push([name, params]);
    flush();
  };

  function loadAnalytics() {
    if (!GA4_ID && !PIXEL_ID) { queue.length = 0; return; }

    if (GA4_ID) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA4_ID);
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
      document.head.appendChild(s);
    }

    if (PIXEL_ID) {
      /* eslint-disable */
      (function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = true; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', PIXEL_ID);
      window.fbq('track', 'PageView');
    }

    ready = true;
    flush();
  }

  function whenIdle(fn) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 3000 });
    else setTimeout(fn, 1200);
  }
  if (document.readyState === 'complete') whenIdle(loadAnalytics);
  else window.addEventListener('load', function () { whenIdle(loadAnalytics); });

  /* ----------------------------------------------------------
     NAV — фон при скролі + бургер
     ---------------------------------------------------------- */
  var nav       = $('#nav');
  var burger    = $('#burger');
  var menu      = $('#mobileMenu');
  var stickyCta = $('#stickyCta');
  var hero      = $('#top');

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle('solid', y > 24);
    if (stickyCta && hero) {
      stickyCta.classList.toggle('show', y > hero.offsetHeight * 0.85);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Scroll-spy: крапка йде за секцією, яку читають */
  var spyLinks = $$('#navLinks a[href^="#"]');
  var spyTargets = spyLinks
    .map(function (a) {
      return { link: a, el: document.getElementById(a.getAttribute('href').slice(1)) };
    })
    .filter(function (t) { return t.el; });

  function spy() {
    if (!spyTargets.length) return;
    var probe = (window.scrollY || window.pageYOffset) + window.innerHeight * 0.32;
    var current = spyTargets[0];
    spyTargets.forEach(function (t) {
      if (t.el.offsetTop <= probe) current = t;
    });
    spyLinks.forEach(function (a) { a.classList.toggle('active', a === current.link); });
  }
  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy);
  spy();

  function setMenu(open) {
    if (!menu || !burger) return;
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('locked', open);
  }
  if (burger) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
  }
  if (menu) {
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
  }

  /* ----------------------------------------------------------
     СМУГА ПРОГРЕСУ ПРОКРУТКИ
     ---------------------------------------------------------- */
  (function scrollProgress() {
    var bar = $('#scrollBar');
    var box = bar && bar.parentNode;
    if (!bar) return;
    var ticking = false;

    function paint() {
      ticking = false;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      bar.style.width = (p * 100).toFixed(2) + '%';
      box.classList.toggle('on', window.scrollY > 120);
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener('resize', paint, { passive: true });
    paint();
  })();

  /* ----------------------------------------------------------
     СЕКЦІЯ У ПОЛІ ЗОРУ — промальовка лінії й поява заголовка
     ---------------------------------------------------------- */
  (function sectionsIn() {
    var secs = $$('section');
    var heads = $$('.sec-head h2');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      secs.forEach(function (s) { s.classList.add('in'); });
      heads.forEach(function (h) { h.classList.add('on'); });
      return;
    }
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        sio.unobserve(en.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    secs.forEach(function (s) { sio.observe(s); });

    var hio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('on');
        hio.unobserve(en.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    heads.forEach(function (h) { hio.observe(h); });
  })();

  /* ----------------------------------------------------------
     REVEAL ON SCROLL
     ---------------------------------------------------------- */
  var revealables = $$('.rv:not(.on)');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealables.forEach(function (el) { el.classList.add('on'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('on');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------
     ЛІЧИЛЬНИКИ
     Блоку з цифрами на сторінці поки немає — цифри по подіях треба
     взяти в Марини. Коли з'являться, достатньо поставити
     <span class="stat-num" data-count="120" data-suffix="+"></span>
     ---------------------------------------------------------- */
  var counters = $$('[data-count]');
  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduceMotion) { el.textContent = target + suffix; return; }
    var dur = 1500, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (counters.length) {
    if (!('IntersectionObserver' in window)) {
      counters.forEach(runCounter);
    } else {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          runCounter(en.target);
          cio.unobserve(en.target);
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { cio.observe(el); });
    }
  }

  /* ----------------------------------------------------------
     СВІТЛО ВІД КУРСОРА
     Позиція мишi йде в --mx/--my, щоб картка підсвічувалась
     під курсором. Тільки пристрої з мишею.
     ---------------------------------------------------------- */
  if (canHover && !reduceMotion) {
    $$('.card, .case, .fee-row').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* ----------------------------------------------------------
     HERO — ГРАВІТАЦІЙНИЙ КОЛОДЯЗЬ
     Шар 0 (CSS-градієнт) видний завжди. Цей шейдер — прогресивне
     покращення: якщо WebGL немає, пристрій слабкий або кадри
     виходять довгими, canvas просто зникає й лишається шар 0.
     ---------------------------------------------------------- */
  (function heroField() {
    var canvas = $('#heroField');
    if (!canvas) return;
    if (reduceMotion) return;

    // Пристрої, на яких важкий шейдер не вартий свічки.
    // deviceMemory є не всюди — відсутність не вважаємо за відмову.
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (cores < 4 || (mem !== undefined && mem < 4) || saveData) return;

    function start() {
      var gl = canvas.getContext('webgl', { antialias: false, alpha: true, depth: false })
            || canvas.getContext('experimental-webgl');
      if (!gl) return;

      var VERT =
        'attribute vec2 p;' +
        'void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

      // Світло стікає до центру мас: UV закручуються тим сильніше,
      // чим ближче до нього. Звідси й назва бренду.
      var FRAG =
        'precision highp float;' +
        'uniform vec2 uRes;' +
        'uniform float uTime;' +
        'void main(){' +
        '  vec2 uv = gl_FragCoord.xy / uRes;' +
        '  vec2 p = uv - vec2(0.70, 0.56);' +
        '  p.x *= uRes.x / uRes.y;' +
        '  float r = length(p);' +
        '  float a = atan(p.y, p.x);' +
        '  float t = uTime * 0.06;' +
        '  float swirl = 0.45 / (r * r + 0.18);' +
        '  float ang = a + swirl * 0.6 + t;' +
        '  float v  = sin(ang * 3.0 + r * 9.0 - t * 2.2);' +
        '  v += sin(ang * 5.0 - r * 6.0 + t * 1.4) * 0.6;' +
        '  v /= 1.6;' +
        '  float bands = pow(clamp(v * 0.5 + 0.5, 0.0, 1.0), 2.6);' +
        '  float falloff = smoothstep(1.25, 0.06, r);' +
        '  float core = smoothstep(0.40, 0.0, r);' +
        '  float i = bands * falloff + core * 0.5;' +
        // ніч -> холодний ультрафіолет -> шампань -> світла шампань
        '  vec3 col = vec3(0.016, 0.016, 0.030);' +
        '  col = mix(col, vec3(0.10, 0.07, 0.26), smoothstep(0.02, 0.34, i));' +
        '  col = mix(col, vec3(0.55, 0.40, 0.16), smoothstep(0.34, 0.70, i));' +
        '  col = mix(col, vec3(0.96, 0.84, 0.62), smoothstep(0.70, 1.00, i));' +
        // трохи шуму прибирає смуги на широких плавних переходах
        '  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);' +
        '  col += (n - 0.5) * 0.012;' +
        '  gl_FragColor = vec4(col, 1.0);' +
        '}';

      function compile(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          if (window.console) console.error('[Gravity] shader:', gl.getShaderInfoLog(s));
          return null;
        }
        return s;
      }

      var vs = compile(gl.VERTEX_SHADER, VERT);
      var fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return;

      var prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        if (window.console) console.error('[Gravity] program:', gl.getProgramInfoLog(prog));
        return;
      }
      gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      var uRes = gl.getUniformLocation(prog, 'uRes');
      var uTime = gl.getUniformLocation(prog, 'uTime');

      // Шейдер платить за кожен піксель, тому щільність ріжемо:
      // на телефоні ще й рендеримо в менший буфер, розтягуючи по CSS.
      var narrow = window.innerWidth < 768;
      var DPR = narrow
        ? Math.min(window.devicePixelRatio || 1, 1) * 0.7
        : Math.min(window.devicePixelRatio || 1, 1.5);
      var w = 0, h = 0;

      function size() {
        var r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        var nw = Math.round(r.width * DPR), nh = Math.round(r.height * DPR);
        if (nw !== w || nh !== h) {
          w = nw; h = nh;
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }
        return true;
      }

      // починаємо не з нуля, щоб перший кадр уже мав сформовану картину
      var t0 = 12;
      function render(seconds) {
        if (!size()) return false;
        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uTime, t0 + seconds);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        canvas.classList.add('lit');
        return true;
      }

      render(0);

      var start = performance.now();
      var raf = 0;
      var onScreen = true;

      // Самовимкнення. Гейти вище спираються на API, які іноді брешуть;
      // це — єдина перевірка, яка дивиться на реальну швидкість. Якщо
      // перші 30 кадрів виходять довгими, знімаємо canvas і лишаємо шар 0.
      var frames = 0, t1 = start, budget = 0, judged = false;

      function loop() {
        var now = performance.now();
        if (!judged) {
          budget += now - t1;
          t1 = now;
          if (++frames >= 30) {
            judged = true;
            if (budget / frames > 24) {
              cancelAnimationFrame(raf);
              canvas.parentNode && canvas.parentNode.removeChild(canvas);
              return;
            }
          }
        }
        render((now - start) / 1000);
        raf = requestAnimationFrame(loop);
      }
      function play() {
        if (raf || !onScreen || document.hidden) return;
        t1 = performance.now();
        raf = requestAnimationFrame(loop);
      }
      function stop() {
        if (!raf) return;
        cancelAnimationFrame(raf);
        raf = 0;
      }

      // Малюємо лише поки герой на екрані й таб активний: постійний
      // повноекранний шейдер — це рівний податок на всю сторінку.
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          onScreen = entries[0].isIntersecting;
          onScreen ? play() : stop();
        }, { threshold: 0 }).observe(canvas);
      }
      document.addEventListener('visibilitychange', function () {
        document.hidden ? stop() : play();
      });
      play();

      window.addEventListener('resize', function () { w = 0; h = 0; });
    }

    // Не чіпаємо перший екран: шейдер стартує, коли браузер вільний.
    if (document.readyState === 'complete') whenIdle(start);
    else window.addEventListener('load', function () { whenIdle(start); });
  })();

  /* ----------------------------------------------------------
     ГОНОРАРИ АРТИСТІВ
     Рендеряться з GM_PRICES.fees — з того самого файлу, що й
     конструктор, щоб цифри в двох місцях не розійшлися.
     ---------------------------------------------------------- */
  (function fees() {
    var box = $('#fees');
    if (!box || !window.GM_PRICES || !window.GM_PRICES.fees) return;
    var cur = window.GM_PRICES.currency;
    var nf = null;
    try { nf = new Intl.NumberFormat('uk-UA'); } catch (e) {}
    function g(n) {
      return nf ? nf.format(n) : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
    box.innerHTML = window.GM_PRICES.fees.map(function (f) {
      return '<div class="fee-row">' +
        '<b>' + f.label + '</b>' +
        '<span class="fee-sum">' + g(f.price[0]) + ' – ' + g(f.price[1]) + ' ' + cur + '</span>' +
        (f.note ? '<p>' + f.note + '</p>' : '') +
      '</div>';
    }).join('');
  })();

  /* ----------------------------------------------------------
     ФОТО, ЯКИХ ПОКИ НЕМА
     Картка кейсу й портрет показують градієнт із монограмою, поки
     у відповідній теці немає файлу. Коли файл з'являється — JS
     підставляє його сам, переверстка не потрібна.
     ---------------------------------------------------------- */
  $$('[data-photo], [data-portrait]').forEach(function (slot) {
    var src = slot.getAttribute('data-photo') || slot.getAttribute('data-portrait');
    if (!src) return;
    // Секція кейсів прихована, поки немає реальних історій. Пробувати
    // вантажити фото з неї — це 404 на кожному відкритті сайту.
    if (slot.closest('[hidden]')) return;
    var probe = new Image();
    probe.onload = function () {
      var img = document.createElement('img');
      img.src = src;
      img.alt = slot.getAttribute('data-alt') || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      // розміри беремо з уже завантаженої проби: без них браузер не
      // знає висоту наперед і макет сіпається, коли фото стає на місце
      img.width = probe.naturalWidth;
      img.height = probe.naturalHeight;
      slot.appendChild(img);
      slot.classList.add('has-photo');
      var mark = $('.case-mark', slot) || $('.monogram', slot);
      if (mark) mark.style.display = 'none';
    };
    probe.src = src;
  });

  /* ----------------------------------------------------------
     FAQ — подія на розкриття
     Сам аккордеон працює без JS: це <details>.
     ---------------------------------------------------------- */
  $$('.faq details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      var s = $('summary', d);
      window.gmTrack('faq_open', { q: s ? s.textContent.trim().slice(0, 60) : '' });
    });
  });

  /* ----------------------------------------------------------
     КЛІКИ ПО КОНТАКТАХ
     ---------------------------------------------------------- */
  $$('a[href^="tel:"]').forEach(function (a) {
    a.addEventListener('click', function () { window.gmTrack('contact_click', { channel: 'phone' }); });
  });
  $$('a[href*="t.me/"]').forEach(function (a) {
    a.addEventListener('click', function () { window.gmTrack('contact_click', { channel: 'telegram' }); });
  });

  /* ----------------------------------------------------------
     ГЛУБИНА ПРОКРУТКИ
     ---------------------------------------------------------- */
  (function depth() {
    var marks = [25, 50, 75, 90];
    var hit = {};
    var ticking = false;
    function check() {
      ticking = false;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (h <= 0) return;
      var pct = (window.scrollY / h) * 100;
      marks.forEach(function (m) {
        if (pct >= m && !hit[m]) { hit[m] = true; window.gmTrack('scroll_depth', { pct: m }); }
      });
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(check);
    }, { passive: true });
  })();

  /* ----------------------------------------------------------
     МОДАЛКА
     ---------------------------------------------------------- */
  var modal = $('#modal');
  var modalClose = $('#modalClose');
  var lastFocus = null;

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('locked');
    if (modalClose) modalClose.focus();
  }
  function closeModal() {
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    setMenu(false);
    closeModal();
  });

  /* ----------------------------------------------------------
     ФОРМА -> TELEGRAM
     Один шлях відправки, а не два. Запасний no-cors-запит (як на
     сайті MedOrion) показував «Заявку прийнято» навіть тоді, коли
     Worker її відкинув: відповідь у такому режимі прочитати
     неможливо. Тут натомість — чесна страховка через localStorage.
     ---------------------------------------------------------- */
  var form      = $('#applyForm');
  var submitBtn = $('#submitBtn');
  var formError = $('#formError');

  function fieldOf(input) { return input.closest('.field'); }

  function validate() {
    var ok = true;
    $$('[required]', form).forEach(function (input) {
      var f = fieldOf(input);
      var bad = !input.value || !String(input.value).trim();
      if (!bad && input.type === 'tel') {
        // щонайменше 9 цифр — свідомо м'яко, люди пишуть по-різному
        bad = (String(input.value).replace(/\D/g, '').length < 9);
      }
      if (f) f.classList.toggle('invalid', bad);
      if (bad && ok) { input.focus(); ok = false; }
      else if (bad) { ok = false; }
    });
    return ok;
  }

  $$('input, select, textarea', form || document).forEach(function (input) {
    input.addEventListener('input', function () {
      var f = fieldOf(input);
      if (f) f.classList.remove('invalid');
    });
    input.addEventListener('change', function () {
      var f = fieldOf(input);
      if (f) f.classList.remove('invalid');
    });
  });

  function showError(text) {
    if (!formError) return;
    formError.textContent = text;
    formError.classList.add('show');
  }

  /* UTM зберігаємо на весь візит: інакше після переходу по
     внутрішніх посиланнях джерело губиться. */
  function utm() {
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var out = {};
    try {
      var q = new URLSearchParams(location.search);
      var saved = JSON.parse(sessionStorage.getItem('gmUtm') || '{}');
      keys.forEach(function (k) {
        var v = q.get(k) || saved[k];
        if (v) out[k.replace('utm_', '')] = String(v).slice(0, 80);
      });
      if (Object.keys(out).length) sessionStorage.setItem('gmUtm', JSON.stringify(out));
    } catch (e) {}
    return out;
  }

  function collect() {
    var honeypot = $('#f-company');
    var calcRaw = $('#f-calc') ? $('#f-calc').value : '';
    var data = {
      name:      $('#f-name').value.trim(),
      contact:   $('#f-contact').value.trim(),
      messenger: $('#f-messenger') ? $('#f-messenger').value : '',
      date:      $('#f-date') ? $('#f-date').value.trim() : '',
      comment:   $('#f-comment') ? $('#f-comment').value.trim() : '',
      company:   honeypot ? honeypot.value : '',     // пастка для ботів
      source:    calcRaw ? 'constructor' : 'form',
      page:      location.href.slice(0, 500),
      utm:       utm()
    };
    if (calcRaw) {
      try { data.calc = JSON.parse(calcRaw); } catch (e) {}
    }
    return data;
  }

  function send(data) {
    return fetch(TG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      return r.json().catch(function () { return null; });
    }).then(function (res) {
      // успіхом вважаємо ТІЛЬКИ явне ok:true
      if (!res || res.ok !== true) {
        throw new Error((res && (res.description || res.error)) || 'send failed');
      }
    });
  }

  /* Якщо мережа підвела — заявка не зникає: лягає в localStorage і
     одна спроба повтору станеться при наступному відкритті сайту. */
  function park(data) {
    try { localStorage.setItem('gm_pending', JSON.stringify({ at: Date.now(), data: data })); } catch (e) {}
  }
  (function retryPending() {
    var raw;
    try { raw = localStorage.getItem('gm_pending'); } catch (e) { return; }
    if (!raw) return;
    var box;
    try { box = JSON.parse(raw); } catch (e) { }
    // прибираємо і зіпсований запис, і застарілий (понад 3 доби)
    if (!box || !box.data || (Date.now() - box.at) > 3 * 864e5) {
      try { localStorage.removeItem('gm_pending'); } catch (e) {}
      return;
    }
    send(box.data).then(function () {
      try { localStorage.removeItem('gm_pending'); } catch (e) {}
    }, function () { /* лишаємо до наступного разу */ });
  })();

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (formError) formError.classList.remove('show');
      if (!validate()) return;

      var data = collect();
      var value = data.calc && data.calc.total
        ? Math.round((data.calc.total.low + data.calc.total.high) / 2)
        : 0;

      submitBtn.setAttribute('data-loading', 'true');
      var original = submitBtn.textContent;
      submitBtn.textContent = 'Надсилаємо…';

      send(data)
        .then(function () {
          form.reset();
          var box = $('#applyCalc');
          if (box) box.classList.remove('show');
          window.gmTrack('generate_lead', {
            value: value, currency: 'UAH', source: data.source,
            occasion: data.calc ? data.calc.occasion : '',
            level: data.calc ? data.calc.level : ''
          });
          openModal();
        })
        .catch(function (err) {
          if (window.console) console.error('[Gravity] заявку не надіслано:', err);
          park(data);
          window.gmTrack('form_error', { reason: String(err && err.message).slice(0, 60) });
          showError(
            'Не вдалося надіслати заявку. Напишіть, будь ласка, напряму: ' +
            TG_FALLBACK.replace('https://', '') + ' — або спробуйте ще раз за хвилину.'
          );
        })
        .then(function () {
          submitBtn.removeAttribute('data-loading');
          submitBtn.textContent = original;
        });
    });
  }
})();
