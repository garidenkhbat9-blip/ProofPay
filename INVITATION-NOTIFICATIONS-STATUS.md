# Invitation notification — 2026-11-07

## Хэрэгжүүлсэн зүйл

- Desktop/mobile нэг sidebar-ийн Invitations холбоос дээр ногоон, цагаан бичигтэй компакт badge нэмэв. 1–9 тоогоор, түүнээс ихийг 9+ гэж харуулна. Zero болон анхны ачаалалт дээр тоо харуулахгүй. Screen reader-д бүтэн тоог өгнө; active/focus styling хэвээр.
- Overview дээр бодит тоо, ганц/олон тооны зөв текст, Review invitation(s) холбоос бүхий компакт мэдэгдэл нэмэв. Төсөлгүй хэрэглэгчид мөн харагдана.
- Client/Freelancer perspective нь эрх олгохгүй. Аль ч perspective дээр зөвхөн өөрт ирсэн урилгыг тоолно; илгээсэн урилгууд badge-д орохгүй.
- Received жагсаалт баталгаажсан email-ээр шүүгдэж, pending урилгууд эхэнд эрэмбэлэгдэнэ. Project name, status, expiry date/time, expired/revoked тайлбар харагдана.
- Review нээлттэй байхад хугацаа дууссан эсвэл шинэ snapshot-д төлөв өөрчлөгдсөн бол Accept идэвхгүй болно. Серверийн татгалзсан үйлдлийн дараа ч refresh хийнэ. Амжилттай Accept/Revoke-ийн дараа checked refresh хийнэ.

## Тооцоолол ба шинэчлэлт

`receivedInvitations` нь authenticated user ID, email, `email_confirmed_at` шаардаж, email-ийг trim/lowercase болгож харьцуулна. `pendingInvitations` зөвхөн `status === "pending"` бөгөөд хүчинтэй `expires_at > Date.now()` мөрийг авна. Accepted, revoked, expired, declined болон үл мэдэгдэх статус тоологдохгүй. Declined статус одоогийн schema-д байхгүй ч pending-only шүүлтүүр нь ийм мөр ирвэл хасна.

Existing authenticated Supabase loadCloud, RLS болон account-scoped workspace cache-г ашиглана. Нэмэлт privileged query, notification table, service-role key, Realtime subscription байхгүй. Хуудас нээх нь урилгыг уншсан гэж тэмдэглэхгүй.

Existing 30 секундийн polling нь зөвхөн харагдаж буй, online workspace дээр ажиллана. Focus, online, visibilitychange болон route navigation үед sync хийнэ. Existing refresh queue нь зэрэг хүсэлтийг нэгтгэж, sync-д 5 секундийн cooldown хэрэглэнэ; mutation refresh заавал шинэ read хүлээнэ. Local expiry timer нь offline үед ч хугацаа дууссан урилгыг тооноос хасна. Account reset болон хуучин account-ын response хамгаалалтыг existing provider хариуцна.

Анхны load дуусаагүй үед count нь null. Refresh алдахад existing cache хадгалагдаж, badge-ийн accessible label болон Overview текст last known status гэж тэмдэглэнэ. Existing workspace error/retry UI хэвээр. Optional toast болон header bell нэмээгүй.

## Өөрчилсөн файлууд

- `src/lib/invitation-notifications.ts` — verified recipient, pending selector, count label.
- `src/components/invitation-notifications.tsx` — cache-derived hook, expiry timer, badge, Overview notice.
- `src/components/workspace-shell.tsx` — sidebar badge, navigation refresh.
- `src/components/projects.tsx` — Overview notice, invitation review/expiry/refresh.
- `src/app/precision.css` — responsive sage/forest notification styling.
- `tests/invitation-notifications.test.ts` — тоо, статус, email verification, account, expiry regression tests.
- `tests/browser/client-experience.js` — verified fixture users, notification fixtures.
- `tests/browser/client-components.test.mjs` — desktop/mobile/client notification assertions, diagnostic timeout context.
- `scripts/preview-client-experience.ps1` — шинэ компонентуудыг fixture bundle-д оруулав.
- `INVITATION-NOTIFICATIONS-STATUS.md` — энэ тайлан.

## Шалгалт

`npm run typecheck`, `npm test`, `npm run build` командыг оролдсон боловч shell-ийн npm/node PATH ажиллахгүй байв. Available Codex Node v24.22.1 болон суулгасан TypeScript executable ашиглан package scripts-ийн үндсэн командуудыг шууд ажиллуулсан.

- `tsc.exe --noEmit`: амжилттай.
- `node --import tsx --test --test-concurrency=1 tests/*.test.ts`: **153/153 passed**.
- Бүтэн test script, browser тестийг оролцуулсан: **153 passed, 1 failed**. Chrome CDP `Runtime.evaluate` эхний fixture navigation дээр timeout болсон; давтан ажиллуулахад мөн давтагдав. Notification browser assertions болон харагдацыг амжилттай гэж үзэхгүй.
- `node node_modules/next/dist/bin/next build`: амжилттай production build.
- Existing refresh queue tests нь request coalescing, cooldown, mutation-ийн дараах fresh read, account disposal, failed-read retry-г шалгасан. Hosted RLS болон бодит session lifecycle-г эдгээр тестээр баталгаажуулахгүй.

## Үлдсэн хязгаарлалт ба Decline санал

Одоогийн schema зөвхөн pending/accepted/revoked/expired статус болон Accept/Revoke RPC-тэй. Recipient Decline RPC байхгүй учир ажиллахгүй Decline товч эсвэл client-only төлөв нэмээгүй.

Зөвшөөрөл шаардлагатай backend санал: тусдаа additive migration-аар `declined` статус зөвшөөрч, verified recipient-only `decline_project_invitation` RPC нэмэх. RPC нь project/invitation lock order-ийг хадгалж, pending/non-expired нөхцөл шалгаж, membership эсвэл agreement өөрчлөхгүй; retry-г idempotent байлгаж, зөвхөн authenticated хэрэглэгчид execute эрх олгоно. Дараа нь existing review dialog-д Decline нэмээд checked refresh ашиглаж, disposable SQL болон хоёр account-ын live тестээр батална. **Энэ санал хэрэгжээгүй, migration үүсгээгүй/ажиллуулаагүй.**

Live хоёр account-ын RLS, Accept, logout/login, background/reconnect болон desktop/mobile visual QA үлдсэн. Polling учир шинэ урилга харагдах хүртэл ердийн нөхцөлд 30 секунд дээр хүсэлтийн хугацаа нэмэгдэж болно. Network error үед тоо last known статус байна.

Production data, RLS, migrations, OAuth/account session logic, membership, agreement, archive, PayPal өөрчлөөгүй. Commit, push, deploy хийгээгүй.
