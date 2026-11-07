// Starts exactly one local production server, performs unauthenticated checks,
// then stops only the process started here. No provider or database writes.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const portProbe = createServer();
await new Promise(resolve=>portProbe.listen(0,'127.0.0.1',resolve));
const port = portProbe.address().port;
await new Promise(resolve=>portProbe.close(resolve));
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)], {windowsHide:true, stdio:['ignore','pipe','pipe']});
let exited = false;
const exit = once(child,'exit').then(()=>{exited=true;});
child.stdout.resume(); child.stderr.resume();
const base = `http://127.0.0.1:${port}`;
let passed = 0;
async function check(path, status, options = {}, location) {
  const r = await fetch(base+path,{...options,redirect:'manual',signal:AbortSignal.timeout(15000)});
  assert.equal(r.status,status,path);
  if(location) assert.equal(r.headers.get('location'),location,path);
  await r.text(); passed++;
}
try {
  let ready = false;
  for(let i=0;i<100 && !exited;i++) {
    try {const r=await fetch(base+'/explore',{signal:AbortSignal.timeout(1000)}); await r.text(); if(r.ok){ready=true;break;}} catch {}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert(ready,'Production server did not start');
  for(const path of ['/','/explore','/login?next=%2Fdashboard%3Fperspective%3Dclient','/login?next=%2Fdashboard%3Fperspective%3Dfreelancer','/demo','/dashboard','/invitations','/payments']) await check(path,200);
  await check('/judge-access',307,{},'/explore');
  await check('/judge-workspace?perspective=freelancer',307,{},'/dashboard?perspective=freelancer');
  const id='11111111-1111-4111-8111-111111111111';
  await check('/api/payments',401);
  await check(`/api/projects/${id}/archive`,401);
  await check(`/api/projects/${id}/archive`,401,{method:'POST'});
  await check(`/api/projects/${id}/archive`,403,{method:'POST',headers:{Origin:'https://unrelated.example'}});
  for(const endpoint of [`/api/projects/${id}/agreement-draft`,`/api/projects/${id}/submissions/${id}/ai-review`,`/api/projects/${id}/milestones/${id}/invoice`,`/api/projects/${id}/payments/${id}/refresh`]) {
    await check(endpoint,401,{method:'POST'});
    await check(endpoint,403,{method:'POST',headers:{Origin:'https://unrelated.example'}});
  }
  const html=await (await fetch(base+'/explore')).text();
  assert(html.includes('%2Fdashboard%3Fperspective%3Dclient'));
  assert(html.includes('%2Fdashboard%3Fperspective%3Dfreelancer'));
  console.log(JSON.stringify({httpChecks:passed,exploreLinks:'PASS',authenticatedWorkflow:'NOT TESTED',browserVisualQA:'NOT TESTED'}));
} finally {
  if(!exited) child.kill();
  await exit;
  console.log('Owned production server stopped.');
}
