# ProofPay төслийн workflow — 2026-11-07

Application-ийн өөрчлөлтүүдийг хэрэгжүүлж, локал орчинд шалгав. **Archive/reopen нь бодит database-д идэвхжээгүй: шинэ migration 006-г эзэмшигч зөвшөөрч, backend-д байршуулсны дараа ажиллана.** Migration байхгүй үед UI тодорхой шалтгаантайгаар хаалттай үлдэнэ. Database-д өөрчлөлт оруулах зөвшөөрөл шаардлагатай байсан нь бусад UI/API/test ажлыг зогсоогоогүй.

## 1. Илэрсэн үндсэн шалтгаанууд

- Өмнөх archive dialog зориудаар disabled байсан. Migration 001 нь зөвхөн project brief-ийн таван талбарт UPDATE эрх өгсөн; status өөрчлөх эрх, archive/reopen RPC болон түүнийг дуудах API байгаагүй. Зөвхөн frontend товч нээх боломжгүй байв.
- Одоо байгаа `archived` төлөв invitation, agreement acceptance, delivery/review болон шинэ invoice бэлтгэх урсгалыг хориглодог. Иймээс хамтран ажиллаж буй, эсвэл төлбөрийн түүхтэй төслийг архивлах нь одоогийн бизнес дүрэмд аюулгүй биш.
- Migration 002 freelancer нэгдээгүй үед immutable agreement draft үүсгэхийг дэмждэг. Харин UI үүнийг ерөнхий “Create agreement” гэж нэрлэж, draft болон acceptance-ийн ялгааг тайлбарлаагүй.
- Workflow guidance нь milestone бүрийн delivery/review/payment-ийг тусад нь бүрэн тооцохгүй, бодит payment төлөв workspace-д ачаалагддаггүй байсан. Archive төсвийг active planned budget-аас тусгаарлаагүй байв.
- Dashboard sidebar-ийн навигацийг shortcut мөрөөр давтсан; хэд хэдэн хоосон хуудас дараагийн үйлдэл, шаардлагатай оролцогч болон prerequisite-ээ тайлбарлаагүй.

Эдгээр дүгнэлт нь бодит source болон migrations 001–005-г харьцуулсан үр дүн. Live schema-ийн яг ижил хувилбар байршуулсныг энэ ажлаар батлаагүй.

## 2. Хэрэгжүүлсэн өөрчлөлтүүд

- Project list, dashboard project row болон detail action menu-д Archive/Reopen; төслийн нэртэй confirmation; API-аас бодит eligibility татах; ineligible үед тодорхой шалтгаан ба шаардлагатай холбоос.
- Давхар click, хуучирсан revision, алдагдсан response, confirmed mutation-ийн дараах refresh failure-ийг тусад нь боловсруулна. Батлагдсан үйлдлийг дахин явуулахгүй; refresh-only сонголт үзүүлнэ.
- Шинэ SQL нь зөвхөн unshared `draft` төслийг архивлана. Unsigned agreement, milestones, criteria, revoked/expired invitations хадгалагдана. Pending invitation, freelancer/accepted invitation, agreement approval, delivery link/evidence, payment/history байвал хориглоно. Санхүүгийн түүхтэй дууссан төсөл ч одоогийн хувилбарт ineligible.
- Archived төсөл All/Archived жагсаалтад харагдана; active count, actionable delivery totals болон active planned budget-д орохгүй. Зөвхөн шинэ RPC-ийн audit provenance-тай eligible archive-ийг draft болгон буцаан нээдэг.
- “Create agreement draft”, draft-before-assignment тайлбар, scope/deliverables/milestones/amount/acceptance болон “acceptance does not trigger payment” copy нэмсэн. Revoked, expired, pending урилга болон бодит membership-ийг ялган харуулна. Accepted invitation байгаа ч membership байхгүй бол дахин урьсан мэт харагдуулахгүй, refresh шаардлагатайг мэдэгдэнэ.
- Team → Agreement → Delivery → Review → Approval → Payment reusable guidance нь бодит membership, latest immutable version, milestones, хоёр талын acceptance, latest revisions болон зөвшөөрөгдсөн payment fields-ээс Complete/Current/Blocked/Not started төлөв гаргана. Нэг milestone ирсэн нь бүх delivery дууссан гэсэн үг биш.
- Approval нь payment гэж тооцогдохгүй. Payment complete болохын тулд тохирох agreement/submission/milestone дээр `PAID`, verification timestamp болон `SYNCED` байх ёстой. Тэг дүнтэй ажилд “No payment required” гэж үзүүлнэ.
- Agreement, Delivery, Reviews, Payments, Activity-д жижиг icon, тодорхой гарчиг, role-specific тайлбар ба тохирох action нэмсэн. Empty list-ийн илүүдэл хүрээ/blank panel-ийг арилгасан. Activity-д зохиомол event нэмээгүй.
- Dashboard-ийн давхардсан horizontal shortcuts-ийг арилгаж, next action-ийг тэргүүнд тавьсан. Client review, delivery, agreement, invitation гэсэн actionable эрэмбэ болон бусад төслийн үйлдлийг дэлгэх хэсэгтэй. Sidebar, mobile menu, New project, project tabs болон автомат tour хадгалагдсан.
- Forest green, sage, white өнгө, одоо байгаа font/token-ууд хадгалагдсан. Next.js React application хэвээр; mock renderer нэмээгүй. Fixture data зөвхөн tests болон ignored `.validation/` дотор ашиглагдана.

## 3. Өөрчилсөн файлууд

Энэ task-ийн гол файлуудыг доор бүлэглэв. Working tree-д өмнөх Gemini, evidence assistant, payment claim, onboarding болон marketing өөрчлөлтүүд байсан; тэдгээрийг буцаагаагүй, энэ ажлын шинэ үр дүн гэж тооцоогүй.

| Хэсэг | Файлууд |
| --- | --- |
| Archive backend, client request, dialog | `migrations/006_project_archive.sql`, `src/app/api/projects/[id]/archive/route.ts`, `src/lib/project-archive.ts`, `src/components/project-actions.tsx` |
| Workflow, invitation, totals | `src/lib/project-workflow.ts`, `src/lib/agreement-guidance.ts`, `src/lib/project-management.ts`, `src/lib/workspace-onboarding.ts`, `src/components/project-next-step.tsx` |
| Workspace data ба confirmed refresh | `src/lib/types.ts`, `src/lib/cloud.ts`, `src/components/provider.tsx` |
| Screens, shared empty state, navigation | `src/components/projects.tsx`, `agreement.tsx`, `delivery.tsx`, `payments.tsx`, `account.tsx`, `ui.tsx`, `workspace-shell.tsx`, `dashboard-tour.tsx`, `src/app/workspace.css` |
| Unit/API tests | `tests/project-archive-api.test.ts`, `tests/project-guidance.test.ts`, `tests/project-management.test.ts`, `tests/cloud.test.ts` |
| SQL fixtures | `tests/sql/project-archive.sql`, `tests/sql/project-retention.sql`, `tests/sql/evidence-authorization.sql`, `scripts/test-sql.mjs` |
| Browser/production checks | `tests/browser/client-experience.js`, `tests/browser/client-components.test.mjs`, `scripts/preview-client-experience.ps1`, `scripts/http-smoke.mjs` |
| Баримтжуулалт | `PROJECT-LIFECYCLE-PROPOSAL.md`, `PROJECT-WORKFLOW-STATUS.md`, `README.md`, `CLIENT-EXPERIENCE-STATUS.md`, `HACKATHON-PROGRESS.md` |

Хэрэглэгдэхээ больсон, Delete/Archive үргэлж unavailable буцаадаг presentation helper болон түүний хуучин тестийг бодит archive implementation-ээр сольсон. Байнгын Delete үйлдэл нэмээгүй.

## 4. Security ба authorization

- API болон database RPC хоёул verified identity + client membership + `created_by` owner-ийг шалгана. UI perspective, forged owner ID болон browser arrays эрх олгохгүй.
- API нь caller bearer/RLS context ашиглана; service-role lifecycle endpoint байхгүй. Cross-origin, буруу action/UUID/revision, хэт том JSON-ийг хүлээн авахгүй. Database-ийн дотоод diagnostics хэрэглэгчид задрахгүй.
- RPC project мөрийг `FOR UPDATE` түгжиж, eligibility-ийг transaction дотор дахин шалгана. Revision болон request UUID нь stale/double/retry хүсэлтийг хамгаална. Хожуу ирсэн хуучин archive retry нь reopened төслийг дахин архивлахгүй.
- Шинэ audit хүснэгтийн SELECT нь member RLS-тэй; authenticated INSERT/UPDATE/DELETE эрх өгөөгүй. Existing project status дээр browser UPDATE эрх нэмээгүй. SECURITY DEFINER functions нь fixed empty search_path, fully-qualified references болон explicit execute grants/revocations-тай.
- Agreement version/acceptance, evidence immutability/review, PayPal authorization/merchant/lease/webhook protections өөрчлөгдөөгүй. Collaboration болон financial түүхийг шинэ archive SQL устгахгүй, засахгүй. Shared project-ийг архивлахыг хааснаар ongoing work тасалдахгүй.

## 5. Ажиллуулсан шалгалтууд

| Команд / шалгалт | Бодит үр дүн |
| --- | --- |
| `npm run typecheck` | PASS, TypeScript алдаагүй |
| `npm test` | PASS: 136 tests, 136 pass, 0 fail, 0 skipped |
| Chrome component coverage, full test suite-д багтсан | PASS: desktop 46, mobile 47, 320px narrow 47 assertion; нийт 15 viewport/scenario; Tab/Escape/focus шалгалт |
| `npm run test:components` | Тусад нь мөн PASS болсон; эцсийн component coverage нь `npm test`-ээр дахин ажилласан |
| `npm run test:sql` | PASS: fresh in-memory PostgreSQL дээр 001–006 compile; payment authorization, evidence authorization, retention, archive гэсэн 4 fixture; rollback баталгаажсан |
| `npm run build` | PASS: production compilation, TypeScript, 24/24 static pages; archive API route build-д багтсан |
| `node scripts/http-smoke.mjs` | PASS: 22 HTTP check, хоёр Explore link; archive-ийн unsigned/cross-origin denial; өөрийн эхлүүлсэн server зогссон |
| `git diff --check` | PASS; existing LF/CRLF conversion notices нь whitespace error биш |
| Lint | Lint script/configuration байхгүй тул ажиллуулсан гэж тайлагнаагүй |

Chrome дээр actual React components-ийг isolated Auth/data/router adapters-тай ажиллуулсан. Desktop dashboard, mobile detail/agreement/delivery/activity, empty payments-ийн screenshot-уудыг хараад шалгасан; artifacts `.validation/client-experience/` дотор. Эдгээр нь live authenticated Next.js E2E биш. 320/390/568/768/1440px нөхцөлд responsive overflow болон mobile tour шалгагдсан.

SQL тест нь Supabase Auth/Storage-ийн минимал локал stub ашигладаг. Hosted service/RLS parity, олон бодит DB connection-ийн зэрэгцээ ажиллагаа болон жинхэнэ файл upload-ийг энэ тест батлахгүй. Эхний шалгалтаар гарсан TypeScript query typing, browser fixture-ийн stale render хүлээлт, expired invitation fixture-ийн date constraint асуудлыг зассаны дараах дээрх pass үр дүнг тайлагнав.

## 6. Зөвшөөрөл шаардлагатай database санал

[006_project_archive.sql](migrations/006_project_archive.sql)-д `archived_at`, `archive_revision`, append-only `project_archive_events`, eligibility/read RPC болон archive/reopen RPC бэлдсэн. Existing migrations 001–005-г өөрчлөөгүй, дахин ажиллуулаагүй. SQL зөвхөн шинэ temporary in-memory database дээр тестлэгдсэн.

[PROJECT-LIFECYCLE-PROPOSAL.md](PROJECT-LIFECYCLE-PROPOSAL.md)-д eligibility matrix, migration бүртэй харьцуулалт, RLS/RPC/grant, data impact, lock order болон rollback limitations бүрэн бий. Owner approval авсны дараа administrator live schema-тай харьцуулж 006-г нэг удаа deploy хийх ёстой. 006 нь 001–004 дээр тулгуурладаг; шаардлагатай payment tables байхгүй бол feature fail-closed байна. Өмнөх 005 payment proposal-ийг archive approval-аар автоматаар зөвшөөрсөн гэж үзэхгүй.

Rollback хийхдээ history/columns устгахгүй, old migrations дахин ажиллуулахгүй. Шинэ forward-only change-аар RPC write capability-г хаах эсвэл зөвшөөрөгдсөн reopen ашиглана. Legacy архивыг нийтээр нь draft болгохгүй.

## 7. Үлдсэн blockers ба хязгаарлалтууд

- **Owner approval болон backend deployment хүртэл бодит archive/reopen ажиллагаа blocked.** UI missing RPC үед үүнийг шууд тайлбарлана; fake success байхгүй.
- Deployed schema/RLS/RPC-ийн яг хувилбар, боломжит нэмэлт obligation tables-ийг administrator батлах шаардлагатай.
- Хоёр тусдаа test account-аар hosted Auth/RLS/private upload/review болон бүрэн Next.js browser QA хийгдээгүй.
- Хоёр бодит PostgreSQL connection ашигласан archive-vs-invite/accept зэрэгцээ тест pending. Локал тест sequential competing outcomes, revisions болон retry-ийг баталсан.
- Хамтын ажил эхэлсэн болон санхүүгийн түүхтэй төслийн archive нь зориудаар unsupported. Шинэ тусдаа бизнес дүрэм батлагдтал аюулгүйгээр хаалттай байна.
- Existing PayPal Sandbox merchant/setup болон 005-ын өмнөх approval gate хэвээр. Энэ ажил live/Sandbox transaction хийгээгүй, payment record өөрчлөөгүй.

## 8. Client / Freelancer manual QA

Зориулалтын test accounts, test projects ашиглана. Archive mutation алхмуудыг зөвхөн owner-approved staging backend дээр ажиллуулна.

1. **Client, шинэ project:** dashboard-ийн New project → brief үүсгэх. Team current, Agreement/Delivery blocked; “Invite a freelancer to continue.”, “Create agreement draft” харагдах. Draft-ийг freelancer-гүй хадгалж болох ч acceptance боломжгүй байх.
2. **Invitation:** Invite CTA project team рүү очих; valid pending invitation “waiting” төлөвтэй. Revoke → revoked, хугацаа дууссан test invitation → expired; эдгээрийг assigned freelancer гэж харуулахгүй. Pending invitation байхад archive тодорхой reason-оор хаагдах.
3. **Freelancer, тусдаа browser profile:** зөв invited email-аар нэвтрэх → Invitations → accept. Membership үүсэх; client-only draft/archive actions freelancer-д харагдахгүй. Perspective солих нь нэмэлт эрх өгөхгүй.
4. **Agreement:** client milestones/criteria/amount оруулж version үүсгэх; хоёр тал latest version-ийг accept хийх. Нэг тал accept хийсэн үед delivery blocked; шинэ version гарахад өмнөх acceptance үйлчлэхгүй. Milestones байхгүй legacy fixture нь шинэ version нэмэх заавартай байх.
5. **Delivery/review:** client submission link үүсгэх; freelancer URL/test file submit хийх. Client review CTA гарч, evidence/criteria-г шалган changes request хийх; freelancer шинэ revision илгээх. Хуучин evidence хэвээр үлдэх. Client approval хийсний дараа Payments тусдаа шат хэвээр; approval нь `PAID` болохгүй.
6. **Payment page:** approved milestone-ийн invoice/setup state бодит backend-тай нийцэх; budget нь collected revenue гэж харагдахгүй. Энэ QA-д invoice send, checkout payment, real record modification хийх шаардлагагүй.
7. **Archive, eligible client:** unshared draft + unsigned agreement + revoked/expired invite → project actions → нэртэй confirmation → archive. Active count/budget буурах, Archived filter-д харагдах, agreement/milestones/invitations хэвээр байх. Reopen → draft ба active totals сэргэх. Legacy archive болон shared/delivery/payment history дээр reason-оор хаагдах.
8. **Retry/stale:** хоёр tab ижил draft нээж нэгээр archive; нөгөө хуучин dialog-ийн request stale болох. Давхар click нэг event үүсгэх. Response/refresh тасалдсан нөхцөлд хуурамч success эсвэл давхар archive үүсэхгүй; confirmed state хадгалагдан refresh-only боломжтой байх.
9. **Unauthorized:** өөр client болон freelancer guessed project ID/archive API/RPC-г дуудахад хориглох; unrelated project/audit/evidence уншигдахгүй. Нэвтрээгүй болон cross-origin хүсэлтүүд татгалзах.
10. **UX:** Overview/Agreement/Delivery tabs, sidebar/mobile menu, keyboard focus, 320px/mobile/desktop-ийг шалгах. Empty Reviews/Payments/Activity зөв role copy ба ажилладаг links-тэй; dashboard нэг гол next action болон бусад actions-ийг харуулах.

Эцсийн diff-ийг шалгав: энэ task-ийн хүрээнд хамааралгүй ажилладаг feature устгаагүй; PayPal болон evidence assistant-ийн өмнөх өөрчлөлтүүдийг хадгалсан. Database migration, payment, hard delete, commit, push эсвэл deployment хийгээгүй. Existing Sites deployment хэвээр.
