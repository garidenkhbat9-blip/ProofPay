/* Loaded by the supplemental component harness, never by the application. */
const React = load('react');
const params = new URLSearchParams(location.search);
const view = params.get('view') || 'dashboard';
const role = params.get('role') || 'client';
const remote = {};
const writes = [];
const archiveWrites = [], archiveReceipts = new Map();
let archiveMode = 'missing', refreshFails = false, loseArchiveResponse = false;
let archiveState = {available:true,status:'draft',revision:0,archivedAt:null,canArchive:true,canReopen:false,reason:null};
let releasePreference;
const preferenceGate = view === 'verify' ? new Promise(resolve => { releasePreference = resolve; }) : Promise.resolve();
const data = load('src/lib/types').emptyCloud();
const base = {created_by:'client-a',description:'Design and build a clear, responsive website with reusable content sections and accessible navigation.',work_category:'website',budget_amount:2400,currency:'USD',due_date:'2026-12-01',status:'draft',created_at:'2026-11-01'};
if (!params.has('empty')) {
 data.projects.push({...base,id:'p',title:'Brand website refresh'}, {...base,id:'p2',title:'Product launch visuals',work_category:'design',budget_amount:1600,status:'active'});
 data.members.push({project_id:'p',user_id:'client-a',role:'client'}, {project_id:'p2',user_id:'client-a',role:'client'}, {project_id:'p2',user_id:'worker',role:'freelancer'});
 data.profiles.push({id:'client-a',full_name:'Alex Morgan'}, {id:'worker',full_name:'Jamie Chen'});
 data.invitations.push({id:'invite',project_id:'p',project_title:'Brand website refresh',invited_by:'client-a',invited_email:'jamie@example.test',status:'revoked',expires_at:'2099-01-01',created_at:'2026-11-01'});
}
let path = ({detail:'/projects/p',projects:'/projects',agreement:'/projects/p/agreement',delivery:'/projects/p/delivery',reviews:'/reviews',payments:'/payments',activity:'/activity'})[view] || '/dashboard';
const workspace = {user:{id:role === 'client'?'client-a':'worker',email:role === 'client'?'alex@example.test':'jamie@example.test',user_metadata:{}},data,perspective:role,ready:true,loaded:true,loading:false,error:'',authError:'',refresh:async()=>{},refreshChecked:async()=>{
 if(refreshFails)throw Error('Fixture refresh failed');
 Object.assign(data.projects[0],{status:archiveState.status,archive_revision:archiveState.revision});rerender();
},sync:async()=>{},setPerspective:()=>{},notice:()=>{}};
const auth = {getSession:async()=>({data:{session:{user:{id:workspace.user.id},access_token:workspace.user.id}},error:null}),getUser:async(token)=>{await preferenceGate;return {data:{user:{id:token,user_metadata:remote[token]||{}}},error:null};}};
globalThis.fetch = async (_url, init) => {
 if (_url === '/auth/google') { globalThis.authGoogleRequests = (globalThis.authGoogleRequests || 0) + 1; await new Promise(resolve=>setTimeout(resolve,100)); return Response.json({error:'Google sign-in is unavailable. Please try again later.'},{status:503}); }
 if(_url==='/api/payments' && init?.method==='GET')return Response.json({payments:[],history:[],setupError:null,merchantFreelancerId:null,truncated:false});
 if(String(_url).endsWith('/archive')) {
  if(init?.method==='GET')return Response.json(archiveMode==='missing'?{...archiveState,available:false,canArchive:false,canReopen:false,reason:'SETUP_REQUIRED'}:archiveState);
  if(init?.method!=='POST')throw Error('Unexpected archive method');
  const mutation=JSON.parse(init.body);archiveWrites.push(mutation);
  if(archiveMode==='stale')return Response.json({error:{message:'The project changed. Reload its archive eligibility before continuing.'}},{status:409});
  await new Promise(resolve=>setTimeout(resolve,40));
  if(!archiveReceipts.has(mutation.requestId)) {
   const archived=mutation.action==='archive';
   archiveState={...archiveState,status:archived?'archived':'draft',revision:archiveState.revision+1,archivedAt:archived?new Date().toISOString():null,canArchive:!archived,canReopen:archived};
   archiveReceipts.set(mutation.requestId,true);
  }
  if(loseArchiveResponse){loseArchiveResponse=false;throw Error('Fixture lost response. Retry the same request.');}
  return Response.json({...archiveState,confirmed:true});
 }
 if(init?.method!=='PUT')throw Error('Unexpected external request');
 const id = new Headers(init.headers).get('Authorization').slice(7);
 const payload=JSON.parse(init.body); writes.push(payload);
 remote[id]={...remote[id],...payload.data};
 return Response.json({id,user_metadata:remote[id]});
};
modules['src/components/provider']=(module)=>{module.exports={useWorkspace:()=>workspace};};
modules['src/lib/supabase']=(module)=>{module.exports={getSupabase:()=>({auth})};};
modules['next/link']=(module)=>{module.exports={__esModule:true,default:({children,prefetch,replace,scroll,...props})=>React.createElement('a',props,children)};};
modules['next/image']=(module)=>{module.exports={__esModule:true,default:({src,...props})=>React.createElement('img',{...props,src:'../../public'+src})};};
modules['next/navigation']=(module)=>{module.exports={usePathname:()=>path,useSearchParams:()=>new URLSearchParams(),useRouter:()=>({replace:()=>{},push:()=>{}})};};
const {Dashboard,ProjectsPage,ProjectOverview}=load('src/components/projects');
const {WorkspaceShell}=load('src/components/workspace-shell');
const {AgreementPage}=load('src/components/agreement');
const {DeliveryPage,ReviewsPage}=load('src/components/delivery');
const {PaymentWorkspace}=load('src/components/payments');
const {ActivityPage}=load('src/components/account');
const {tourPreferenceKey}=load('src/lib/guided-tour');
const root=load('react-dom/client').createRoot(document.getElementById('fixture-root'));
let generation=0;
let rendered={component:Dashboard,props:{}};
function rerender(){root.render(React.createElement(WorkspaceShell,{key:generation},React.createElement(rendered.component,rendered.props)));}
function render(component=Dashboard,props={}) {rendered={component,props};++generation;rerender();}
// Wait for layout as well as React's queued update. Virtual headless time can
// advance timers before requestAnimationFrame has positioned the spotlight.
const wait=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,20))));
async function until(predicate) {for(let i=0;i<80;i++){if(predicate())return;await wait();}throw Error('Timed out waiting for UI');}
const assert=(ok,message)=>{if(!ok)throw Error(message);};
function button(text) {return [...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);}
async function run() {
 localStorage.clear();
 if (view === 'login' || view === 'signup') {
  workspace.user = null; path = '/' + view;
  root.render(React.createElement(load('src/components/auth-form').AuthForm,{mode:view}));
  return;
 }
 if (!['tour','verify'].includes(view)) remote[workspace.user.id]={[tourPreferenceKey(role)]:{status:'completed',version:1,recorded_at:new Date().toISOString()}};
 const views={detail:ProjectOverview,projects:ProjectsPage,agreement:AgreementPage,delivery:DeliveryPage,reviews:ReviewsPage,payments:PaymentWorkspace,activity:ActivityPage};
 render(views[view]||Dashboard,['detail','agreement','delivery'].includes(view)?{id:'p'}:{});
 if(view!=='verify')return;
 const results=[];
 const check=(name,ok)=>{assert(ok,name);results.push(name);};
 await until(()=>document.getElementById('workspace-main'));
 const menu=document.querySelector('.mobiletoggle');
 if(menu?.checkVisibility({visibilityProperty:true})) {
  menu.click();await until(()=>document.getElementById('workspace-navigation').getAttribute('aria-modal')==='true');
  releasePreference();await wait();await wait();
  check('Tour waits while mobile navigation is open',!document.querySelector('.guided-tour'));
  document.querySelector('[aria-label="Close menu"]').click();
 } else releasePreference();
 await until(()=>document.querySelector('.guided-tour:modal .tour-popover')?.checkVisibility({visibilityProperty:true}));
 check('No permanent Quick tour button',!button('Quick tour'));
 check('Native modal isolates background actions',!!document.querySelector('.guided-tour:modal'));
 check('Initial heading receives focus',document.activeElement?.tagName==='H2');
 check('No persistence before user dismissal',writes.length===0 && localStorage.length===0);
 const initialBounds=document.querySelector('.tour-popover').getBoundingClientRect();
 const dialogBounds=document.querySelector('.guided-tour').getBoundingClientRect();
 check('Initial popover fits inside the dialog without scrollbar clipping',initialBounds.left>=dialogBounds.left && initialBounds.right<=dialogBounds.right && initialBounds.top>=dialogBounds.top && initialBounds.bottom<=dialogBounds.bottom);
 button('Next').click(); await wait();
 const target=menu?.checkVisibility({visibilityProperty:true})?menu:document.querySelector('[data-tour="projects"]');
 let hole=document.querySelector('mask rect[fill="black"]');
 check('Spotlight moves to real Projects target',Math.abs(Number(hole.getAttribute('x'))-target.getBoundingClientRect().left)<8);
 target.style.display='none'; await wait();
 check('Hidden target clears stale spotlight',!document.querySelector('mask rect[fill="black"]'));
 check('Missing target is explained',!!document.querySelector('.tour-unavailable'));
 target.style.display=''; await wait();
 check('Remounted target is highlighted again',!!document.querySelector('mask rect[fill="black"]'));
 button('Back').click(); await wait();
 check('Back returns to step one',document.querySelector('.tour-meta').textContent.includes('1 of'));
 for(let i=0;i<5;i++){
  button('Next').click();await wait();
  const bounds=document.querySelector('.tour-popover').getBoundingClientRect();
  check(`Step ${i+2} fits inside the dialog`,bounds.left>=dialogBounds.left && bounds.right<=dialogBounds.right && bounds.top>=dialogBounds.top && bounds.bottom<=dialogBounds.bottom);
 }
 check('Finish has not yet persisted completion',writes.length===0);
 const bounds=document.querySelector('.tour-popover').getBoundingClientRect();
 check('Popover stays within viewport',bounds.left>=0 && bounds.right<=innerWidth && bounds.top>=0 && bounds.bottom<=innerHeight);
 button('Finish').click(); await until(()=>!document.querySelector('.guided-tour'));
 check('Finish persists exactly once',writes.length===1 && remote['client-a'][tourPreferenceKey('client')].status==='completed');
 localStorage.clear();render();await wait();await wait();
 check('New session honors remote completion',!document.querySelector('.guided-tour'));
 check('Dashboard has no duplicate horizontal navigation',!document.querySelector('.dashboard-shortcuts'));
 const action=document.querySelector('.project-action-trigger');action.click();await wait();
 check('Context actions are available to owner',!!button('Archive project'));
 button('Archive project').click();await until(()=>!!button('Archive unavailable'));
 check('Retention dialog names the project',document.querySelector('dialog').textContent.includes('Brand website refresh'));
 check('Unapproved lifecycle action remains disabled',button('Archive unavailable')?.disabled);
 check('No destructive or financial request sent',writes.length===1);
 button('Close').click();await wait();
 check('Closing retention dialog restores focus',document.activeElement===action);
 workspace.user={id:'client-b',email:'other@example.test',user_metadata:{}};render();
 await until(()=>document.querySelector('.guided-tour:modal .tour-popover')?.checkVisibility({visibilityProperty:true}));
 check('Other account gets its own tour',!!document.querySelector('.guided-tour'));
 button('Skip').click();await until(()=>!document.querySelector('.guided-tour'));
 check('Skip persists for the correct account',remote['client-b'][tourPreferenceKey('client')].status==='skipped');
 workspace.user={id:'worker',email:'jamie@example.test',user_metadata:{}};workspace.perspective='freelancer';render();
 await until(()=>document.querySelector('.guided-tour:modal .tour-popover')?.checkVisibility({visibilityProperty:true}));
 check('Freelancer uses five role-specific steps',document.querySelector('.tour-meta').textContent.includes('1 of 5'));
 check('Freelancer has no create or delete controls',!document.querySelector('[data-tour="new-project"]') && !document.querySelector('.project-action-trigger'));
 button('Skip').click();await until(()=>!document.querySelector('.guided-tour'));
 workspace.user={id:'client-a',email:'alex@example.test',user_metadata:{}};workspace.perspective='client';path='/projects/p';
 archiveMode='ready';render(ProjectOverview,{id:'p'});await wait();
 const openArchive=async(label)=>{document.querySelector('.project-action-trigger').click();await wait();button(label).click();await until(()=>!!document.querySelector('dialog .primary:not(:disabled)'));};
 await openArchive('Archive project');refreshFails=true;
 const confirm=button('Archive project');confirm.click();confirm.click();
 await until(()=>document.querySelector('dialog')?.textContent.includes('Request recorded.'));
 check('Double click sends one archive request',archiveWrites.length===1);
 check('Confirmed archive survives refresh failure',!!button('Refresh workspace') && !button('Archive project'));
 refreshFails=false;button('Refresh workspace').click();await until(()=>!document.querySelector('dialog'));
 check('Refresh applies actual archived status',data.projects[0].status==='archived');
 await openArchive('Reopen project');button('Reopen project').click();await until(()=>!document.querySelector('dialog'));
 check('Reopen refreshes real fixture state',data.projects[0].status==='draft' && archiveWrites.length===2);
 archiveMode='stale';await openArchive('Archive project');button('Archive project').click();await until(()=>document.querySelector('.formerror'));
 check('Stale server rejection is explained',document.querySelector('.formerror').textContent.includes('project changed'));
 button('Close').click();await wait();archiveMode='ready';
 await openArchive('Archive project');loseArchiveResponse=true;button('Archive project').click();await until(()=>document.querySelector('.formerror'));
 button('Archive project').click();await until(()=>!document.querySelector('dialog'));
 check('Lost response retries the same request ID',archiveWrites.at(-1).requestId===archiveWrites.at(-2).requestId && archiveReceipts.size===3);
 await openArchive('Reopen project');button('Reopen project').click();await until(()=>!document.querySelector('dialog'));
 path='/projects/p/agreement';render(AgreementPage,{id:'p'});await wait();
 check('Unassigned project offers an explicit agreement draft',!!button('Create agreement draft') && document.body.textContent.includes('previous invitation was revoked'));
 check('Invite CTA targets project team',!!document.querySelector('a[href="/projects/p#project-team"]'));
 check('Project tabs preserve their destinations',document.querySelector('.projecttabs a[aria-current="page"]')?.getAttribute('href')==='/projects/p/agreement' && !!document.querySelector('.projecttabs a[href="/projects/p/delivery"]'));
 button('Create agreement draft').click();await wait();check('Draft action opens the real editor',!!document.querySelector('dialog form'));
 document.querySelector('[aria-label="Close dialog"]').click();await wait();
 path='/projects/p/delivery';render(DeliveryPage,{id:'p'});await wait();
 check('Delivery empty state explains team prerequisite',document.querySelector('.workflow-empty')?.textContent.includes('Invite a freelancer to continue.'));
 for(const [component,title,pageTitle] of [[ReviewsPage,'No work awaiting review.','Review inbox'],[PaymentWorkspace,'No invoices yet.','Payments'],[ActivityPage,'No activity recorded yet.','Activity']]) {
  path='/'+(component===ReviewsPage?'reviews':component===PaymentWorkspace?'payments':'activity');render(component);
  await until(()=>document.querySelector('h1')?.textContent===pageTitle && document.querySelector('.workflow-empty'));
  check(title,document.querySelector('.workflow-empty').textContent.includes(title));
  check('Empty state links to projects',!!document.querySelector('.workflow-empty a[href="/projects"]'));
 }
 const report=document.createElement('pre');report.id='browser-results';report.textContent=JSON.stringify({passed:results.length,failed:0,results});document.body.append(report);
}
run().catch(error=>{const report=document.createElement('pre');report.id='browser-results';report.textContent=JSON.stringify({failed:1,error:String(error),stack:error.stack});document.body.append(report);});
