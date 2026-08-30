const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

document.getElementById('year').textContent = new Date().getFullYear();

const naselaLogo = 'data:image/png;base64,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';

const aboutNaselaLogo = document.querySelector('.nasela-about-logo');
if (aboutNaselaLogo) aboutNaselaLogo.src = naselaLogo;

const hero = document.querySelector('.hero');
if (hero && !document.querySelector('.ownership-strip')) {
  const ownership = document.createElement('section');
  ownership.className = 'ownership-strip';
  ownership.innerHTML = `
    <div class="container ownership-inner">
      <img src="${naselaLogo}" alt="Nasela Capital" class="nasela-logo" />
      <div class="ownership-copy">
        <span class="ownership-kicker">A NASELA CAPITAL INNOVATION</span>
        <strong>The Eezi enabler family is developed and owned by Nasela Capital.</strong>
        <span>Practical technology built around real business and everyday problems.</span>
      </div>
    </div>`;
  hero.insertAdjacentElement('afterend', ownership);
}

const footerBottom = document.querySelector('.footer-bottom');
if (footerBottom) {
  footerBottom.innerHTML = `© ${new Date().getFullYear()} Nasela Capital (Pty) Ltd. EeziNess and the Eezi enabler family are developed and owned by Nasela Capital.`;
}

const siteTreatment = document.createElement('style');
siteTreatment.textContent = `
  .hero-panel {
    background:
      radial-gradient(circle at 14% 13%, rgba(245,158,11,.31), transparent 29%),
      radial-gradient(circle at 88% 16%, rgba(16,185,129,.29), transparent 29%),
      radial-gradient(circle at 86% 84%, rgba(168,85,247,.24), transparent 29%),
      radial-gradient(circle at 12% 86%, rgba(244,63,94,.18), transparent 27%),
      linear-gradient(145deg,#fffdf8 6%,#ffffff 48%,#f7fff9 100%);
    border-color:#eadcc5;
    box-shadow:0 28px 76px rgba(69,54,88,.14);
  }
  .hero-panel:before { border-color:rgba(245,158,11,.20); }
  .hero-panel:after { border-color:rgba(168,85,247,.17); }
  .status-dot {
    color:#08785f;
    background:rgba(16,185,129,.14);
    border:1px solid rgba(16,185,129,.25);
    padding:5px 9px;
    border-radius:999px;
  }
  .panel-kicker { color:#665b73; }
  .orbit:before { border-color:rgba(168,85,247,.22); }
  .orbit:after { border-color:rgba(16,185,129,.24); }
  .orbit-core {
    background:linear-gradient(135deg,#fff8e6 5%,#ffffff 48%,#e8fff4 100%);
    border-color:#dfd2bb;
    box-shadow:0 20px 42px rgba(91,68,105,.16);
  }
  .orbit-card {
    box-shadow:0 14px 30px rgba(76,60,92,.12);
    transition:transform .2s ease, box-shadow .2s ease;
  }
  .orbit-card:hover { transform:translateY(-2px); box-shadow:0 18px 36px rgba(76,60,92,.16); }
  .orbit-card.c1 { background:linear-gradient(145deg,#ffffff,#e9f2ff); border-color:#a9c9f5; }
  .orbit-card.c2 { background:linear-gradient(145deg,#ffffff,#e2faec); border-color:#9fdfbd; }
  .orbit-card.c3 { background:linear-gradient(145deg,#ffffff,#f3e8ff); border-color:#d3aff2; }
  .orbit-card.c4 { background:linear-gradient(145deg,#ffffff,#def9f6); border-color:#9ddfd8; }
  .orbit-card.c5 { background:linear-gradient(145deg,#ffffff,#fff0d7); border-color:#efc47f; }
  .orbit-card.c6 { background:linear-gradient(145deg,#ffffff,#ffe5e9); border-color:#efa7b2; }
  .orbit-card.c7 { background:linear-gradient(145deg,#ffffff,#e8f9fd); border-color:#a8dfe9; }
  .panel-bottom { color:#665b73; }
  .panel-bottom i { background:linear-gradient(90deg,#efc47f,#9fdfbd,#d3aff2,#efa7b2); }
  .hero .btn-primary { background:var(--navy); box-shadow:0 12px 24px rgba(7,28,54,.18); }

  .ownership-strip {
    background:#fff;
    border-top:1px solid #edf0f3;
    border-bottom:1px solid #edf0f3;
    padding:20px 0;
  }
  .ownership-inner {
    display:flex;
    align-items:center;
    gap:24px;
  }
  .nasela-logo {
    width:140px;
    height:auto;
    flex:0 0 auto;
    display:block;
    border:0;
    border-radius:0;
    box-shadow:none;
    background:transparent;
    filter:brightness(1.08) contrast(1.18);
  }
  .ownership-copy {
    display:flex;
    flex-direction:column;
    gap:3px;
    color:#26374e;
  }
  .ownership-kicker {
    color:#936300;
    font-size:10px;
    font-weight:800;
    letter-spacing:.13em;
  }
  .ownership-copy strong { font-size:15px; }
  .ownership-copy > span:last-child { color:#697587; font-size:13px; }

  @media(max-width:740px) {
    .hero-panel {
      min-height:0 !important;
      padding:18px !important;
      border-radius:24px;
    }
    .panel-topbar { gap:10px; }
    .mini-brand { font-size:12px; }
    .status-dot { font-size:10px; padding:4px 7px; }
    .panel-kicker { margin:22px 0 12px; font-size:10px; line-height:1.4; }
    .orbit {
      height:auto !important;
      margin-top:0 !important;
      display:grid !important;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      background:none !important;
    }
    .orbit:before,.orbit:after { display:none !important; }
    .orbit-core {
      position:relative !important;
      inset:auto !important;
      left:auto !important;
      top:auto !important;
      transform:none !important;
      grid-column:1 / -1;
      width:92px;
      height:92px;
      margin:0 auto 3px;
      border-radius:25px;
      font-size:22px;
    }
    .orbit-card,
    .orbit-card.c1,.orbit-card.c2,.orbit-card.c3,.orbit-card.c4,.orbit-card.c5,.orbit-card.c6,.orbit-card.c7 {
      position:relative !important;
      inset:auto !important;
      left:auto !important;
      right:auto !important;
      top:auto !important;
      bottom:auto !important;
      width:auto !important;
      min-width:0;
      min-height:94px;
      padding:13px;
      border-radius:16px;
    }
    .orbit-card.c7 {
      grid-column:1 / -1;
      min-height:88px;
      background:linear-gradient(145deg,#ffffff,#e8f9fd);
      border-color:#8ed4e2;
      border-top-width:5px;
    }
    .orbit-card.c7 b { font-size:15px; }
    .orbit-card b { font-size:13px; }
    .orbit-card small { font-size:11px; }
    .panel-bottom {
      margin-top:18px;
      gap:5px;
      font-size:9px;
      flex-wrap:nowrap;
    }
    .panel-bottom i { margin:0 4px; min-width:8px; }
    .ownership-strip { padding:16px 0; }
    .ownership-inner {
      display:grid;
      grid-template-columns:1fr;
      gap:10px;
      text-align:center;
    }
    .nasela-logo { width:125px; margin:0 auto; }
    .ownership-copy strong { font-size:14px; }
    .ownership-copy > span:last-child { font-size:12px; }
  }
`;
document.head.appendChild(siteTreatment);
