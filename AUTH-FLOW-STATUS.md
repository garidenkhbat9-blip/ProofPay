# Auth засвар — 2026-11-07

## Ажиллуулсан шалгалт

- `npm run typecheck`: PASS. Эхний удаа хуучирсан `.next/dev/types` cache шинэ layout route-той зөрчилдсөн; зөвхөн generated cache цэвэрлэсний дараа PASS.
- `npm test`: 139/139 PASS, 0 failed, 0 skipped. Эхний run-д error copy-ийн case-sensitive assertion нэг унасан; зассан final run дээр бүгд давсан.
- Existing Chrome component suite: desktop 46, mobile 47, narrow 47 assertions, 15 scenarios PASS; full npm test-д ажилласан. Энэ нь шинэ auth screens-ийн browser E2E биш.
- `npm run build`: PASS, 25/25 static pages, `/auth/confirm` route багтсан.
- `git diff --check`: PASS.

Тестүүд бодит confirmation email илгээгээгүй. Шинэ unit tests token identity/replay/cooldown-ийг mocks ашиглан шалгасан; signup/resend UI болон session persistence-ийн бүх 12 сценарийг бодит browser дээр бүрэн батлаагүй.

## Шалтгаан

App нь @supabase/ssr cookie/PKCE бус, supabase-js browser implicit flow + localStorage session ашигладаг. Signup redirect `/login` байсан; login effect нь хуучин session-ийг зөвхөн perspective-тэй тусгай холбоос дээр баталгаажуулдаг байсан. Confirmation token байхгүй/redirect алдагдсан үед хуучин account-аар workspace руу орох боломжтой байв. Signup email-pending төлөвт form дахин идэвхтэй үлдсэн. 429-ийн бодит provider quota/IP/SMTP шалтгааныг Auth logs болон remote settings-гүйгээр тогтоох боломжгүй; энэ ажил remote settings уншиж/өөрчлөөгүй. Browser signup нь хэрэглэгчийн browser-оос шууд Supabase руу явдаг, shared server signup proxy байхгүй. Signup/resend автомат retry loop олдоогүй.

## Өөрчлөлт

`src/components/auth-form.tsx`: бүх existing session-д account confirmation, dedicated Check your email state, sign-in link, manual resend, synchronous request lock, cooldown. Signup сонгосон perspective-ийг хадгална; project эрх олгохгүй. Login болон auto-confirmed signup дээр Auth getUser шалгана.

`src/app/auth/confirm/page.tsx`, `layout.tsx`, `src/lib/email-confirmation.ts`: token_hash + verifyOtp(email), шинэ session-ийн token-оор getUser шалгаж ID/email confirmation таарсан үед fixed dashboard destination руу шилжинэ. Одоо нэвтэрсэн account солигдохыг тайлбарлаж explicit confirmation button ашигладаг; mount/useEffect дээр token consume хийхгүй. Token query амжилтын дараа арилна, referrer болон indexing хаалттай. Token/password log хийхгүй. Invalid/replayed/missing token нь хуучин account руу redirect хийхгүй. LocalStorage session-ийг Supabase SDK хадгалдаг, provider identity солигдоход workspace data reset хийдэг.

`src/lib/auth-navigation.ts`, `auth-validation.ts`, `auth-cooldown.ts`, `supabase.ts`: бүх entry-д account acknowledgement, enumeration-safe duplicate copy, error code/status ялгалт, Auth 429 Retry-After секунд/HTTP date cooldown. Request retry loop нэмээгүй. Existing refresh-token SDK behavior хэвээр.

`tests/auth.test.ts`, `tests/email-confirmation.test.ts`: account acknowledgement, independent token identity, expired/replayed token rejection, Retry-After coverage. Existing project/invitation role tests хадгалагдсан.

## Supabase dashboard-д эзэмшигч хийх тохиргоо

Auth → URL Configuration: Site URL нь одоо ашиглаж буй баталгаатай production origin байх ёстой. Production hostname энэ ажлаар баталгаажаагүй; таамагласан hostname бүү оруул. Redirect URLs-д `http://localhost:3000/auth/confirm` болон бодит production origin + `/auth/confirm` нэм. Одоо ажиллаж буй login/reset redirect URLs-ийг хадгал.

Auth → Email Templates → Confirm signup:

```html
<h2>Confirm your ProofPay account</h2>
<p>Confirm your email to open your workspace.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a></p>
<p>If you already confirmed your account, sign in to ProofPay. Do not register again.</p>
```

Энэ template нь app-аас өгсөн `/auth/confirm` redirect-д зориулагдсан. Template/allowlist өөрчлөгдөөгүй үед хуучин default implicit email links шинэ token_hash route-ээр батлагдахгүй; confirmed хэрэглэгч login ашиглана. Өмнө явуулсан имэйлийг энэ өөрчлөлт шинэчлэхгүй. Dashboard өөрчлөлтөд owner approval шаардлагатай; автоматаар хийгээгүй. Cross-browser confirmation-д local PKCE verifier шаардахгүй.

429 үргэлжилбэл Auth logs дахь error code/time, Rate Limits, SMTP delivery/quota-г шалгана. SMTP өөрчлөх эсвэл rate limit сулруулахыг энэ ажлаар зөвлөж/гүйцэтгээгүй. Retry-After харагдахгүй үед 60 секунд local cooldown ашиглана; provider limit хэвээр authoritative.

## Manual QA ба blockers

1. Dashboard template/allowlist-ийг owner-approved staging дээр тохируул.
2. Browser profile A-д client login хийж хэвээр үлдээ. Profile B-д шинэ freelancer signup нэг удаа хийх; Check your email, cooldown, Already confirmed link шалгах.
3. Имэйлээ B эсвэл incognito-д нээж Confirm email дарах: verified freelancer workspace, зөв email, зөв урилга харагдах ёстой. Дахин signup хийхгүй.
4. Өөр test registration-ийн холбоосыг A-д нээж account switching тайлбар шалгах. Explicit confirm дарахад зөв шинэ identity-гаар орж, хуучин client project харагдахгүй байх.
5. Reused/expired/missing token дээр алдаа, Sign in холбоос; хуучин account руу автомат redirect байхгүй. Confirmed account password login/reload persistence шалгах.
6. Role toggle нь project membership/RLS өөрчлөхгүй. Хоёр тусдаа profile ашиглавал session тусгаарлагдана; ижил profile-ийн tabs нэг storage session хуваалцана.

Live email, SMTP, hosted template, cross-browser end-to-end verification ажиллуулаагүй. Migrations 005/006, policies, production records, payments, commit/push/deployment-д хүрээгүй. Auth-specific full browser automation нэмээгүй; existing component suite болон isolated unit tests нь live E2E-г орлохгүй.
