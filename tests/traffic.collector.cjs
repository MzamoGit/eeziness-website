const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ts=require(require.resolve('typescript',{paths:[process.env.EEZI_TEST_MODULES]}));
let handler,mode='owner';
const fixture={summary:{pageviews:10}};
const source=fs.readFileSync('supabase/functions/eeziness-traffic/index.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const ctx={Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://test.supabase.co':'server-secret'},serve:h=>handler=h},crypto:require('node:crypto').webcrypto,TextEncoder,Intl,URL,Response,Request,Set,fetch:async(url)=>{
 if(url.includes('/auth/v1/user'))return mode==='invalid'?Response.json({},{status:401}):Response.json({id:mode==='owner'?'owner':'other'});
 if(url.includes('/eeziness_traffic_admins'))return Response.json(mode==='owner'?[{user_id:'owner'}]:[]);
 if(url.includes('/eeziness_traffic_report'))return Response.json(fixture);
 throw new Error('Unexpected URL');
}};vm.runInNewContext(js,ctx);
(async()=>{for(const [role,expected] of [['owner',200],['other',403],['invalid',401]]){mode=role;const r=await handler(new Request('https://test/functions/v1/eeziness-traffic?days=7',{headers:{origin:'https://www.eeziness.co.za',authorization:'Bearer fixture'}}));assert.equal(r.status,expected);if(expected===200)assert.deepEqual(await r.json(),fixture);}console.log('Collector authorisation: owner permitted; other account and expired token denied (mock Auth responses).');})();
