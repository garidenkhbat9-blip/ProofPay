import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const artifacts = resolve('.validation/client-experience');
const fixture = pathToFileURL(join(artifacts, 'preview.html')).href;
const chrome = process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';

test('client workspace components: desktop/mobile tour, actions and responsive layouts', { timeout: 120000, skip: process.platform !== 'win32' || !existsSync(chrome) ? 'Component fixture builder requires Windows and Chrome; unit tests still run.' : false }, async () => {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/preview-client-experience.ps1'], { stdio: 'pipe', windowsHide: true });
  const profile = await mkdtemp(join(artifacts, 'cdp-profile-'));
  const fixtureFlags = process.env.PROOFPAY_FIXTURE_NO_SANDBOX === '1' ? ['--no-sandbox', '--disable-features=RendererCodeIntegrity'] : [];
  const browser = spawn(chrome, ['--headless=new', ...fixtureFlags, '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--allow-file-access-from-files', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  let stderr = '';
  browser.stderr.on('data', chunk => { stderr += chunk; });
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch {}
      if (port) break;
      if (browser.exitCode !== null) throw Error(`Chrome exited: ${stderr.slice(-1000)}`);
      await delay(100);
    }
    assert(port, `Chrome did not start: ${stderr.slice(-1000)}`);
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = tabs.find(tab => tab.type === 'page');
    assert(page);
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let nextId = 0;
    const pending = new Map();
    const browserErrors = [];
    socket.onmessage = ({ data }) => {
      const response = JSON.parse(data);
      if (response.method === 'Runtime.exceptionThrown') browserErrors.push(response.params.exceptionDetails.text);
      if (response.method === 'Runtime.consoleAPICalled' && response.params.type === 'error') browserErrors.push(response.params.args.map(arg => arg.value || arg.description).join(' '));
      const request = pending.get(response.id);
      if (!request) return;
      pending.delete(response.id);
      clearTimeout(request.timer);
      response.error ? request.reject(Error(JSON.stringify(response.error))) : request.resolve(response.result);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 10000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }).catch(error => { throw Error(`${error.message}: ${expression}`); });
      assert(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    const waitFor = async expression => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await delay(60);
      }
      throw Error(`UI timeout: ${expression}`);
    };
    await send('Runtime.enable');
    const cases = [
      ...[1024,768].map(width=>[`public-home-${width}`,'view=home',width,1100]),
      ...['home','explore','product','how','faq'].flatMap(view=>[1440,390,320].map(width=>[`public-${view}-${width}`,`view=${view}`,width,1100])),
      ['account-client','view=dashboard',1440,1000],
      ['account-freelancer','view=dashboard&role=freelancer',390,844],
      ['account-sidebar-mobile','view=dashboard',320,740],
      ['account-signout-error','view=dashboard&signOutFailure=1',1440,1000],
      ['login-otp-client','view=login&otp=1&intent=client',1440,1100],
      ['login-otp-freelancer','view=login&otp=1&intent=freelancer',390,1100],
      ...[1440,1024,768,390,320].map(width=>[`demo-${width}`,width===1440?'view=demopayment':'view=demopayment&empty=1',width,1200]),
      ...['ready','invoice','pending','failure','cancelled'].map(state=>[`demo-${state}`,`view=demopayment&empty=1&demoState=${state}`,state==='failure'?390:1440,1200]),
      ['demo-cloud-failure','view=demopayment&empty=1&cloudFailure=1',390,1200],
      ['demo-signedout','view=demopayment&signedout=1',390,1000],
      ...[1440,1024,768,390,320].map(width=>[`waiting-${width}`, 'view=detail&clientState=review&role=freelancer&phase=review&wait=review', width, 1100]),
      ...['delivery','revision','payment','invitation','expired','agreement','mixed','access'].map(state=>[`waiting-${state}`,`view=detail&clientState=review&phase=review&wait=${state}`,state==='mixed'?320:1440,1100]),
      ...[1440,1024,768,390,320].map(width=>[`ai-${width}`, 'view=detail&clientState=review&phase=review&handoff=l&ai=results', width, 1200]),
      ['ai-empty','view=detail&clientState=review&phase=review&handoff=l&ai=empty',1440,1200],
      ['ai-failure','view=detail&clientState=review&phase=review&handoff=l&ai=failure',390,1200],
      ['ai-loading','view=detail&clientState=review&phase=review&handoff=l&ai=loading',390,1200],
      ['ai-long','view=detail&clientState=review&phase=review&handoff=l&ai=long',320,1200],
      ['ai-freelancer','view=detail&clientState=review&phase=review&handoff=l&role=freelancer&ai=freelancer',390,1200],
      ['ai-history','view=detail&clientState=review&phase=review&handoff=l&ai=history',1440,1200],
      ['ai-decision','view=detail&clientState=review&phase=review&handoff=l&ai=decision',1440,1200],
      ['workspace-setup', 'view=detail&phase=setup', 1440, 1100],
      ['workspace-agreement-desktop','view=detail&phase=setup&agreementSetup=1',1440,1100],
      ['workspace-agreement-mobile','view=detail&phase=setup&agreementSetup=1',390,1100],
      ['payments-mobile','view=payments',390,1100],
      ['workspace-review', 'view=detail&clientState=review&phase=review&handoff=l', 1440, 1100],
      ['workspace-tablet', 'view=detail&role=freelancer&clientState=review&phase=review', 768, 1100],
      ['workspace-deliver', 'view=detail&role=freelancer&clientState=review&workerState=changes&phase=deliver&handoff=l', 390, 1100],
      ['workspace-payment', 'view=detail&clientState=review&phase=payment', 320, 1100],
      ['workspace-history', 'view=detail&clientState=review&phase=setup&version=a', 1024, 1100],
      ['worker-desktop', 'view=dashboard&role=freelancer&clientState=review', 1440, 1100],
      ['worker-laptop', 'view=dashboard&role=freelancer&clientState=review&workerState=changes', 1024, 1000],
      ['worker-tablet', 'view=dashboard&role=freelancer&clientState=review', 768, 1100],
      ['worker-mobile', 'view=dashboard&role=freelancer&clientState=review&workerState=changes', 390, 1100],
      ['worker-narrow', 'view=projects&role=freelancer&clientState=review', 320, 1100],
      ['worker-empty', 'view=dashboard&role=freelancer&empty=1', 390, 1000],
      ['worker-invitations', 'view=invitations&role=freelancer&invitations=2', 390, 1000],
      ['client-desktop', 'view=dashboard&clientState=review', 1440, 1100],
      ['client-laptop', 'view=dashboard&clientState=review', 1024, 1000],
      ['client-tablet', 'view=dashboard&clientState=review', 768, 1100],
      ['client-mobile', 'view=dashboard&clientState=review', 390, 1100],
      ['client-narrow', 'view=dashboard&clientState=long', 320, 1100],
      ['client-empty', 'view=dashboard&empty=1&clientState=empty', 390, 1100],
      ['client-archived', 'view=dashboard&clientState=archived', 1440, 1000],
      ['client-unavailable', 'view=dashboard&clientState=unavailable', 390, 1100],
      ['notifications-desktop', 'view=dashboard&role=freelancer&invitations=2', 1440, 1000],
      ['notifications-mobile', 'view=dashboard&role=freelancer&invitations=2', 390, 900],
      ['notifications-client', 'view=dashboard&invitations=2', 1440, 1000],
      ['onboarding-desktop', 'view=onboarding', 1440, 1000],
      ['onboarding-mobile', 'view=onboarding', 390, 900],
      ['onboarding-narrow', 'view=onboarding', 320, 900],
      ['login-client-intent', 'view=login&intent=client', 1440, 1000],
      ['login-freelancer-intent', 'view=login&intent=freelancer', 390, 900],
      ['signup-freelancer-intent', 'view=signup&intent=freelancer', 390, 1000],
      ['login-desktop', 'view=login', 1440, 1000],
      ['signup-desktop', 'view=signup', 1440, 1100],
      ['login-mobile', 'view=login', 390, 900],
      ['signup-mobile', 'view=signup', 390, 1000],
      ['login-narrow', 'view=login', 320, 900],
      ['signup-narrow', 'view=signup', 320, 1000],
      ['verify-desktop', 'view=verify', 1440, 1000],
      ['verify-mobile', 'view=verify', 390, 844],
      ['verify-narrow', 'view=verify', 320, 568],
      ['dashboard-desktop', 'view=dashboard', 1440, 1100],
      ['detail-desktop', 'view=detail', 1440, 1100],
      ['detail-mobile', 'view=detail', 390, 1100],
      ['projects-tablet', 'view=projects', 768, 1100],
      ['empty-mobile', 'view=dashboard&empty=1', 390, 1100],
      ['agreement-mobile', 'view=agreement', 390, 1100],
      ['delivery-mobile', 'view=delivery', 390, 844],
      ['payments-desktop', 'view=payments&empty=1', 1440, 1000],
      ['activity-mobile', 'view=activity&empty=1', 390, 844],
      ['tour-mobile', 'view=tour', 390, 844],
      ['tour-narrow', 'view=tour', 320, 568],
      ['tour-landscape', 'view=tour', 568, 320],
    ];
    const results = [];
    for (const [name, query, width, height] of cases) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: `${fixture}?${query}&case=${name}` });
      if(name.startsWith('public-')) {
        await waitFor(`location.search.includes('case=${name}') && !!document.querySelector('.pp-brand') && !!document.querySelector('h1')`);
        await evaluate('document.fonts.ready');
        await delay(750);
        assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),`${name}: horizontal overflow`);
        assert(await evaluate(`[...document.querySelectorAll('.pp-brand-icon img')].every(img=>img.complete && img.naturalWidth>0)`));
        assert.equal(await evaluate(`document.querySelectorAll('h1').length`),1);
        if(name.includes('explore')) {
          const destinations=await evaluate(`[...document.querySelectorAll('.judge-choice')].map(a=>a.getAttribute('href'))`);
          assert.deepEqual(destinations,['/login?next=%2Fdashboard%3Fperspective%3Dclient','/login?next=%2Fdashboard%3Fperspective%3Dfreelancer']);
        }
        if(name.includes('home')) {
          assert.equal(await evaluate(`document.querySelector('.herobuttons a').getAttribute('href')`),'/explore');
          assert(await evaluate(`document.querySelector('.hero-scene').textContent.includes('Not run') && document.querySelector('.hero-scene figcaption').textContent.includes('Example workspace')`));
        }
        const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(join(artifacts,`${name}.png`),Buffer.from(shot.data,'base64'));
        if(name.includes('home')) {
          await evaluate(`document.querySelector('.hero-scene').scrollIntoView({block:'center'})`);
          await delay(100);
          const visibleText=await evaluate(`Array.from(document.querySelectorAll('.hero-preview-heading h2,.hero-preview-row strong,.hero-preview-row > span,.hero-preview-footer')).map(el=>{const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {text:el.textContent,visible:el.contains(top)||top===el};})`);
          assert(visibleText.every(item=>item.visible),name+': obscured hero text '+JSON.stringify(visibleText.filter(item=>!item.visible)));
          const scene=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
          await writeFile(join(artifacts,`hero-scene-${width}.png`),Buffer.from(scene.data,'base64'));
        }
        if(name==='public-home-1440') {
          await evaluate(`document.querySelector('.featuresection').scrollIntoView()`);await delay(350);
          const section=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
          await writeFile(join(artifacts,'home-features.png'),Buffer.from(section.data,'base64'));
          await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
          assert.equal(await evaluate(`getComputedStyle(document.querySelector('.showhero h1')).animationName`),'none');
          await send('Emulation.setEmulatedMedia',{features:[]});
        }
        assert.equal(browserErrors.length,0,browserErrors.join('\n'));
        results.push({name,overflow:false,logo:'loaded',navigation:'preserved'});continue;
      }
      const authCase = name.startsWith('login') || name.startsWith('signup');
      if(name==='demo-signedout') {
        await waitFor(`location.search.includes('case=${name}') && typeof demoRedirect !== 'undefined' && demoRedirect.startsWith('/login?next=')`);
        assert.equal(await evaluate('demoRedirect'),'/login?next='+encodeURIComponent('/payments/demo'+new URL(`${fixture}?${query}&case=${name}`).search));
        assert(await evaluate(`!document.querySelector('.demo-payment')`));
        assert.equal(await evaluate('demoForbiddenCalls.length'),0);
        results.push({name,authentication:'existing login redirect; no demo controls'});continue;
      }
      await waitFor(`location.search.includes('case=${name}') && !!document.querySelector('${authCase ? '.authcard .google-auth-button' : name.startsWith('onboarding') ? '.workspace-options' : '#workspace-main'}')`);
      if(name.startsWith('account-')) {
        if(name==='account-sidebar-mobile') {
          await evaluate(`document.querySelector('.mobiletoggle').click()`);
          await waitFor(`document.querySelector('.sidebar').getAttribute('aria-modal')==='true'`);
        }
        const selector=name==='account-sidebar-mobile'?'.sidebar .account-trigger':'.topbar .account-trigger';
        await evaluate(`document.querySelector('${selector}').focus()`);
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
        await waitFor(`!!document.querySelector('[role="menu"]')`);
        assert.equal(await evaluate(`document.activeElement.textContent`),'Account / Profile');
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});
        assert.equal(await evaluate('document.activeElement.textContent'),'Sign out');
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
        assert.equal(await evaluate('document.activeElement.textContent'),'Account / Profile');
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await waitFor(`!document.querySelector('[role="menu"]')`);
        assert(await evaluate(`document.activeElement===document.querySelector('${selector}')`));
        if(name==='account-sidebar-mobile') {
          assert.equal(await evaluate(`document.querySelector('.sidebar').getAttribute('aria-modal')`),'true');
          await waitFor(`(()=>{const el=document.querySelector('.workspace-close'),r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))})()`);
        }
        await evaluate(`document.querySelector('${selector}').click()`);
        await waitFor(`!!document.querySelector('[role="menu"]')`);
        await evaluate(`document.querySelector('.pp-brand').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
        await waitFor(`!document.querySelector('[role="menu"]')`);
        await evaluate(`document.querySelector('${selector}').click()`);
        await waitFor(`!!document.querySelector('[role="menu"]')`);
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
        await waitFor(`!document.querySelector('[role="menu"]')`);
        await evaluate(`document.querySelector('${selector}').click()`);
        await waitFor(`!!document.querySelector('[role="menu"]')`);
        assert.equal(await evaluate(`document.querySelector('[role="menuitem"]').getAttribute('href')`),'/settings#profile');
        await delay(200);
        assert(await evaluate(`(()=>{const r=document.querySelector('.account-popover').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight})()`),`${name}: menu outside viewport`);
        const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(join(artifacts,`${name}.png`),Buffer.from(shot.data,'base64'));
        await evaluate(`document.querySelector('[role="menu"] button').click();document.querySelector('[role="menu"] button')?.click()`);
        await waitFor('signOutCalls===1');
        if(name==='account-signout-error') await waitFor(`!!document.querySelector('.account-popover [role="alert"]')`);
        else await waitFor(`!document.querySelector('[role="menu"]')`);
        assert.equal(await evaluate('signOutCalls'),1);
        assert.equal(browserErrors.length,0,browserErrors.join('\n'));
        results.push({name,keyboard:true,outside:true,signOutCalls:1});continue;
      }
      if(name.startsWith('login-otp')) {
        await evaluate(`button('Sign in without a password').click()`);
        await waitFor(`!!document.querySelector('#reviewer-email')`);
        await evaluate(`document.querySelector('#reviewer-email').value='reviewer@example.test';document.querySelector('#reviewer-email').form.requestSubmit();document.querySelector('#reviewer-email')?.form.requestSubmit()`);
        await waitFor(`!!document.querySelector('#reviewer-code')`);
        assert.equal(await evaluate('otpRequests.length'),1);
        assert(await evaluate(`otpRequests[0].options.shouldCreateUser===false`));
        assert(await evaluate(`!document.querySelector('input[type="password"]') && !!document.querySelector('.google-auth-button')`));
        await evaluate(`document.querySelector('#reviewer-code').value='111111';document.querySelector('#reviewer-code').form.requestSubmit()`);
        await waitFor(`!!document.querySelector('[role="alert"]')`);
        assert.equal(await evaluate('demoRedirect'),'');
        const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(join(artifacts,`${name}.png`),Buffer.from(shot.data,'base64'));
        await evaluate(`document.querySelector('#reviewer-code').value='123456';document.querySelector('#reviewer-code').form.requestSubmit()`);
        await waitFor(`demoRedirect.startsWith('/dashboard?perspective=')`);
        assert.equal(await evaluate('demoRedirect'),'/dashboard?perspective='+ (name.endsWith('client')?'client':'freelancer'));
        assert.equal(browserErrors.length,0,browserErrors.join('\n'));
        results.push({name,passwordless:'mock OTP verified; one request; safe perspective return'});continue;
      }
      if (name.startsWith('workspace-')) {
        await waitFor(`!!document.querySelector('.project-workspace')`);
        assert.equal(await evaluate(`document.querySelectorAll('.project-phase-nav a').length`), 4);
        assert.equal(await evaluate(`document.querySelectorAll('h1').length`), 1);
        assert(await evaluate(`!document.querySelector('.project-progress') && !document.querySelector('.delivery-steps')`));
        if(name==='workspace-setup') assert(await evaluate(`!!button('Invite') && !!button('Create agreement draft')`));
        if(name.startsWith('workspace-agreement')) {
          assert(await evaluate(`!!button('Create agreement draft') && !document.querySelector('.pw-focus a')`));
          assert(await evaluate(`document.querySelector('.pw-focus button')===button('Create agreement draft') && [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Create agreement draft').length===1`));
          assert(await evaluate(`!document.querySelector('.pw-phase-panel').textContent.includes('No agreement yet') && !document.querySelector('.pw-phase-panel').textContent.includes('Not prepared')`));
          assert.equal(await evaluate(`document.querySelectorAll('.project-phase-nav strong')[2].textContent`),'Review');
        }
        if(name==='workspace-review') assert(await evaluate(`!!document.querySelector('.ai-review') && !!button('Approve milestone')`));
        if(name==='workspace-deliver') assert(await evaluate(`!!document.querySelector('textarea[name="notes"]')`));
        if(name==='workspace-payment') assert(await evaluate(`document.querySelector('.pw-phase-panel').textContent.includes('Awaiting work approval')`));
        assert.equal(browserErrors.length, 0, browserErrors.join('\n'));
      }
      if (name.startsWith('ai-')) {
        if(name==='ai-freelancer') {
          assert(await evaluate(`!document.querySelector('.ai-review') && !button('Approve milestone') && document.body.textContent.includes('Please include the Figma link.')`));
          assert.equal(await evaluate('aiCalls'),0);
        } else {
          await waitFor(`!!button('Analyze evidence')`);
          assert.equal(await evaluate('aiCalls'),0);
          assert(await evaluate(`document.querySelector('.ai-consent').textContent.includes('Gemini')`));
          assert.equal(await evaluate(`document.querySelectorAll('.ai-finding').length`),0,'Unrun AI checks must not repeat the requirements as empty findings');
          if(name!=='ai-empty') {
            await evaluate(`button('Analyze evidence').click(); button('Analyze evidence')?.click()`);
            if(name==='ai-loading') {
              await waitFor(`typeof globalThis.releaseAi==='function'`);
              assert(await evaluate(`button('Analyzing…').disabled && document.querySelector('.ai-summary').getAttribute('aria-busy')==='true' && !!button('Approve milestone')`));
              assert.equal(await evaluate('aiCalls'),1);
              await evaluate(`globalThis.releaseAi()`);
            }
            await waitFor(name==='ai-failure'?`!!button('Retry analysis')`:`!!document.querySelector('.ai-summary a')`);
            assert.equal(await evaluate('aiCalls'),1);
            assert.equal(await evaluate('reviewWrites.length'),0,'AI cannot mutate human review');
            if(name==='ai-failure') {
              assert(await evaluate(`document.querySelector('.ai-summary').textContent.includes('Analysis unavailable') && !!button('Approve milestone')`));
              await evaluate(`button('Retry analysis').click()`);
              await waitFor(`aiCalls===2 && !!button('Retry analysis')`);
            } else {
              assert.equal(await evaluate(`document.querySelectorAll('.ai-finding').length`),3);
              assert(await evaluate(`document.querySelector('.ai-findings').textContent.includes('Figma link missing') && document.querySelector('.ai-inspection-ledger').textContent.includes('contents not checked')`));
              assert(await evaluate(`![...document.querySelectorAll('input[name="criteria"]')].some(x=>x.checked)`),'AI must never check acceptance boxes');
              assert(await evaluate(`![...document.querySelectorAll('.ai-finding details')].some(x=>x.open)`));
              if(name==='ai-history') {
                await evaluate(`data.submissions.push({...data.submissions[0],id:'s2',revision:2});rerender()`);
                await waitFor(`document.querySelectorAll('.ai-review').length===2`);
                assert(await evaluate(`document.querySelector('#revision-1 .ai-summary').textContent.includes('Historical analysis') && !document.querySelector('#revision-2 .ai-summary a')`));
                assert(await evaluate(`!document.querySelector('#revision-1').closest('details').open && document.querySelector('#revision-2').closest('details').open`),'Show the latest revision and keep older evidence accessible in history');
                await evaluate(`document.querySelector('#revision-1').closest('details').querySelector('summary').click()`);
                assert(await evaluate(`document.querySelector('#revision-1').getBoundingClientRect().height > 0`),'Historical evidence can still be opened');
                await evaluate(`workspace.user={...workspace.user,id:'worker'};workspace.perspective='client';rerender()`);
                await waitFor(`!document.querySelector('.ai-review')`);
              }
              if(name==='ai-decision') {
                await evaluate(`const form=document.querySelector('.ai-human-decision form');form.querySelector('textarea').value='Please add the missing link.';form.requestSubmit(button('Request changes'))`);
                await waitFor(`reviewWrites.length===1`);
                assert.equal(await evaluate('reviewWrites[0].p_decision'),'changes');
                await evaluate(`document.querySelector('.ai-human-decision form').requestSubmit(button('Approve milestone'))`);
                await waitFor(`!!document.querySelector('.formerror')`);
                assert.equal(await evaluate('reviewWrites.length'),1);
                await evaluate(`document.querySelectorAll('.ai-human-decision input[type="checkbox"]').forEach(x=>x.click());document.querySelector('.ai-human-decision form').requestSubmit(button('Approve milestone'))`);
                await waitFor(`reviewWrites.length===2`);
                assert.equal(await evaluate('reviewWrites[1].p_decision'),'approved');
              }
            }
          }
          if(name!=='ai-history')await evaluate(`document.querySelector('.ai-review').scrollIntoView()`);
        }
        assert.equal(browserErrors.length,0,browserErrors.join('\n'));
      }
      if(name.startsWith('demo-')) {
        await waitFor(`document.querySelector('.demo-payment')?.dataset.demoStatus==='READY'`);
        if(name==='demo-1440')assert(await evaluate(`data.projects.length>0 && data.payments[0].status==='UNPAID'`));
        assert.equal(await evaluate(`getComputedStyle(document.querySelector('.dp-journey h2')).color`),'rgb(245, 247, 236)');
        await evaluate(`globalThis.demoBefore=JSON.stringify(data);globalThis.demoRoleBefore=workspace.perspective;globalThis.demoStorageBefore=JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)])`);
        assert(await evaluate(`document.querySelector('.dp-amount').textContent.includes('USD 10.00') && document.querySelector('.dp-disclosure').textContent.includes('No PayPal transaction')`));
        assert.equal(await evaluate('demoForbiddenCalls.length'),0);
        if(name!=='demo-ready') {
          await evaluate(`const create=document.querySelector('.dp-main-action button');create.click();create.click()`);
          await waitFor(`document.querySelector('.demo-payment').dataset.demoStatus==='INVOICE_CREATED'`);
          assert(await evaluate(`document.activeElement===document.querySelector('.dp-main-action button')`));
          if(name!=='demo-invoice') {
            await send('Emulation.setFocusEmulationEnabled',{enabled:true});
            await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
            await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
            await waitFor(`document.querySelector('.demo-payment').dataset.demoStatus==='PAYMENT_PENDING'`);
            assert(await evaluate(`getComputedStyle(document.activeElement).outlineStyle!=='none'`));
            if(name!=='demo-pending') {
              await evaluate(`document.querySelector('.dp-options summary').click();button('Simulate failure').click()`);
              await waitFor(`document.querySelector('.demo-payment').dataset.demoStatus==='FAILED_SIMULATED'`);
              if(name!=='demo-failure') {
                await evaluate(`document.querySelector('.dp-main-action button').click()`);
                await waitFor(`document.querySelector('.demo-payment').dataset.demoStatus==='PAYMENT_PENDING'`);
                await evaluate(`if(!document.querySelector('.dp-options').open)document.querySelector('.dp-options summary').click();button('Cancel demo invoice').click()`);
                await waitFor(`document.querySelector('.demo-payment').dataset.demoStatus==='CANCELLED_SIMULATED'`);
                if(name!=='demo-cancelled') {
                  await evaluate(`button('Reset demo').click()`);
                  await waitFor(`document.querySelector('.demo-payment').dataset.demoStatus==='READY'`);
                  for(const expected of ['INVOICE_CREATED','PAYMENT_PENDING','PAID_SIMULATED']) {
                    await evaluate(`document.querySelector('.dp-main-action button').click()`);
                    await waitFor(`document.querySelector('.demo-payment').dataset.demoStatus==='${expected}'`);
                  }
                  await evaluate(`button('Freelancer demo').click()`);
                  await waitFor(`document.querySelector('.dp-result').textContent.includes('Simulated earnings: USD 10.00')`);
                  assert(await evaluate(`document.querySelector('.dp-result').textContent.includes('Demo payment completed') && document.querySelector('.dp-result').textContent.includes('simulated')`));
                }
              }
            }
          }
        }
        assert.equal(await evaluate('demoForbiddenCalls.length'),0,'No network, PayPal, webhook or Supabase calls');
        assert(await evaluate(`JSON.stringify(data)===demoBefore && workspace.perspective===demoRoleBefore`),'Actual project/payment data and roles must not change');
        assert(await evaluate(`JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)])===demoStorageBefore`),'No demo persistence');
        assert(await evaluate(`![...document.querySelectorAll('.demo-payment a')].some(a=>a.href.includes('paypal.com'))`));
        assert.equal(browserErrors.length,0,browserErrors.join('\n'));
        await evaluate(`document.querySelector('.demo-payment').scrollIntoView()`);
      }
      if(name.startsWith('waiting-')) {
        await waitFor(`!!document.querySelector('.waiting-workspace')`);
        assert(await evaluate(`!document.querySelector('.waiting-steps').open`), 'Repeated timeline details stay collapsed by default');
        await evaluate(`document.querySelector('.waiting-steps summary').focus()`);
        await send('Emulation.setFocusEmulationEnabled',{enabled:true});
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        await waitFor(`document.querySelector('.waiting-steps').open`);
        assert(await evaluate(`![...document.querySelectorAll('button')].some(b=>/send reminder|request update|cancel contract|reassign/i.test(b.textContent))`));
        await evaluate(`document.querySelector('.waiting-resolve summary').focus()`);
        await send('Emulation.setFocusEmulationEnabled',{enabled:true});
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        await waitFor(`document.querySelector('.waiting-resolve').open`);
        assert(await evaluate(`document.querySelector('.waiting-resolve').textContent.includes('No notification or email will be sent')`));
        assert(await evaluate(`getComputedStyle(document.querySelector('.waiting-resolve summary')).outlineStyle !== 'none'`));
        if(name==='waiting-delivery') assert(await evaluate(`document.querySelector('.waiting-row').textContent.includes('Delivery overdue')`));
        if(name==='waiting-payment') assert(await evaluate(`document.querySelector('.waiting-row').textContent.includes('payment pending confirmation') && !document.querySelector('.waiting-row').textContent.includes('overdue')`));
        if(name==='waiting-invitation') assert(await evaluate(`document.querySelector('.waiting-row').textContent.includes('Waiting for freelancer to accept') && document.querySelector('.waiting-resolve').textContent.includes('Manage invitation')`));
        if(name==='waiting-expired') assert(await evaluate(`document.querySelector('.waiting-row').textContent.includes('Freelancer invitation needed')`));
        if(name==='waiting-agreement') assert(await evaluate(`document.querySelector('.waiting-row').textContent.includes('freelancer agreement acceptance')`));
        if(name==='waiting-access') assert(await evaluate(`document.querySelector('.waiting-row').textContent.includes('Waiting for client review')`),'Revoked access must not erase a received submission');
        if(name==='waiting-mixed') {
          assert.equal(await evaluate(`document.querySelectorAll('.waiting-row').length`),2);
          assert(await evaluate(`document.querySelector('.pw-primary').textContent.includes('Review submission')`));
        }
        if(name==='waiting-1440') {
          assert(await evaluate(`document.querySelector('.waiting-row').textContent.includes('No contractual review-response deadline')`));
          await evaluate(`data.submissions[0].status='approved';data.reviews.push({id:'new-review',submission_id:'s',decision:'approved',note:'Accepted',confirmed_criteria:[],created_at:'2026-11-08T00:00:00Z'});rerender()`);
          await waitFor(`document.querySelector('.waiting-row').textContent.includes('payment pending confirmation')`);
          assert(await evaluate(`!document.querySelector('.waiting-row').textContent.includes('Waiting for client review')`));
        }
        await evaluate(`document.querySelector('.waiting-workspace').scrollIntoView()`);
        assert.equal(browserErrors.length,0,browserErrors.join('\n'));
      }
      if (name.startsWith('worker-') && name !== 'worker-invitations') {
        await waitFor(`!!document.querySelector('.freelancer-workspace')`);
        assert(await evaluate(`!document.querySelector('.client-overview') && !document.querySelector('[data-tour="new-project"]')`));
        if (query.includes('workerState=changes')) assert(await evaluate(`document.querySelector('.fw-focus').textContent.includes('Changes requested')`));
        if (name === 'worker-desktop') assert(await evaluate(`document.querySelector('.fw-focus').textContent.includes('Waiting for client review')`));
        if (name === 'worker-narrow') {
          await evaluate(`document.querySelector('.fw-job-details summary').click()`);
          await waitFor(`document.querySelector('.fw-job-details').open`);
          assert(await evaluate(`!!document.querySelector('.fw-detail-grid a[href$="/agreement"]')`));
        }
        assert.equal(browserErrors.length, 0, browserErrors.join('\n'));
      }
      if (name === 'worker-invitations') {
        await waitFor(`document.querySelector('.invitation-count')?.textContent === '2'`);
        await evaluate(`button('Review invitation').click()`);
        await waitFor(`!!button('Accept invitation')`);
        await evaluate(`button('Accept invitation').click()`);
        await waitFor(`document.querySelector('.invitation-count')?.textContent === '1'`);
        assert.equal(await evaluate('invitationAccepts'),1);
        assert.equal(await evaluate('invitationRefreshes'),1);
        assert(await evaluate(`document.querySelector('details').textContent.includes('accepted')`));
      }
      if (name.startsWith('client-')) {
        await waitFor(`!!document.querySelector('.client-overview')`);
        assert.equal(await evaluate(`document.querySelectorAll('.co-focus').length`), 1);
        assert.equal(await evaluate(`document.querySelectorAll('.co-metric').length`), 4);
        assert.equal(await evaluate(`document.querySelector('[data-tour="new-project"]').getAttribute('href')`), '/projects/new');
        assert(await evaluate(`!document.querySelector('.dashboard-shortcuts') && !document.querySelector('.dash-aside-card')`));
        if (query.includes('clientState=review')) {
          assert.equal(await evaluate(`document.querySelector('.co-focus-action').getAttribute('href')`), '/handoff/l');
          assert(await evaluate(`!document.querySelector('.co-ai')`),'The primary review action must not be duplicated by the AI aside');
        }
        if (name === 'client-unavailable') assert.equal(await evaluate(`document.querySelectorAll('.co-metric strong')[1].textContent`), '\u2014');
        if (name === 'client-archived') assert.equal(await evaluate(`document.querySelector('.co-metric strong').textContent`), '0');
        assert.equal(browserErrors.length, 0, browserErrors.join('\n'));
      }
      if (name.startsWith('notifications')) {
        await waitFor(`document.querySelector('.invitation-count')?.textContent === '2'`);
        assert(await evaluate(`document.querySelector(role === 'client' ? '.invitation-summary' : '.fw-focus').textContent.includes('2 pending project invitations')`));
        assert(await evaluate(`role === 'client' || !document.querySelector('.invitation-summary')`),'The invitation action appears once when it is the dashboard focus');
        assert.equal(await evaluate(`document.querySelector('.invitation-count').closest('a').getAttribute('href')`), '/invitations');
        await evaluate(`data.invitations.find(i=>i.id==='incoming-0').status='accepted'; rerender()`);
        await waitFor(`document.querySelector('.invitation-count')?.textContent === '1'`);
        await evaluate(`workspace.error='Offline'; rerender()`);
        await waitFor(`document.querySelector('.invitation-count')?.getAttribute('aria-label').includes('last known status')`);
        await evaluate(`workspace.error=''; workspace.user={...workspace.user,id:'other',email:'other@example.test'}; rerender()`);
        await waitFor(`!document.querySelector('.invitation-count') && !document.querySelector('.invitation-summary')`);
        await evaluate(`workspace.user={...workspace.user,id:role==='client'?'client-a':'worker',email:role==='client'?'alex@example.test':'jamie@example.test'}; workspace.loaded=false; rerender()`);
        await waitFor(`!document.querySelector('.invitation-count')`);
        await evaluate(`workspace.loaded=true; data.invitations.find(i=>i.id==='incoming-1').expires_at='2020-01-01'; rerender()`);
        await waitFor(`!!document.querySelector('#workspace-main') && !document.querySelector('.invitation-count')`);
      }
      if (name.startsWith('onboarding')) {
        assert(await evaluate(`document.querySelector('.widebutton').disabled`));
        await evaluate(`document.querySelectorAll('.workspace-options button')[1].click()`);
        await waitFor(`document.querySelectorAll('.workspace-options button')[1].getAttribute('aria-pressed') === 'true'`);
        assert(await evaluate(`!document.querySelector('.widebutton').disabled`));
        assert(await evaluate(`document.querySelector('.workspace-onboarding-card').getBoundingClientRect().width <= 462`));
      }
      if (name.startsWith('verify')) {
        await waitFor(`!!document.getElementById('browser-results')`);
        const report = await evaluate(`JSON.parse(document.getElementById('browser-results').textContent)`);
        await writeFile(join(artifacts, `${name}.json`), JSON.stringify(report, null, 2));
        assert.equal(report.failed, 0, `${name}: ${JSON.stringify(report)}`);
        results.push({ name, passed: report.passed });
      } else {
        await evaluate('document.fonts.ready.then(() => true)');
        if (name.startsWith('tour')) await waitFor(`!!document.querySelector('.tour-popover')?.checkVisibility({visibilityProperty:true})`);
        else await waitFor(`!document.querySelector('.guided-tour')`);
        const layout = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector('h1')?.textContent})`);
        assert(layout.scrollWidth <= layout.width, `${name} overflows: ${JSON.stringify(layout)}`);
        results.push({ name, layout });
      }
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(join(artifacts, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
      if(name.startsWith('workspace-agreement')) {
        await evaluate(`button('Create agreement draft').click()`);
        await waitFor(`!!document.querySelector('dialog[open]')`);
        assert(await evaluate(`document.querySelector('dialog[open]').textContent.includes('Create agreement draft')`));
        await evaluate(`document.querySelector('[aria-label="Close dialog"]').click()`);
      }
      if(name.startsWith('payments-')) {
        assert(await evaluate(`document.querySelector('[aria-label="Payment amounts"]').textContent.includes('Paid · confirmed by PayPal') && !document.querySelector('[aria-label="Payment amounts"]').textContent.includes('Planned budget')`));
        assert(await evaluate(`![...document.querySelectorAll('details')].find(x=>x.textContent.includes('Budget, approval')).open`));
      }
      if(name==='demo-1440'||name==='demo-390') {
        await evaluate(`document.querySelector('.dp-sample').scrollIntoView()`);
        const sampleShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(join(artifacts,`${name}-sample.png`),Buffer.from(sampleShot.data,'base64'));
        await evaluate(`workspace.user={...workspace.user,id:'different-demo-user'};rerender()`);
        await waitFor(`document.querySelector('.demo-payment')?.dataset.demoStatus==='READY'`);
        assert(await evaluate(`button('Client demo').getAttribute('aria-pressed')==='true'`));
        assert.equal(await evaluate('demoForbiddenCalls.length'),0);
      }
      if(name==='payments-desktop')assert(await evaluate(`!!document.querySelector('a[href="/payments/demo"]') && document.querySelector('.demo-payment-entry').textContent.includes('PAYPAL SANDBOX')`));
      if(name==='demo-1440') {
        await evaluate(`document.querySelector('.dp-main-action button').click()`);
        await waitFor(`document.querySelector('.demo-payment').dataset.demoStatus==='INVOICE_CREATED'`);
        await send('Page.reload');
        await waitFor(`document.querySelector('.demo-payment')?.dataset.demoStatus==='READY'`);
        assert.equal(await evaluate('demoForbiddenCalls.length'),0);
      }
      if(name==='ai-1440' || name==='ai-390') {
        await evaluate(`document.querySelector('.ai-human-decision').scrollIntoView()`);
        const decisionShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(join(artifacts,`${name}-decision.png`),Buffer.from(decisionShot.data,'base64'));
        const clip=await evaluate(`(()=>{const r=document.querySelector('.ai-review').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()`);
        const fullShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
        await writeFile(join(artifacts,`${name}-full.png`),Buffer.from(fullShot.data,'base64'));
      }
      if (authCase) {
        assert(await evaluate(`Boolean(document.querySelector('.authcard h2').compareDocumentPosition(document.querySelector('.google-auth-button')) & Node.DOCUMENT_POSITION_FOLLOWING)`));
        assert(await evaluate(`getComputedStyle(document.querySelector('.google-auth-button')).backgroundColor === 'rgb(255, 255, 255)'`));
        assert(await evaluate(`document.querySelector('.google-auth-button img').complete && document.querySelector('.google-auth-button img').naturalWidth > 0`));
        await evaluate(`document.querySelector('button[type="submit"]').click()`);
        await waitFor(`document.querySelector('#email').getAttribute('aria-invalid') === 'true'`);
        assert(await evaluate(`document.activeElement.id === '${name.startsWith('signup') ? 'full_name' : 'email'}'`));
        await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
        await send('Input.dispatchKeyEvent', {type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
        assert(await evaluate(`document.activeElement.id === '${name.startsWith('signup') ? 'email' : 'password'}'`));
        await evaluate(`document.querySelector('.passwordtoggle').click()`);
        await waitFor(`document.querySelector('#password').type === 'text'`);
        await evaluate(`document.querySelector('.google-auth-button').click();document.querySelector('.google-auth-button').click()`);
        await waitFor(`!!document.querySelector('.google-auth-error')`);
        assert.equal(await evaluate('globalThis.authGoogleRequests'),1);
        assert.equal(await evaluate('globalThis.authGoogleIntent'), query.includes('intent=freelancer') ? 'freelancer' : query.includes('intent=client') || name.startsWith('signup') ? 'client' : null);
        assert(await evaluate(`!document.querySelector('.google-auth-button').disabled`));
        assert(await evaluate(`document.documentElement.scrollWidth <= innerWidth`));
        const errorShot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(join(artifacts, `${name}-error.png`),Buffer.from(errorShot.data,'base64'));
      }
      if (name.startsWith('tour')) {
        for (let tab = 0; tab < 6; tab++) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
          assert(await evaluate(`!!document.activeElement?.closest('.guided-tour') || document.activeElement === document.body`), `${name}: focus escaped to a background control`);
        }
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await waitFor(`!document.querySelector('.guided-tour')`);
        assert(await evaluate(`remote[workspace.user.id][tourPreferenceKey(role)].status === 'skipped'`), `${name}: Escape did not persist Skip`);
        assert(await evaluate(`document.activeElement === document.getElementById('workspace-main')`), `${name}: focus was not restored`);
      }
    }
    await writeFile(join(artifacts, 'component-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
    await send('Browser.close').catch(() => {});
  } finally {
    socket?.close();
    browser.kill();
  }
});
