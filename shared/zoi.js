/* zoi.js · shared runtime for zoidev landings
 * Handles: i18n toggle (ES/EN, persisted), scroll-in animations + parallax,
 * Pangolin-compatible login flow, and the post-login services dashboard.
 *
 * The auth flow is real: clicking [data-action="login"] redirects to
 *   <CONFIG.authUrl><CONFIG.authLoginPath>?redirect_url=<here>?logged_in=1
 * Pangolin sets its cookie on .zoidev.com, the user lands back here, and
 * every service card under #zoi-services-grid is a direct link to its
 * subdomain — the browser sends the same cookie, Pangolin's forward-auth
 * lets the request through. No JS auth state required.
 *
 * CONFIG.demoMode = true short-circuits the redirect so the local preview
 * (and the canvas iframes) can open the dashboard without leaving the page.
 */
(function () {
  // ---------- Configuration ----------
  const CONFIG = Object.assign({
    // Pangolin's own domain — its login UI, cookie issuer, and OIDC initiator
    // all live here. Override via window.ZOIDEV_CONFIG if your Pangolin lives
    // elsewhere. Users / Pocket-ID IDP are configured INSIDE Pangolin's admin
    // panel — never in this codebase.
    authUrl:        'https://pangolin.zoidev.com',
    authLoginPath:  '/auth/login',
    authLogoutPath: '/auth/logout',
    // Optional: deep-link straight to the Pocket-ID OIDC initiator so the
    // user skips Pangolin's method-picker. The actual `idp` slug depends on
    // what you named the provider in Pangolin → Settings → Identity Providers.
    pocketIdLoginUrl: 'https://pangolin.zoidev.com/auth/idp/pocket-id/oidc/login',
    services: [
      { id: 'portainer', name: 'Portainer', url: 'https://portainer.zoidev.com', dot: '#13bef9',
        desc: { es: 'Contenedores Docker',           en: 'Docker containers' } },
      { id: 'nas',       name: 'NAS',       url: 'https://nas.zoidev.com',       dot: '#8ab43f',
        desc: { es: 'Almacenamiento y backups',      en: 'Storage & backups' } },
      { id: 'npm',       name: 'Nginx PM',  url: 'https://npm.zoidev.com',       dot: '#f15c2e',
        desc: { es: 'Proxy inverso, certificados',   en: 'Reverse proxy, certs' } },
      { id: 'emby',      name: 'Emby',      url: 'https://emby.zoidev.com',      dot: '#52b54b',
        desc: { es: 'Servidor multimedia',           en: 'Media server' } },
      { id: 'immich',    name: 'Immich',    url: 'https://photos.zoidev.com',    dot: '#4250af',
        desc: { es: 'Fotos y vídeos',                en: 'Photos & videos' } },
      { id: 'homepage',  name: 'Homepage',  url: 'https://home.zoidev.com',      dot: '#a78bfa',
        desc: { es: 'Panel general',                 en: 'Overview' } },
    ],
    // demoMode: true inside iframes / file://, so the preview never tries
    // to navigate away. Production deploys flip it off.
    demoMode: location.hostname !== 'zoidev.com',
  }, window.ZOIDEV_CONFIG || {});
  window.ZOIDEV_CONFIG = CONFIG;

  // ---------- i18n ----------
  const S = {
    es: {
      brand_tagline: 'zero-overhead intelligence',
      nav_services: 'Servicios',
      nav_process: 'Proceso',
      nav_stack: 'Stack',
      nav_contact: 'Contacto',
      nav_login: 'Acceder',
      lang_other: 'EN',

      hero_eyebrow: '01 · qué es zoi',
      hero_title_1: 'Software que pesa',
      hero_title_2: 'lo justo.',
      hero_title_3: 'Ni una línea de más.',
      hero_sub: 'Desarrollo a medida e ingeniería inversa para gente que sólo necesita que algo funcione. Sin frameworks de moda, sin sprints eternos, sin discursos.',
      hero_cta_primary: 'Tengo un proyecto',
      hero_cta_secondary: 'Cómo trabajo →',
      hero_meta_loc: 'Madrid · remoto',
      hero_meta_status: 'Disponible',

      services_eyebrow: '02 · servicios',
      services_title: 'Cinco cosas. Bien hechas.',
      services_sub: 'No mil cosas a medias.',
      s1_t: 'Vibe coding',
      s1_d: 'Te sientas a mi lado, abrimos el editor y construimos. Funcionalidad real en horas, no en sprints.',
      s1_tag: 'desarrollo en vivo',
      s2_t: 'Ingeniería inversa',
      s2_d: 'Binarios, APIs sin documentar, formatos cerrados, sistemas legacy. Si arranca, lo entendemos. Si no, lo arreglamos.',
      s2_tag: 'binarios · APIs · legacy',
      s3_t: 'Apps móviles',
      s3_d: 'iOS y Android nativos, o cross-platform cuando tiene sentido de verdad. Nada de Electron disfrazado.',
      s3_tag: 'iOS · Android',
      s4_t: 'Web apps & SaaS',
      s4_d: 'Del MVP a producción. Stack moderno y deploy en tu propio servidor si quieres dormir tranquilo.',
      s4_tag: 'MVP → prod',
      s5_t: 'Automatización',
      s5_d: 'Scripts, agentes y pipelines. Todo lo que haces dos veces, lo hace una máquina la tercera.',
      s5_tag: 'scripts · agentes',

      process_eyebrow: '03 · proceso',
      process_title: 'Sin sales calls.',
      process_sub: 'Sin propuestas de 40 páginas. Sin retainers de seis meses.',
      p1_n: '01', p1_t: 'Hablamos', p1_d: 'Email o videollamada de 20 minutos. Me cuentas qué necesitas y te digo si puedo, en cuánto y a qué precio.',
      p2_n: '02', p2_t: 'Construyo', p2_d: 'Iteración corta, commits diarios, demo cada pocos días. Si algo no encaja, lo cambiamos antes de gastar dos semanas.',
      p3_n: '03', p3_t: 'Entrego', p3_d: 'Código, documentación y despliegue. Tres meses de soporte para que no te quedes solo al día siguiente.',

      stack_eyebrow: '04 · stack',
      stack_title: 'Con qué construyo',
      stack_sub: 'Herramientas aburridas que llevan años funcionando. Y unas pocas nuevas que se han ganado el sitio.',

      contact_eyebrow: '05 · contacto',
      contact_title: 'Cuéntame algo.',
      contact_sub: 'Si tu correo describe un problema concreto, te respondo. Casi siempre el mismo día.',
      contact_name: 'Pablo Nieto',
      contact_role: 'Desarrollo & reverse engineering',
      contact_loc: 'Madrid, España',
      contact_cta: 'Escribir un email →',

      footer_left: '© 2026 zoidev · cero overhead',
      footer_right: 'pablonie@gmail.com',

      // Login modal
      login_eyebrow: 'autenticación',
      login_title: 'Panel privado',
      login_continue: 'Continuar →',
      login_pocketid: 'Continuar con Pocket ID',
      login_or: 'o',
      login_help: 'Te llevamos a Pangolin para iniciar sesión.',
      login_cancel: 'Cerrar',

      // Dashboard
      dash_eyebrow: 'sesión activa',
      dash_title: 'Tus servicios',
      dash_sub: 'Cookie compartida en *.zoidev.com · acceso directo, sin volver a loguearte.',
      dash_logout: 'Cerrar sesión',
      dash_close: 'Cerrar',
    },
    en: {
      brand_tagline: 'zero-overhead intelligence',
      nav_services: 'Services',
      nav_process: 'Process',
      nav_stack: 'Stack',
      nav_contact: 'Contact',
      nav_login: 'Sign in',
      lang_other: 'ES',

      hero_eyebrow: '01 · what zoi is',
      hero_title_1: 'Software that weighs',
      hero_title_2: 'just enough.',
      hero_title_3: 'Not a line more.',
      hero_sub: 'Custom development and reverse engineering for people who just need something to work. No trending frameworks, no endless sprints, no pitch decks.',
      hero_cta_primary: 'I have a project',
      hero_cta_secondary: 'How I work →',
      hero_meta_loc: 'Madrid · remote',
      hero_meta_status: 'Available',

      services_eyebrow: '02 · services',
      services_title: 'Five things. Done well.',
      services_sub: 'Not a thousand things, half-baked.',
      s1_t: 'Vibe coding',
      s1_d: 'You sit in, we open the editor, we build. Real functionality in hours, not sprints.',
      s1_tag: 'live development',
      s2_t: 'Reverse engineering',
      s2_d: 'Binaries, undocumented APIs, closed formats, legacy systems. If it runs, we understand it. If it doesn’t, we fix it.',
      s2_tag: 'binaries · APIs · legacy',
      s3_t: 'Mobile apps',
      s3_d: 'Native iOS and Android, or cross-platform when it actually makes sense. No Electron in a trench coat.',
      s3_tag: 'iOS · Android',
      s4_t: 'Web apps & SaaS',
      s4_d: 'From MVP to production. Modern stack, self-host if you want to sleep at night.',
      s4_tag: 'MVP → prod',
      s5_t: 'Automation',
      s5_d: 'Scripts, agents and pipelines. Anything you do twice, a machine does on the third pass.',
      s5_tag: 'scripts · agents',

      process_eyebrow: '03 · process',
      process_title: 'No sales calls.',
      process_sub: 'No 40-page proposals. No six-month retainers.',
      p1_n: '01', p1_t: 'We talk', p1_d: '20-minute email or call. You tell me what you need; I tell you if I can, how long and how much.',
      p2_n: '02', p2_t: 'I build', p2_d: 'Short iterations, daily commits, demo every few days. If something’s off, we fix it before two weeks burn.',
      p3_n: '03', p3_t: 'I ship', p3_d: 'Code, docs and deploy. Three months of support so you’re not on your own the next day.',

      stack_eyebrow: '04 · stack',
      stack_title: 'What I build with',
      stack_sub: 'Boring tools that have worked for years. And a few new ones that earned their seat.',

      contact_eyebrow: '05 · contact',
      contact_title: 'Tell me something.',
      contact_sub: 'If your email describes an actual problem, I’ll reply. Usually same day.',
      contact_name: 'Pablo Nieto',
      contact_role: 'Development & reverse engineering',
      contact_loc: 'Madrid, Spain',
      contact_cta: 'Send an email →',

      footer_left: '© 2026 zoidev · zero overhead',
      footer_right: 'pablonie@gmail.com',

      login_eyebrow: 'authentication',
      login_title: 'Private panel',
      login_continue: 'Continue →',
      login_pocketid: 'Continue with Pocket ID',
      login_or: 'or',
      login_help: 'We send you to Pangolin to sign in.',
      login_cancel: 'Close',

      dash_eyebrow: 'active session',
      dash_title: 'Your services',
      dash_sub: 'Shared cookie on *.zoidev.com · direct access, no re-login.',
      dash_logout: 'Sign out',
      dash_close: 'Close',
    }
  };

  const LANG_KEY = 'zoidev:lang';
  function getLang() {
    return localStorage.getItem(LANG_KEY)
      || (navigator.language && navigator.language.startsWith('en') ? 'en' : 'es');
  }
  function applyLang() {
    const lang = getLang();
    document.documentElement.lang = lang;
    const dict = S[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = dict[el.dataset.i18n];
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      // data-i18n-attr="placeholder:login_user_ph"
      const [attr, key] = el.dataset.i18nAttr.split(':');
      const v = dict[key];
      if (v != null) el.setAttribute(attr, v);
    });
    window.dispatchEvent(new CustomEvent('zoidev:lang', { detail: { lang, dict } }));
  }
  function toggleLang() {
    localStorage.setItem(LANG_KEY, getLang() === 'es' ? 'en' : 'es');
    applyLang();
  }

  // ---------- Scroll-driven animations ----------
  function initScroll() {
    // Fade + rise on entry. Class `.in` flips opacity/transform via CSS.
    // IntersectionObserver does not deliver callbacks while the document is
    // hidden (e.g. background tab, preview pane). Combine it with a safety
    // timer + visibilitychange + immediate reveal of anything already in
    // the first viewport so initial content never gets stuck at opacity 0.
    const targets = Array.from(document.querySelectorAll('[data-anim]'));
    const reveal = (el) => { el.classList.add('in'); io.unobserve(el); };
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) reveal(e.target); });
    }, { rootMargin: '-8% 0px -10% 0px', threshold: 0.04 });
    targets.forEach(el => io.observe(el));

    // Initial pass: anything already inside the viewport reveals immediately
    // so the hero is never blank, even before the observer fires.
    const vh = window.innerHeight || document.documentElement.clientHeight;
    targets.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) reveal(el);
    });

    // Belt-and-suspenders: if the page loads with the tab hidden, IO is
    // silent — flip anything still hidden once the tab becomes visible,
    // and as a last resort after 1.2s no matter what.
    const flushAll = () => targets.forEach(el => { if (!el.classList.contains('in')) reveal(el); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') flushAll();
    });
    setTimeout(flushAll, 1200);

    // Stagger immediate children of [data-stagger]
    document.querySelectorAll('[data-stagger]').forEach(parent => {
      const step = parseFloat(parent.dataset.stagger) || 0.08;
      Array.from(parent.children).forEach((c, i) => {
        c.style.setProperty('--stagger', (i * step) + 's');
      });
    });

    // Parallax via --py (used in CSS as translateY(var(--py)))
    const parallax = Array.from(document.querySelectorAll('[data-parallax]'));
    if (parallax.length) {
      let raf = 0;
      const tick = () => {
        const sy = window.scrollY;
        parallax.forEach(el => {
          const v = parseFloat(el.dataset.parallax) || 0.2;
          el.style.setProperty('--py', (sy * v).toFixed(2) + 'px');
        });
        raf = 0;
      };
      window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
      tick();
    }

    // Sticky section labels — expose scroll progress as --sp 0..1 on body
    let raf2 = 0;
    const setProg = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? h.scrollTop / max : 0;
      document.body.style.setProperty('--sp', p.toFixed(4));
      raf2 = 0;
    };
    window.addEventListener('scroll', () => { if (!raf2) raf2 = requestAnimationFrame(setProg); }, { passive: true });
    setProg();
  }

  // ---------- Auth (Pangolin) ----------
  function isLogged() {
    return new URL(location.href).searchParams.get('logged_in') === '1'
      || sessionStorage.getItem('zoidev:logged') === '1';
  }
  function doLogin() {
    if (CONFIG.demoMode) {
      sessionStorage.setItem('zoidev:logged', '1');
      closeLogin();
      openDashboard();
      return;
    }
    const back = location.origin + location.pathname + '?logged_in=1';
    location.href = CONFIG.authUrl + CONFIG.authLoginPath
      + '?redirect_url=' + encodeURIComponent(back);
  }
  function doLoginPocketId() {
    if (CONFIG.demoMode) {
      sessionStorage.setItem('zoidev:logged', '1');
      closeLogin();
      openDashboard();
      return;
    }
    const back = location.origin + location.pathname + '?logged_in=1';
    const url  = CONFIG.pocketIdLoginUrl;
    const sep  = url.indexOf('?') === -1 ? '?' : '&';
    location.href = url + sep + 'redirect_url=' + encodeURIComponent(back);
  }
  function doLogout() {
    sessionStorage.removeItem('zoidev:logged');
    closeDashboard();
    if (!CONFIG.demoMode) {
      location.href = CONFIG.authUrl + CONFIG.authLogoutPath
        + '?redirect_url=' + encodeURIComponent(location.origin + location.pathname);
    }
  }

  // ---------- Modal open/close ----------
  function openLogin()     { document.getElementById('zoi-login')?.classList.add('open'); }
  function closeLogin()    { document.getElementById('zoi-login')?.classList.remove('open'); }
  function openDashboard() {
    const m = document.getElementById('zoi-dashboard');
    if (!m) return;
    renderServices();
    m.classList.add('open');
  }
  function closeDashboard(){ document.getElementById('zoi-dashboard')?.classList.remove('open'); }

  // ---------- Services grid ----------
  function renderServices() {
    const grid = document.getElementById('zoi-services-grid');
    if (!grid) return;
    const lang = getLang();
    grid.innerHTML = CONFIG.services.map((s, i) => `
      <a class="zoi-svc" href="${s.url}" target="_top" data-service="${s.id}" style="--i:${i}">
        <span class="zoi-svc-dot" style="background:${s.dot}"></span>
        <span class="zoi-svc-body">
          <span class="zoi-svc-name">${s.name}</span>
          <span class="zoi-svc-desc">${s.desc[lang]}</span>
        </span>
        <span class="zoi-svc-url">${s.url.replace('https://', '')}</span>
        <span class="zoi-svc-arrow" aria-hidden="true">↗</span>
      </a>
    `).join('');
  }

  // ---------- Wire everything up ----------
  function bind() {
    document.querySelectorAll('[data-action="toggle-lang"]').forEach(b =>
      b.addEventListener('click', (e) => { e.preventDefault(); toggleLang(); }));

    document.querySelectorAll('[data-action="login"]').forEach(b =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        if (isLogged()) openDashboard(); else openLogin();
      }));

    document.querySelectorAll('[data-action="login-submit"]').forEach(b =>
      b.addEventListener('click', (e) => { e.preventDefault(); doLogin(); }));

    document.querySelectorAll('form[data-action="login-form"]').forEach(f =>
      f.addEventListener('submit', (e) => { e.preventDefault(); doLogin(); }));

    document.querySelectorAll('[data-action="login-pocketid"]').forEach(b =>
      b.addEventListener('click', (e) => { e.preventDefault(); doLoginPocketId(); }));

    // Dev/local convenience: long-press the title to enter demo mode.
    // Hidden from real visitors; useful while iterating.
    document.querySelectorAll('[data-action="login-demo"]').forEach(b =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.setItem('zoidev:logged', '1');
        closeLogin(); openDashboard();
      }));

    document.querySelectorAll('[data-action="logout"]').forEach(b =>
      b.addEventListener('click', (e) => { e.preventDefault(); doLogout(); }));

    document.querySelectorAll('[data-action="close-modal"]').forEach(b =>
      b.addEventListener('click', (e) => { e.preventDefault(); closeLogin(); closeDashboard(); }));

    document.querySelectorAll('.zoi-modal__bg').forEach(b =>
      b.addEventListener('click', () => { closeLogin(); closeDashboard(); }));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeLogin(); closeDashboard(); }
    });

    // Mobile nav toggle
    document.querySelectorAll('[data-action="nav-toggle"]').forEach(b =>
      b.addEventListener('click', () => {
        document.body.classList.toggle('nav-open');
      }));
    document.querySelectorAll('[data-nav-close]').forEach(a =>
      a.addEventListener('click', () => document.body.classList.remove('nav-open')));

    window.addEventListener('zoidev:lang', renderServices);

    // If we landed back from Pangolin with ?logged_in=1, pop the dashboard.
    if (isLogged()) {
      // wait one frame so layout settles
      requestAnimationFrame(() => openDashboard());
    }
  }

  function init() { applyLang(); initScroll(); bind(); renderServices(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Zoidev = { getLang, toggleLang, openLogin, openDashboard, doLogin, doLogout, CONFIG };
})();
