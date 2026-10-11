(() => {
 'use strict';
 const config=window.EEZI_TRAFFIC_CONFIG, $=id=>document.getElementById(id);
 let session=null, report=null, timer=null;
 const status=message=>{$('status').textContent=message;};
 const format=n=>Number(n||0).toLocaleString('en-ZA');
 const authHeaders={apikey:config.publishableKey,'Content-Type':'application/json'};
 function clear(){session=null;report=null;clearInterval(timer);$('dashboard').hidden=true;$('logout').hidden=true;$('login').hidden=false;$('password').value='';}
 async function refreshToken(){
  if(!session || Date.now() < session.expires_at*1000-60000)return;
  const r=await fetch(`${config.baseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:authHeaders,body:JSON.stringify({refresh_token:session.refresh_token})});
  if(!r.ok){clear();throw new Error('Your session has expired. Please sign in again.');} session=await r.json();
 }
 function table(id,rows,columns){
  const box=$(id);box.replaceChildren();if(!rows.length){const p=document.createElement('p');p.textContent='No visits recorded in this period.';box.append(p);return;}
  const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
  columns.forEach(([name])=>{const th=document.createElement('th');th.scope='col';th.textContent=name;tr.append(th);});thead.append(tr);table.append(thead);
  const body=document.createElement('tbody');rows.forEach(row=>{const tr=document.createElement('tr');columns.forEach(([,key,numeric])=>{const td=document.createElement('td');td.textContent=numeric?format(row[key]):row[key]||'—';tr.append(td);});body.append(tr);});table.append(body);box.append(table);
 }
 function render(data){
  const s=data.summary;$('views').textContent=format(s.pageviews);$('visitors').textContent=format(s.daily_visitors);$('clicks').textContent=format(s.product_clicks);$('rate').textContent=s.pageviews?`${(100*s.product_clicks/s.pageviews).toFixed(1)}%`:'0%';
  $('comparison').textContent=`Previous ${data.days} days: ${format(s.previous_pageviews)} views`;
  $('updated').textContent='Updated '+new Date(data.generated_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})+' SAST';
  $('started').textContent=data.tracking_started?'Tracking began '+new Date(data.tracking_started).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})+' SAST.':'Tracking is active. The first recorded visit will appear here.';
  table('sources',data.sources,[['Source','source'],['Page views','views',true]]);table('products',data.products,[['Product','product'],['Clicks','clicks',true]]);table('pages',data.pages,[['Page','path'],['Views','views',true]]);table('devices',data.devices,[['Device','device'],['Views','views',true]]);table('campaigns',data.campaigns,[['Source','source'],['Medium','medium'],['Campaign','campaign'],['Views','views',true],['Clicks','clicks',true]]);table('daily-table',data.daily,[['Date','day'],['Views','views',true],['Daily visitor estimate','visitors',true],['Clicks','clicks',true]]);
  const chart=$('chart');chart.replaceChildren();const max=Math.max(1,...data.daily.map(d=>d.views));
  data.daily.forEach((day,i)=>{const item=document.createElement('div');item.className='bar-item';item.title=`${day.day}: ${day.views} page views`;const number=document.createElement('span');number.className='bar-value';number.textContent=data.days<=30?format(day.views):'';const bar=document.createElement('div');bar.className='bar';bar.style.height=`${Math.max(2,140*day.views/max)}px`;const label=document.createElement('span');label.className='bar-label';label.textContent=data.days<=7?day.day.slice(5):i%Math.ceil(data.days/7)===0?day.day.slice(5):'';item.append(number,bar,label);chart.append(item);});
 }
 async function load(){
  if(!session)return;status('Loading traffic…');$('refresh').disabled=true;
  try{await refreshToken();const r=await fetch(`${config.endpoint}?days=${$('range').value}`,{headers:{apikey:config.anonKey,Authorization:`Bearer ${session.access_token}`},cache:'no-store'});const data=await r.json();if(!r.ok){if([401,403].includes(r.status))clear();throw new Error(data.error||'Traffic could not be loaded.');}report=data;render(data);$('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;status('');}catch(e){status(e.message||'Check your connection and refresh.');}finally{$('refresh').disabled=false;}
 }
 $('login-form').addEventListener('submit',async e=>{e.preventDefault();$('signin').disabled=true;status('Signing in…');try{const r=await fetch(`${config.baseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:authHeaders,body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});const data=await r.json();$('password').value='';if(!r.ok)throw new Error('Sign-in failed. Check your EeziFinance email and password.');session=data;await load();if(session){clearInterval(timer);timer=setInterval(load,60000);}}catch(e){status(e.message);}finally{$('signin').disabled=false;}});
 $('logout').addEventListener('click',()=>{const token=session?.access_token;clear();status('Signed out.');if(token)fetch(`${config.baseUrl}/auth/v1/logout?scope=local`,{method:'POST',headers:{...authHeaders,Authorization:`Bearer ${token}`}}).catch(()=>{});});
 $('range').addEventListener('change',load);$('refresh').addEventListener('click',load);
 try{$('exclude').checked=localStorage.getItem('eeziness_tracking_paused')==='1';}catch{}
 $('exclude').addEventListener('change',()=>{try{localStorage.setItem('eeziness_tracking_paused',$('exclude').checked?'1':'0');status('');}catch{status('This browser could not save the exclusion preference.');}});
 $('campaign-form').addEventListener('submit',e=>{e.preventDefault();const url=new URL('https://www.eeziness.co.za/');url.searchParams.set('utm_source',$('campaign-source').value.trim());url.searchParams.set('utm_medium',$('campaign-medium').value.trim());url.searchParams.set('utm_campaign',$('campaign-name').value.trim());$('campaign-link').value=url.href;$('campaign-link').select();});
 $('export').addEventListener('click',()=>{if(!report)return;const rows=[['Date','Page views','Daily visitor estimate','Product clicks'],...report.daily.map(d=>[d.day,d.views,d.visitors,d.clicks]),[],['Source','Page views'],...report.sources.map(d=>[d.source,d.views]),[],['Product','Clicks'],...report.products.map(d=>[d.product,d.clicks]),[],['Source','Medium','Campaign','Views','Clicks'],...report.campaigns.map(d=>[d.source,d.medium,d.campaign,d.views,d.clicks])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/^[=+@-]/, "'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');const u=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='eeziness-traffic.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
})();
