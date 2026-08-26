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

// A slightly more vibrant hero treatment while keeping the overall site clean and professional.
const vibrancy = document.createElement('style');
vibrancy.textContent = `
  .hero-panel {
    background:
      radial-gradient(circle at 13% 14%, rgba(26,115,232,.28), transparent 31%),
      radial-gradient(circle at 88% 18%, rgba(0,184,169,.26), transparent 29%),
      radial-gradient(circle at 88% 84%, rgba(139,92,246,.19), transparent 28%),
      radial-gradient(circle at 16% 88%, rgba(251,146,60,.14), transparent 25%),
      linear-gradient(145deg,#ffffff 8%,#f1f8ff 60%,#f5fbfa 100%);
    border-color:#c9deee;
    box-shadow:0 28px 76px rgba(21,88,150,.16);
  }
  .hero-panel:before { border-color:rgba(37,99,235,.17); }
  .hero-panel:after { border-color:rgba(13,148,136,.17); }
  .status-dot {
    color:#08775f;
    background:rgba(16,185,129,.10);
    border:1px solid rgba(16,185,129,.18);
    padding:5px 9px;
    border-radius:999px;
  }
  .orbit:before { border-color:rgba(37,99,235,.25); }
  .orbit:after { border-color:rgba(13,148,136,.22); }
  .orbit-core {
    background:linear-gradient(135deg,#ffffff 10%,#dff3ff 58%,#ddfbf4 100%);
    border-color:#bdd8ea;
    box-shadow:0 20px 42px rgba(22,88,148,.18);
  }
  .orbit-card {
    box-shadow:0 14px 30px rgba(29,69,109,.11);
    transition:transform .2s ease, box-shadow .2s ease;
  }
  .orbit-card:hover { transform:translateY(-2px); box-shadow:0 18px 36px rgba(29,69,109,.15); }
  .orbit-card.c1 { background:linear-gradient(145deg,#ffffff,#e6f1ff); border-color:#bcd6fb; }
  .orbit-card.c2 { background:linear-gradient(145deg,#ffffff,#e5fbf1); border-color:#b9ead2; }
  .orbit-card.c3 { background:linear-gradient(145deg,#ffffff,#f1e9ff); border-color:#d8c5f7; }
  .orbit-card.c4 { background:linear-gradient(145deg,#ffffff,#e3fbfa); border-color:#b7e7e5; }
  .orbit-card.c5 { background:linear-gradient(145deg,#ffffff,#fff1de); border-color:#f3d2a7; }
  .orbit-card.c6 { background:linear-gradient(145deg,#ffffff,#ffe9e9); border-color:#f0c2c2; }
  .panel-bottom i { background:linear-gradient(90deg,#bfd6f3,#b9e8e2,#ddcaf7); }
  .hero .btn-primary {
    background:linear-gradient(135deg,#0b4ea2,#0a6bd8 55%,#059b9a);
    box-shadow:0 14px 30px rgba(10,107,216,.22);
  }
`;
document.head.appendChild(vibrancy);
