import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const appPath=path.join(root,'eezicomply','ubo.html');
const samplePath=path.join(root,'eezicomply','sample.html');

function fail(message){
  console.error('FAIL:',message);
  process.exitCode=1;
}
function pass(message){ console.log('PASS:',message); }
function requireMatch(condition,message){
  if(condition) pass(message); else fail(message);
}

if(!fs.existsSync(appPath)){
  fail('eezicomply/ubo.html is missing');
  process.exit(1);
}
const html=fs.readFileSync(appPath,'utf8');

const scriptOpen=html.lastIndexOf('<script>');
const scriptClose=html.lastIndexOf('</script>');
if(scriptOpen<0||scriptClose<=scriptOpen){
  fail('Main inline JavaScript block is missing');
}else{
  const js=html.slice(scriptOpen+8,scriptClose);
  try{
    new Function(js);
    pass('Inline JavaScript parses');
  }catch(error){
    fail('Inline JavaScript syntax error: '+error.message);
  }
}

requireMatch(fs.existsSync(samplePath),'Public sample pack exists');
requireMatch(html.includes('/eezicomply/sample.html'),'UBO app uses the source-controlled sample route');
requireMatch(html.includes('R159'),'R159 pack price is present');
requireMatch(!/R\s?(99|129|149|169)\b/.test(html),'No legacy EeziComply pack prices remain');
requireMatch(!/localhost|127\.0\.0\.1|:3000/.test(html),'No development-host references remain');
requireMatch(!/https:\/\/[^"'\s]*vercel\.app/.test(
  html.replaceAll('https://eezicomply-pilot.vercel.app','')
),'No unintended Vercel deployment URLs are hard-coded');
requireMatch(
  html.includes("emailRedirectTo:'https://eezicomply-pilot.vercel.app'"),
  'Signup callback points to the stable EeziComply production URL'
);
requireMatch(
  html.includes("resetPasswordForEmail(email,{redirectTo:'https://eezicomply-pilot.vercel.app'})"),
  'Password recovery callback points to the stable EeziComply production URL'
);
requireMatch(
  html.includes("PASSWORD_RECOVERY")&&html.includes("updateUser({password:p})"),
  'Password recovery completion flow is present'
);
requireMatch(
  html.includes('Continue to unlock R159 pack'),
  'Step 7 readiness gate is present'
);
requireMatch(
  html.includes('Required signatures complete.'),
  'Step 9 signing gate is present'
);
requireMatch(
  html.includes('Completed filing — read-only record.'),
  'Completed-case read-only lock is present'
);
requireMatch(
  html.includes('An in-progress filing already exists for this company. EeziComply opened it instead of creating a duplicate.'),
  'Duplicate open-filing protection is present'
);
requireMatch(
  html.includes("p.delete('payment')"),
  'Payment return query parameter is consumed once'
);
requireMatch(
  html.includes('Open saved CIPC confirmation'),
  'Completion evidence retrieval is present'
);
requireMatch(
  html.includes('source-controlled-sprint-2026-09-03-1'),
  'Source-controlled sprint release marker is present'
);

if(process.exitCode){
  console.error('\nEeziComply RC gate FAILED.');
}else{
  console.log('\nEeziComply RC gate PASSED.');
}
