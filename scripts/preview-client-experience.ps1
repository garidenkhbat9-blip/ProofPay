# Renders the actual React components with isolated account/data adapters.
# Does not start Next.js, authenticate real accounts or contact any service.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$artifacts = Join-Path $projectRoot '.validation/client-experience'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$source = 'const modules={},cache={}; globalThis.process={env:{NODE_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture"},nextTick:queueMicrotask}; const global=globalThis;'
$modules = @('src/lib/types','src/lib/domain','src/lib/project-workflow','src/lib/project-management','src/lib/guided-tour','src/lib/workspace-onboarding','src/lib/cloud','src/lib/judge-access','src/components/ui','src/components/project-next-step','src/components/project-actions','src/components/dashboard-tour','src/components/workspace-onboarding','src/components/judge-workspace','src/components/projects','src/components/workspace-shell')
$OutputEncoding = [Text.UTF8Encoding]::new($false)
$modules += @('src/lib/google-auth','src/lib/workspace-preference','src/app/auth/workspace/page','src/lib/auth-navigation','src/lib/auth-validation','src/lib/auth-cooldown','src/components/password-field','src/components/google-sign-in','src/components/auth-form')
$modules += @('src/lib/project-archive','src/lib/agreement-guidance','src/lib/evidence-submit','src/lib/workspace-sync','src/lib/payments/model','src/lib/payments/config','src/lib/payments/errors','src/components/agreement','src/components/agreement-draft-builder','src/components/delivery','src/components/evidence-ai-review','src/components/payments','src/components/account')
foreach ($module in $modules) {
  $file = if (Test-Path ($module + '.tsx')) { $module + '.tsx' } else { $module + '.ts' }
  $compiled = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | & './node_modules/@esbuild/win32-x64/esbuild.exe' --loader=tsx --format=cjs --jsx=automatic
  if ($LASTEXITCODE -ne 0) { throw "Component transform failed: $module" }
  $source += "`nmodules['$module']=function(module,exports,require){`n" + ($compiled -join "`n") + "`n};"
}
$libraries = @{
 'react'='react/cjs/react.production.js';
 'react/jsx-runtime'='react/cjs/react-jsx-runtime.production.js';
 'react-dom'='react-dom/cjs/react-dom.production.js';
 'react-dom/client'='react-dom/cjs/react-dom-client.production.js';
 'scheduler'='scheduler/cjs/scheduler.production.js'
}
foreach ($module in $libraries.Keys) {
 $source += "`nmodules['$module']=function(module,exports,require){`n" + [IO.File]::ReadAllText((Join-Path $projectRoot ('node_modules/' + $libraries[$module]))) + "`n};"
}
$source += @'
function load(id,from='') {
 if(id.startsWith('@/'))id='src/'+id.slice(2);
 if(id.startsWith('.')){const parts=from.split('/');parts.pop();for(const part of id.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}id=parts.join('/');}
 if(cache[id])return cache[id].exports;
 if(!modules[id])throw Error('Missing module '+id);
 const module={exports:{}};cache[id]=module;modules[id](module,module.exports,child=>load(child,id));return module.exports;
}
'@
$source += [IO.File]::ReadAllText((Join-Path $projectRoot 'tests/browser/client-experience.js'))
[IO.File]::WriteAllText((Join-Path $artifacts 'preview.js'), $source)
$css = [IO.File]::ReadAllText((Join-Path $projectRoot 'src/app/globals.css')) + [IO.File]::ReadAllText((Join-Path $projectRoot 'src/app/precision.css')) + [IO.File]::ReadAllText((Join-Path $projectRoot 'src/app/workspace.css'))
$css = $css -replace '@import "tailwindcss/[^;]+;', ''
$css = '@font-face{font-family:"DM Sans Variable";src:url("../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2");font-weight:100 1000}@font-face{font-family:"Manrope Variable";src:url("../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2");font-weight:200 800}' + $css
[IO.File]::WriteAllText((Join-Path $artifacts 'preview.css'), $css)
$html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="preview.css"><body><div id="fixture-root"></div><script src="preview.js"></script></body></html>'
[IO.File]::WriteAllText((Join-Path $artifacts 'preview.html'), $html)
Write-Output 'Component fixtures generated: .validation/client-experience/preview.html'
