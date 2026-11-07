# Auth UI polish — 2026-11-07

Sign In, Sign Up-ийн form дарааллыг heading → fields → primary action → divider → white Google button → alternate account link → quiet demo footer болгон цэгцлэв. Desktop-ийн ProofPay logo, left hero болон right card layout хадгалагдсан. Forest green, sage, off-white palette, 46px fields/buttons, compact accessible role selector, restrained border/radius ашиглав. Mobile card-ийн давхар padding-ийг арилгаж 320px дээр horizontal overflow байхгүйг шалгав.

Хоёр form нэг `GoogleAuthButton` ашиглана. Google's official multicolor SVG asset-ийг өөрчлөлгүй, aspect ratio-г хадгалж цагаан background дээр харуулна. Source/copyright: `public/google-g-source.md`, `public/google-g.svg`. OAuth handler, PKCE/cookies, onboarding, verified user checks, RLS болон password validation логик энэ task-аар өөрчлөгдөөгүй. Role intent байхгүй Google user өмнөх safe onboarding руу орно.

## Өөрчилсөн файлууд

- `src/components/auth-form.tsx`: зөв дараалал, Forgot password байрлал, selector label, demo footer.
- `src/components/google-sign-in.tsx`: shared `GoogleAuthButton`, icon болон loading/error presentation; request handler хэвээр.
- `src/app/precision.css`: auth-only scoped typography, spacing, white button, mobile layout, focus states.
- `public/google-g.svg`, `public/google-g-source.md`: Google asset болон эх сурвалж.
- `scripts/preview-client-experience.ps1`, `tests/browser/client-experience.js`, `tests/browser/client-components.test.mjs`: actual AuthForm/GoogleAuthButton-ийг isolated fixtures дотор desktop/mobile дээр render хийх.

## Бодит шалгалт

- `npm run typecheck`: PASS.
- `npm test`: 144/144 PASS, 0 fail/skip.
- `npm run test:components`: PASS; нийт 21 viewport/scenario, үүнд Sign In/Sign Up тус бүр 1440px, 390px, 320px дээр. Keyboard Tab, first invalid input focus, password visibility, white Google button/icon load, heading-ийн дараах байрлал, Google POST wiring, double-click lock, provider error болон retry-enabled state шалгасан.
- `npm run build`: PASS, 28/28 static pages.
- `git diff --check`: PASS.

Desktop Sign In/Sign Up, mobile Sign Up, narrow Sign In/error screenshots-ийг хараад шалгасан. Generated screenshots `.validation/client-experience/login-*.png`, `signup-*.png` дотор; `npm run test:components` дахин үүсгэнэ. Browser tests нь actual React components + mocked Auth/data/router/provider ашигладаг; real Google navigation эсвэл имэйл явуулаагүй.

Live Google consent/session smoke test болон өмнөх provider configuration gate хэвээр. Тохиргоог `GOOGLE-AUTH-SETUP.md`-ээс үзнэ. Шинэ UI blocker илрээгүй. Migrations, RLS, payments, project data, remote settings, deployment, commit/push-д хүрээгүй.
