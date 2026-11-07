import { readdir, readFile } from 'node:fs/promises';
const names=['SUPABASE_SECRET_KEY','GEMINI_API_KEY','PAYPAL_CLIENT_SECRET','BROWSERLESS_API_TOKEN'];
const values=names.map(name=>process.env[name]).filter(value=>value && value.length>10);
let checked=0, matches=0;
async function scan(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const path=dir+'/'+entry.name;
    if(entry.isDirectory()) await scan(path);
    else if(/\.(js|map|json|html|css)$/.test(entry.name)) {
      const content=await readFile(path,'utf8'); checked++;
      if(values.some(value=>content.includes(value))) matches++;
    }
  }
}
await scan('.next/static');
console.log(JSON.stringify({scope:'built client static files only',checked,configuredSecrets:values.length,filesContainingPrivateValues:matches,status:matches?'FAIL':'PASS'}));
if(matches) process.exitCode=1;
