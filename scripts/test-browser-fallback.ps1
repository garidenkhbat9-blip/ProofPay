

param([switch]$LocalFixturesWithoutChromeSandbox)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$artifacts = Join-Path $projectRoot '.validation/client-experience'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$modules = @('src/lib/types','src/lib/domain','src/lib/project-workflow','src/lib/project-management','src/lib/guided-tour','src/lib/api-http','src/lib/project-authorization','tests/guided-tour.test','tests/project-management.test','tests/project-authorization.test','tests/workflow.test','tests/domain.test')
$source = 'const modules={},cache={},cases=[]; globalThis.process={env:{},nextTick:queueMicrotask}; const global=globalThis;'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
foreach ($module in $modules) {
  $compiled = Get-Content -LiteralPath ($module + '.ts') -Raw -Encoding UTF8 | & './node_modules/@esbuild/win32-x64/esbuild.exe' --loader=ts --format=cjs
  if ($LASTEXITCODE -ne 0) { throw "Browser transform failed: $module" }
  $source += "`nmodules['$module']=function(module,exports,require){`n" + ($compiled -join "`n") + "`n};"
}
$source += "`nmodules['node:assert/strict']=function(module,exports,require){ const __dirname='';`n"
$source += [IO.File]::ReadAllText((Join-Path $projectRoot 'node_modules/next/dist/compiled/assert/assert.js'))
$source += 'module.exports=module.exports.strict; module.exports.match=(v,p)=>module.exports(p.test(v)); module.exports.doesNotMatch=(v,p)=>module.exports(!p.test(v));};'
$source += @'
modules['node:test']=function(module){module.exports={test:(name,fn)=>cases.push({name,fn})};};
function load(id,from='') {
 if(id.startsWith('.')){const parts=from.split('/');parts.pop();for(const part of id.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}id=parts.join('/');}
 if(cache[id])return cache[id].exports;
 if(!modules[id])throw Error('Missing module '+id);
 const module={exports:{}};cache[id]=module;modules[id](module,module.exports,child=>load(child,id));return module.exports;
}
(async()=>{
 const results=[];
 try {
  for(const id of Object.keys(modules))if(id.startsWith('tests/'))load(id);
  for(const item of cases){try{await item.fn();results.push({name:item.name,passed:true});}catch(error){results.push({name:item.name,passed:false,error:String(error)});}}
 }catch(error){results.push({name:'harness',passed:false,error:String(error)});}
 document.body.textContent=JSON.stringify({runner:'Chromium supplemental harness (not node:test)',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results});
})();
'@
[IO.File]::WriteAllText((Join-Path $artifacts 'tests.js'), $source)
$html = '<!doctype html><meta charset="utf-8"><body>Running<script src="tests.js"></script></body>'
[IO.File]::WriteAllText((Join-Path $artifacts 'tests.html'), $html)
$chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
$htmlUrl = ([Uri](Join-Path $artifacts 'tests.html')).AbsoluteUri
$profile = Join-Path $artifacts 'chrome-profile'
$stdout = Join-Path $artifacts 'results.html'
$stderr = Join-Path $artifacts 'chrome.log'
$arguments = @('--headless=new','--disable-gpu','--disable-software-rasterizer','--in-process-gpu','--no-first-run','--no-default-browser-check','--allow-file-access-from-files','--dump-dom','--virtual-time-budget=10000', ('--user-data-dir="' + $profile + '"'), $htmlUrl)
if ($LocalFixturesWithoutChromeSandbox) { $arguments += @('--no-sandbox','--disable-background-networking') }
$chromeProcess = Start-Process -FilePath $chrome -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
if (-not $chromeProcess.WaitForExit(30000)) { Stop-Process -Id $chromeProcess.Id; throw 'Browser tests timed out' }
$output = ''
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try { $output = [IO.File]::ReadAllText($stdout) } catch [IO.IOException] { }
  if ($output -match '<body>\{') { break }
  Start-Sleep -Milliseconds 500
}
$match = [regex]::Match($output, '<body>(\{.*\})</body>', [Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $match.Success) { throw 'Browser tests did not finish; inspect .validation/client-experience/chrome.log' }
$json = [Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
[IO.File]::WriteAllText((Join-Path $artifacts 'results.json'), $json)
$result = $json | ConvertFrom-Json
$result | Select-Object runner,passed,failed | Format-List
$result.results | Where-Object { -not $_.passed } | Format-List
if ($result.failed -gt 0) { exit 1 }
