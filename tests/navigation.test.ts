import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExplorePage from "../src/app/explore/page";
import JudgeAccessPage from "../src/app/judge-access/page";
import JudgeWorkspacePage from "../src/app/judge-workspace/page";

test("Explore renders both normal login destinations and labels the separate simulation", () => {
  const html = renderToStaticMarkup(createElement(ExplorePage));
  for (const role of ["client", "freelancer"])
    assert.ok(html.includes(`/login?next=%2Fdashboard%3Fperspective%3D${role}`));
  assert.match(html, /Sign in with your own account/);
  assert.doesNotMatch(html, /matching dedicated account/);
  assert.match(html, /does not sign you in, switch accounts, or grant project access/);
  assert.match(html, /Simulated demo/);
  assert.doesNotMatch(html, /Judge Access|Judge guide|Your Sandbox project needs setup/);
});

test("legacy judge routes redirect to the canonical public entry and dashboard", async () => {
  assert.throws(() => JudgeAccessPage(), (error: unknown) =>
    (error as { digest?: string }).digest === "NEXT_REDIRECT;replace;/explore;307;");
  for (const perspective of ["client", "freelancer", "admin", undefined, ["client", "freelancer"]]) {
    const target = perspective === "client" || perspective === "freelancer"
      ? `/dashboard?perspective=${perspective}` : "/dashboard";
    await assert.rejects(JudgeWorkspacePage({ searchParams: Promise.resolve({ perspective }) }),
      (error: unknown) => (error as { digest?: string }).digest === `NEXT_REDIRECT;replace;${target};307;`);
  }
});
