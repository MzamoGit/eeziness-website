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

const naselaLogo = 'data:image/webp;base64,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';

const hero = document.querySelector('.hero');
if (hero && !document.querySelector('.ownership-strip')) {
  const ownership = document.createElement('section');
  ownership.className = 'ownership-strip';
  ownership.innerHTML = `
    <div class="container ownership-inner">
      <img src="${naselaLogo}" alt="Nasela Capital" class="nasela-logo" />
      <div class="ownership-copy">
        <span class="ownership-kicker">A NASELA CAPITAL INNOVATION</span>
        <strong>The Eezi product family is developed and owned by Nasela Capital.</strong>
        <span>Practical technology built around real business and everyday problems.</span>
      </div>
    </div>`;
  hero.insertAdjacentElement('afterend', ownership);
}

const footerBottom = document.querySelector('.footer-bottom');
if (footerBottom) {
  footerBottom.innerHTML = `© ${new Date().getFullYear()} Nasela Capital (Pty) Ltd. Eeziness and the Eezi product family are products of Nasela Capital.`;
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
  .panel-bottom { color:#665b73; }
  .panel-bottom i { background:linear-gradient(90deg,#efc47f,#9fdfbd,#d3aff2,#efa7b2); }
  .hero .btn-primary { background:var(--navy); box-shadow:0 12px 24px rgba(7,28,54,.18); }

  .ownership-strip {
    background:linear-gradient(90deg,#fffaf0,#ffffff 42%,#f5fff9);
    border-top:1px solid #efe4d4;
    border-bottom:1px solid #e8eee8;
    padding:22px 0;
  }
  .ownership-inner {
    display:flex;
    align-items:center;
    gap:28px;
  }
  .nasela-logo {
    width:150px;
    height:auto;
    flex:0 0 auto;
    border-radius:10px;
  }
  .ownership-copy {
    display:flex;
    flex-direction:column;
    gap:3px;
    color:#26374e;
  }
  .ownership-kicker {
    color:#b87400;
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
    .orbit-card.c1,.orbit-card.c2,.orbit-card.c3,.orbit-card.c4,.orbit-card.c5,.orbit-card.c6 {
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
    .orbit-card b { font-size:13px; }
    .orbit-card small { font-size:11px; }
    .panel-bottom {
      margin-top:18px;
      gap:5px;
      font-size:9px;
      flex-wrap:nowrap;
    }
    .panel-bottom i { margin:0 4px; min-width:8px; }
    .ownership-strip { padding:18px 0; }
    .ownership-inner {
      display:grid;
      grid-template-columns:1fr;
      gap:12px;
      text-align:center;
    }
    .nasela-logo { width:138px; margin:0 auto; }
    .ownership-copy strong { font-size:14px; }
    .ownership-copy > span:last-child { font-size:12px; }
  }
`;
document.head.appendChild(siteTreatment);
