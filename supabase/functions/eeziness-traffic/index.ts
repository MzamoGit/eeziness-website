const SITE = 'https://www.eeziness.co.za';
const ORIGINS = new Set([SITE, 'https://eeziness.co.za']);
const PATHS = new Set(['/', '/privacy', '/terms', '/eezicomply/sample']);
const PRODUCTS = new Set(['eezifinance','eezicomply','eezifund','eezibid','eezinpo','eezidebt','eezirisk']);
const BOT = /bot|crawler|spider|headless|playwright|puppeteer|curl|wget|python|postman|monitor|lighthouse/i;
const base = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const serviceHeaders = { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
const slug = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v) ? v : '';
function headers(origin: string) {
 return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
}
async function rpc(name: string, body: object) {
 const r = await fetch(`${base}/rest/v1/rpc/${name}`, { method:'POST', headers:serviceHeaders, body:JSON.stringify(body) });
 if (!r.ok) throw new Error('Database request failed');
 return r.json();
}
async function visitor(req: Request, ua: string) {
 const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
 const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const h = await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`eeziness|${day}|${ip}|${ua}`));
 return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async(req: Request) => {
 const origin = req.headers.get('origin') || '';
 const h = headers(ORIGINS.has(origin) ? origin : SITE);
 const respond = (data: unknown, status=200) => new Response(data===null?null:JSON.stringify(data),{status,headers:h});
 if (!ORIGINS.has(origin)) return respond({error:'Origin not allowed'},403);
 if (req.method==='OPTIONS') return respond(null,204);
 try {
  if(req.method==='GET') {
   const authorization=req.headers.get('authorization') || '';
   if(!authorization.startsWith('Bearer ')) return respond({error:'Please sign in.'},401);
   const userResponse=await fetch(`${base}/auth/v1/user`, {headers:{apikey:secret,Authorization:authorization}});
   if(!userResponse.ok) return respond({error:'Your session has expired. Please sign in again.'},401);
   const user=await userResponse.json();
   if(!user.id || user.is_anonymous) return respond({error:'Access denied.'},403);
   const allowed=await fetch(`${base}/rest/v1/eeziness_traffic_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`,{headers:serviceHeaders});
   if(!allowed.ok) throw new Error('Admin check failed');
   if(!(await allowed.json()).length) return respond({error:'This account does not have access to website traffic.'},403);
   const days=Number(new URL(req.url).searchParams.get('days') || '7');
   if(![1,7,30,90].includes(days)) return respond({error:'Invalid date range.'},400);
   return respond(await rpc('eeziness_traffic_report',{p_days:days}));
  }
  if(req.method!=='POST') return respond({error:'Method not allowed'},405);
  const ua=req.headers.get('user-agent') || '';
  if(BOT.test(ua) || req.headers.get('dnt')==='1' || req.headers.get('sec-gpc')==='1') return respond(null,204);
  if(Number(req.headers.get('content-length') || 0)>2048) return respond({error:'Payload too large'},413);
  const raw=await req.text();
  if(raw.length>2048) return respond({error:'Payload too large'},413);
  let b; try {b=JSON.parse(raw);}catch{return respond({error:'Invalid event'},400);}
  if(!b || typeof b!=='object' || !['pageview','product_click'].includes(b.kind) || !PATHS.has(b.path) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.event_id || '')) return respond({error:'Invalid event'},400);
  if(b.kind==='product_click' && !PRODUCTS.has(b.product)) return respond({error:'Invalid product'},400);
  let referrer='';
  try {const u=new URL(b.referrer); if(['https:','http:'].includes(u.protocol) && !ORIGINS.has(u.origin) && /^[a-z0-9.-]{1,253}$/i.test(u.hostname)) referrer=u.hostname;}catch{}
  const event={event_id:b.event_id,visitor_hash:await visitor(req,ua),kind:b.kind,path:b.path,product:b.kind==='product_click'?b.product:'',referrer,source:slug(b.source),medium:slug(b.medium),campaign:slug(b.campaign),device:/ipad|tablet/i.test(ua)?'tablet':/mobile|android|iphone/i.test(ua)?'mobile':'desktop',is_test:b.is_test===true};
  const accepted=await rpc('eeziness_record_traffic',{p_event:event});
  return respond(null,accepted?204:429);
 } catch { return respond({error:'Traffic service temporarily unavailable.'},503); }
});
