/* EeziNess first-party, cookie-free website measurement. */
(() => {
 'use strict';
 const origins=['https://eeziness.co.za','https://www.eeziness.co.za'];
 if(!origins.includes(location.origin)) return;
 const excluded=()=>{
  try {return localStorage.getItem('eeziness_tracking_paused')==='1';}catch{return false;}
 };
 if(excluded() || navigator.doNotTrack==='1' || navigator.globalPrivacyControl===true || /bot|crawler|spider|headless|playwright|puppeteer/i.test(navigator.userAgent)) return;
 const paths=new Set(['/','/privacy','/terms','/eezicomply/sample']);
 const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'') || '/';
 if(!paths.has(path)) return;
 const config=window.EEZI_TRAFFIC_CONFIG;
 if(!config) return;
 const query=new URLSearchParams(location.search);
 const slug=v=>/^[a-zA-Z0-9_-]{1,80}$/.test(v || '')?v:'';
 let referrer='';try {referrer=new URL(document.referrer).origin;}catch{}
 const campaign={source:slug(query.get('utm_source')),medium:slug(query.get('utm_medium')),campaign:slug(query.get('utm_campaign'))};
 const send=(kind,product='')=>{
  if(excluded()) return;
  const event={event_id:crypto.randomUUID(),kind,path,product,referrer,...campaign,is_test:query.get('traffic_test')==='1'};
  // A queued fetch survives ordinary product-link navigation. No navigation delay.
  fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`},body:JSON.stringify(event),keepalive:true,credentials:'omit'}).catch(()=>{});
 };
 let viewed=false;
 const view=()=>{if(!viewed && document.visibilityState!=='hidden'){viewed=true;send('pageview');}};
 view();document.addEventListener('visibilitychange',view);
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');if(!a)return;
  let u;try{u=new URL(a.href,location.href);}catch{return;}
  if(!origins.includes(u.origin))return;
  const product=u.pathname.split('/').filter(Boolean)[0];
  if(['eezifinance','eezicomply','eezifund','eezibid','eezinpo','eezidebt','eezirisk'].includes(product)) send('product_click',product);
 });
})();
