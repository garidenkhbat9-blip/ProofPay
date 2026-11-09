"use client";
import Link from "next/link";
import { useWorkspace } from "./provider";
import { Heading, EmptyState, FormMessage, useTask } from "./ui";
import { memberRole, money } from "@/lib/domain";
import { PaymentWorkspace } from "./payments";
import { workspaceIdentity } from "@/lib/workspace-onboarding";
import { getSupabase } from "@/lib/supabase";
import { saveWorkspacePreference } from "@/lib/workspace-preference";
export function SettingsPage() {
  const { user, data, signOut, perspective, setPerspective } = useWorkspace(),
    task = useTask();
  return (
    <>
      <Heading title="Account" />
      <section className="card">
        <h2>{workspaceIdentity(user, data.profiles).displayName}</h2>
        <p>{user?.email}</p>
        <FormMessage error={task.error} />
        <label htmlFor="account-workspace">Workspace view</label>
        <select id="account-workspace" value={perspective} disabled={task.busy || !user} onChange={event => {
          const role = event.target.value === "freelancer" ? "freelancer" : "client";
          void task.run(async () => {
            if (!user) return;
            await saveWorkspacePreference(getSupabase(), user.id, role);
            setPerspective(role);
          });
        }}><option value="client">Client</option><option value="freelancer">Freelancer</option></select>
        <p>Saved for your account. Switching views does not change project memberships.</p>
        <button disabled={task.busy} onClick={() => void task.run(signOut)}>
          Sign out
        </button>
      </section>
      <section className="card">
        <h2>Connections</h2>
        <p>
          Your account gives you access only to projects you create or join.
        </p>
        <p>
          Gemini helps draft website agreements and review supported text evidence. You review its suggestions; both participants accept the agreement.
        </p>
        <p>Automated website verification is not connected. PayPal Sandbox invoicing requires a verified freelancer merchant connection.</p>
      </section>
    </>
  );
}
export function PaymentsPage() {
  return <PaymentWorkspace />;
}
export function ActivityPage() {
  const { data, user, perspective, refresh } = useWorkspace();
  const ids = new Set(
    data.projects
      .filter((p) => memberRole(data, p.id, user?.id) === perspective)
      .map((p) => p.id),
  );
  const events = [
    ...data.agreements
      .filter((a) => ids.has(a.project_id))
      .map((a) => ({
        id: "a" + a.id,
        at: a.created_at,
        text: `Agreement version ${a.version} created`,
        href: "/projects/" + a.project_id + "/agreement?version=" + a.id,
      })),
    ...data.submissions
      .filter((s) => ids.has(s.project_id) && s.submitted_at)
      .map((s) => ({
        id: "s" + s.id,
        at: s.submitted_at!,
        text: `Revision ${s.revision} submitted`,
        href: "/handoff/" + s.link_id,
      })),
    ...data.reviews.flatMap((r) => {
      const s = data.submissions.find(
        (s) => s.id === r.submission_id && ids.has(s.project_id),
      );
      return s
        ? [
            {
              id: "r" + r.id,
              at: r.created_at,
              text:
                r.decision === "approved"
                  ? "Milestone approved"
                  : "Changes requested",
              href: "/handoff/" + s.link_id,
            },
          ]
        : [];
    }),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return (
    <>
      <Heading
        title="Activity"
        subtitle="Recent agreement and delivery records."
      />
      <div className={events.length ? "delivery-list" : undefined}>
        {events.map((e) => (
          <Link className="delivery-row" key={e.id} href={e.href}>
            <div>
              <h3>{e.text}</h3>
              <p>{new Date(e.at).toLocaleString()}</p>
            </div>
            <span>→</span>
          </Link>
        ))}
        {!events.length && <EmptyState icon="clock" title={data.agreementError || data.deliveryError ? "Activity unavailable." : "No activity recorded yet."}
          description={data.agreementError || data.deliveryError ? "Some agreement or delivery records could not be loaded. Refresh to check the actual history." : "Saved agreement versions, submitted revisions and client review decisions appear here as they happen."}>
          {data.agreementError || data.deliveryError ? <button onClick={() => void refresh()}>Refresh workspace</button> : <Link className="buttonlike forest" href="/projects">{perspective === "client" ? "View projects" : "View my jobs"} →</Link>}
        </EmptyState>}
      </div>
    </>
  );
}
