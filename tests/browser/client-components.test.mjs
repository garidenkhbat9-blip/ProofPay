// Real Chromium rendering with isolated Auth/data adapters. No service requests.
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

test('client workspace components: desktop/mobile tour, actions and responsive layouts', { timeout: 90000, skip: process.platform !== 'win32' || !existsSync(chrome) ? 'Component fixture builder requires Windows and Chrome; unit tests still run.' : false }, async () => {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/preview-client-experience.ps1'], { stdio: 'pipe', windowsHide: true });
  const profile = await mkdtemp(join(artifacts, 'cdp-profile-'));
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--allow-file-access-from-files', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
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
    socket.onmessage = ({ data }) => {
      const response = JSON.parse(data);
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
      const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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
    const cases = [
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
      const authCase = name.startsWith('login') || name.startsWith('signup');
      await waitFor(`location.search.includes('case=${name}') && !!document.querySelector('${authCase ? '.authcard .google-auth-button' : '#workspace-main'}')`);
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
