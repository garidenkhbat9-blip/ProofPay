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
if (params.has('clientState')) {
 const state=params.get('clientState');
 if(state==='archived') data.projects.forEach(p=>p.status='archived');
 if(state==='unavailable') { data.agreementError='Unavailable'; data.paymentError='Unavailable'; }
 if(state==='long') data.projects[0].title='A very long international project title with deliverables across multiple teams and a detailed agreement';
 if(state==='review') {
  data.members.push({project_id:'p',user_id:'worker',role:'freelancer'});
  data.agreements.push({id:'a',project_id:'p',version:1,scope:'Site content',change_note:'',created_at:'2026-01-01'});
  data.milestones.push({id:'m',agreement_id:'a',position:1,title:'Content delivery',description:'',amount:2400,due_date:'2099-01-01'});
  data.criteria.push({id:'c',milestone_id:'m',position:1,description:'Provide reviewed site copy'});
  data.approvals.push({agreement_id:'a',user_id:'client-a',role:'client',approved_at:'2026-01-01'},{agreement_id:'a',user_id:'worker',role:'freelancer',approved_at:'2026-01-01'});
  data.links.push({id:'l',project_id:'p',milestone_id:'m',freelancer_id:'worker',active:true,instructions:'',expires_at:'2099-01-01',created_at:'2026-01-01'});
  data.submissions.push({id:'s',project_id:'p',milestone_id:'m',link_id:'l',submitted_by:'worker',revision:1,status:'submitted',notes:'Site copy is ready for review.',created_at:'2026-01-01',submitted_at:'2026-01-01'});
 }
}
if (params.get('workerState') === 'changes' && data.submissions[0]) { data.submissions[0].status='changes'; data.reviews.push({id:'review',submission_id:data.submissions[0].id,reviewed_by:'client-a',decision:'changes',note:'Please update the introduction.',confirmed_criteria:[],created_at:'2026-11-07'}); }
let invitationAccepts=0, invitationRefreshes=0;
let path = ({demopayment:'/payments/demo',invitations:'/invitations',detail:'/projects/p',projects:'/projects',agreement:'/projects/p/agreement',delivery:'/projects/p/delivery',reviews:'/reviews',payments:'/payments',activity:'/activity'})[view] || '/dashboard';
const workspace = {user:{id:role === 'client'?'client-a':'worker',email:role === 'client'?'alex@example.test':'jamie@example.test',email_confirmed_at:'2026-01-01',user_metadata:{}},data,perspective:role,ready:true,loaded:true,loading:false,error:'',authError:'',refresh:async()=>{},refreshChecked:async()=>{
 if(refreshFails)throw Error('Fixture refresh failed');
 if(view==='invitations'){invitationRefreshes++;rerender();return;}
 Object.assign(data.projects[0],{status:archiveState.status,archive_revision:archiveState.revision});rerender();
},sync:async()=>{},setPerspective:()=>{},notice:()=>{}};
if (params.has('invitations')) {
 for (let i=0;i<Number(params.get('invitations'));i++) data.invitations.push({id:'incoming-'+i,project_id:'incoming-project',project_title:'Incoming project',invited_by:'another-client',invited_email:workspace.user.email,status:'pending',expires_at:'2099-01-01',created_at:'2026-11-07'});
}
let demoForbiddenCalls=[], demoRedirect='';
if(view==='demopayment' && !params.has('empty'))data.payments.push({id:'existing-payment',project_id:'p',milestone_id:'m',agreement_id:'a',submission_id:'s',status:'UNPAID',last_verified_at:null,reconciliation_status:'pending'});
if(view==='demopayment' && params.has('signedout'))workspace.user=null;
if(view==='demopayment' && params.has('cloudFailure')){workspace.loaded=false;workspace.loading=true;workspace.error='Fixture storage unavailable';}
const auth = {getSession:async()=>({data:{session:{user:{id:workspace.user.id},access_token:workspace.user.id}},error:null}),getUser:async(token)=>{await preferenceGate;const id=token||workspace.user?.id;return {data:{user:{id,email_confirmed_at:'confirmed',user_metadata:remote[id]||{}}},error:null};}};
let aiCalls=0, reviewWrites=[];
if(params.has('wait')) {
 const state=params.get('wait');
 data.milestones[0].due_date='2026-11-01';
 if(state==='delivery')data.submissions=[];
 if(state==='revision'||state==='payment') {data.submissions[0].status=state==='revision'?'changes':'approved';data.reviews.push({id:'waiting-review',submission_id:'s',reviewed_by:'client-a',decision:data.submissions[0].status,note:'Please include the final copy.',confirmed_criteria:[],created_at:'2026-11-05T10:00:00Z'});}
 if(state==='invitation'||state==='expired') {data.members=data.members.filter(m=>m.project_id!=='p'||m.role!=='freelancer');data.invitations.push({id:'pending-wait',project_id:'p',project_title:'Brand website refresh',invited_by:'client-a',invited_email:'jamie@example.test',status:'pending',created_at:'2026-11-01T10:00:00Z',expires_at:state==='expired'?'2026-11-02':'2099-01-01'});}
 if(state==='agreement')data.approvals=data.approvals.filter(a=>a.role!=='freelancer');
 if(state==='mixed') {data.milestones.push({...data.milestones[0],id:'m2',position:2,title:'Responsive handoff with a deliberately long milestone name for narrow screens'});data.links.push({...data.links[0],id:'l2',milestone_id:'m2'});}
 if(state==='access')data.links[0].active=false;
}
if(params.has('ai')) {
 data.criteria.push({id:'c2',milestone_id:'m',position:2,description:'Include a Figma design link'},{id:'c3',milestone_id:'m',position:3,description:'Provide desktop and mobile layouts with readable navigation and accessible contrast'});
 data.artifacts.push({id:'copy',submission_id:'s',kind:'file',label:'Site-copy.md',size_bytes:120,storage_path:'s/copy',url:null},{id:'image',submission_id:'s',kind:'file',label:'Desktop-preview.png',size_bytes:1200,storage_path:'s/image',url:null},{id:'pdf',submission_id:'s',kind:'file',label:'Delivery-brief.pdf',size_bytes:2400,storage_path:'s/pdf',url:null});
 if(params.get('ai')==='long')data.criteria[0].description='Provide reviewed site copy with an unusually long requirement covering international editorial guidelines, detailed contact information and accessible plain-language headings for every audience and device.';
 if(params.get('ai')==='freelancer') {data.submissions[0].status='changes'; data.reviews.push({id:'r',submission_id:'s',decision:'changes',note:'Please include the Figma link.',confirmed_criteria:[],created_at:'2026-11-08'});}
}
globalThis.fetch = async (_url, init) => {
 if(view==='demopayment'){demoForbiddenCalls.push(String(_url));throw Error('Demo must not call any network endpoint');}
 if(String(_url).endsWith('/ai-review')) {
  aiCalls++; await new Promise(resolve=>setTimeout(resolve,100));
  if(params.get('ai')==='failure')return Response.json({error:'AI timed out. No saved work has changed. Try again.'},{status:503});
  return Response.json({projectId:'p',milestoneId:'m',agreementId:'a',agreementVersion:1,submissionId:'s',revision:1,model:'mock-provider',generatedAt:'2026-11-08T00:00:00Z',promptVersion:'evidence-text-v2',summary:'Site copy is present. The Figma link is missing and visual layouts need your inspection.',sources:[{id:'copy',label:'Site-copy.md',characters:120,sha256:'a'.repeat(64)},{id:'submission-notes',label:'Submission notes (author claims)',characters:30,sha256:'b'.repeat(64)}],unread:[{id:'image',label:'Desktop-preview.png',reason:'Image content not checked'},{id:'pdf',label:'Delivery-brief.pdf',reason:'PDF content not checked'}],observations:data.criteria.filter(c=>c.milestone_id==='m').map((c,i)=>({criterionId:c.id,status:['SUPPORTS','MISSING','NOT_CHECKED'][i],observation:['The uploaded copy contains the requested text.','No Figma link was submitted.','Image contents are not inspected.'][i],evidenceIds:i===0?['copy']:i===2?['image']:[],limitations:['Text analysis only; inspect the original evidence.'],citations:i===0?[{sourceId:'copy',quote:'Welcome to our studio.'}]:[],missingEvidence:i===1?'Figma link missing':'',questions:[]}))});
 }
 if (_url === '/auth/google') { globalThis.authGoogleIntent=JSON.parse(init.body).intent; globalThis.authGoogleRequests = (globalThis.authGoogleRequests || 0) + 1; await new Promise(resolve=>setTimeout(resolve,100)); return Response.json({error:'Google sign-in is unavailable. Please try again later.'},{status:503}); }
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
modules['src/lib/supabase']=(module)=>{module.exports={getSupabase:()=>{if(view==='demopayment'){demoForbiddenCalls.push('supabase');throw Error('Demo must not call Supabase');}return ({auth,rpc:async(name,args)=>{if(params.has('ai')&&name==='review_evidence'){reviewWrites.push(args);return {data:null,error:null};}if(view!=='invitations'||name!=='accept_project_invitation')throw Error('Unexpected fixture RPC');const item=data.invitations.find(i=>i.id===args.p_invitation_id);if(!item||item.invited_email!==workspace.user.email)return {data:null,error:{code:'42501'}};invitationAccepts++;item.status='accepted';return {data:item.project_id,error:null};}});}};};
modules['next/link']=(module)=>{module.exports={__esModule:true,default:({children,prefetch,replace,scroll,...props})=>React.createElement('a',props,children)};};
modules['next/image']=(module)=>{module.exports={__esModule:true,default:({src,...props})=>React.createElement('img',{...props,src:'../../public'+src})};};
modules['next/navigation']=(module)=>{module.exports={usePathname:()=>path,useSearchParams:()=>new URLSearchParams({...Object.fromEntries(['phase','handoff','version'].filter(k=>params.has(k)).map(k=>[k,params.get(k)])),...(params.has('intent')?{next:'/dashboard?perspective='+params.get('intent')}:{})}),useRouter:()=>({replace:(url)=>{demoRedirect=url;},push:()=>{}})};};
const {Dashboard,ProjectsPage,ProjectOverview,InvitationsPage}=load('src/components/projects');
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
 if (view === 'onboarding') {
  root.render(React.createElement(load('src/app/auth/workspace/page').default)); return;
 }
 if (view === 'login' || view === 'signup') {
  workspace.user = null; path = '/' + view;
  root.render(React.createElement(load('src/components/auth-form').AuthForm,{mode:view}));
  return;
 }
 if (workspace.user && !['tour','verify'].includes(view)) remote[workspace.user.id]={[tourPreferenceKey(role)]:{status:'completed',version:1,recorded_at:new Date().toISOString()}};
 const views={demopayment:load('src/components/demo-payment').DemoPaymentPage,invitations:InvitationsPage,detail:ProjectOverview,projects:ProjectsPage,agreement:AgreementPage,delivery:DeliveryPage,reviews:ReviewsPage,payments:PaymentWorkspace,activity:ActivityPage};
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
 check('Legacy agreement reconnects to four-phase workspace',document.querySelectorAll('.project-phase-nav a').length===4 && document.querySelector('.project-phase-nav a[aria-current="page"]')?.getAttribute('href')==='/projects/p?phase=setup' && !!document.querySelector('.project-phase-nav a[href="/projects/p?phase=deliver"]'));
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
