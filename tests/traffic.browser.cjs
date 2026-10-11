const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const chrome=require(require.resolve('@sparticuz/chromium',{paths:[process.env.EEZI_TEST_BROWSER_MODULES]}));
const root=process.cwd();
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.EEZI_TEST_CHROMIUM,args:chrome.args.filter(a=>a!=='--disable-web-security'),headless:true,proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
 const context=await browser.newContext({ignoreHTTPSErrors:true,userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36'});
 await context.route('https://fonts.**',r=>r.abort());
 await context.route('https://www.eeziness.co.za/**',async route=>{
  const u=new URL(route.request().url());let file=u.pathname==='/'?'index.html':u.pathname.replace(/^\//,'');if(!path.extname(file))file+='.html';
  const p=path.join(root,file);if(!fs.existsSync(p))return route.fulfill({status:404,body:'Not found'});
  const ext=path.extname(file);return route.fulfill({status:200,contentType:ext==='.js'?'application/javascript':ext==='.css'?'text/css':'text/html',body:fs.readFileSync(p)});
 });
 const page=await context.newPage();page.on('pageerror',e=>console.log('Page error:',e.message));page.on('requestfailed',r=>console.log('Failed:',r.url(),r.failure()));let payloads=[],responses=[];page.on('request',r=>{if(r.url().includes('/functions/v1/eeziness-traffic')&&r.method()==='POST')payloads.push(JSON.parse(r.postData()));});page.on('response',r=>{if(r.url().includes('/functions/v1/eeziness-traffic')&&r.request().method()==='POST')responses.push(r.status());});
 const firstResponse=page.waitForResponse(r=>r.url().includes('/functions/v1/eeziness-traffic')&&r.request().method()==='POST');
 await page.goto('https://www.eeziness.co.za/?traffic_test=1&utm_source=whatsapp&utm_medium=social&utm_campaign=uat_october');
 await firstResponse;
 await page.locator('a[href="/eezifinance"]').click();
 await page.waitForTimeout(2500);
 assert.equal(payloads.length,2);assert.deepEqual(payloads.map(p=>p.kind),['pageview','product_click']);assert.equal(payloads[1].product,'eezifinance');assert(payloads.every(p=>p.is_test && p.campaign==='uat_october'));assert(responses.every(s=>s===204),JSON.stringify(responses));console.log('Browser event emission and live page-view response:',JSON.stringify({events:payloads.map(x=>({id:x.event_id,kind:x.kind,product:x.product})),responses}));
 await page.goto('https://www.eeziness.co.za/admin/traffic');assert(await page.locator('#login').isVisible());assert(!(await page.locator('#dashboard').isVisible()));
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/workspace/scratch/078e430ad7a2/traffic-login-mobile.png'});
 const before=payloads.length;await page.evaluate(()=>localStorage.setItem('eeziness_tracking_paused','1'));await page.goto('https://www.eeziness.co.za/?traffic_test=1');await page.waitForTimeout(500);assert.equal(payloads.length,before);console.log('Browser exclusion and mobile login: passed');
 // Report UI uses an explicit fixture, not a claimed authenticated production session.
 await context.route('**/auth/v1/token?grant_type=password',r=>r.fulfill({json:{access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600}}));
 const fixture={days:7,generated_at:new Date().toISOString(),tracking_started:new Date().toISOString(),summary:{pageviews:12,daily_visitors:8,product_clicks:4,previous_pageviews:6},daily:[{day:'2026-10-11',views:12,visitors:8,clicks:4}],sources:[{source:'whatsapp',views:12}],products:[{product:'eezifinance',clicks:4}],pages:[{path:'/',views:12}],devices:[{device:'mobile',views:12}],campaigns:[{source:'whatsapp',medium:'social',campaign:'october',views:12,clicks:4}]};
 await context.route('**/functions/v1/eeziness-traffic?days=*',r=>r.fulfill({json:fixture}));
 await page.goto('https://www.eeziness.co.za/admin/traffic');await page.locator('#password').fill('fixture-only');await page.locator('#signin').click();await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(await page.locator('#views').textContent(),'12');assert.equal(await page.locator('#rate').textContent(),'33.3%');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/workspace/scratch/078e430ad7a2/traffic-dashboard-mobile.png',fullPage:true});
 await page.locator('#campaign-source').fill('whatsapp');await page.locator('#campaign-medium').fill('social');await page.locator('#campaign-name').fill('october');await page.locator('#campaign-form button').click();assert((await page.locator('#campaign-link').inputValue()).includes('utm_campaign=october'));
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs('/workspace/scratch/078e430ad7a2/traffic-test.csv');assert(fs.readFileSync('/workspace/scratch/078e430ad7a2/traffic-test.csv','utf8').includes('whatsapp'));
 await page.locator('#logout').click();assert(await page.locator('#login').isVisible());console.log('Dashboard rendering fixture, campaign link, CSV export and sign-out: passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
