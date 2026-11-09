"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { projectWaiting } from "@/lib/project-waiting";
import "@/app/project-waiting.css";

export function ProjectWaiting({
  model,
  stale = false,
}: {
  model: NonNullable<ReturnType<typeof projectWaiting>>;
  stale?: boolean;
}) {
  const steps = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash === "#project-waiting" && steps.current) steps.current.open = true;
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [model]);
  if (model.archived || model.unavailable) return null;
  const date = (value: string) =>
    new Date(value).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC";
  return (
    <section
      className="waiting-workspace"
      id="project-waiting"
      tabIndex={-1}
      aria-label="Project timeline and help"
    >
      {stale && (
        <p role="status">
          Last known records. Reconnect or refresh before acting; the other
          participant may already have responded.
        </p>
      )}
      {!!model.items.length && <details className="waiting-steps" ref={steps}>
      <summary>Timeline & next steps ({model.items.length})</summary>
      <div className="waiting-rows">
        {model.items.map((item) => (
          <article
            key={item.id}
            className={
              item.attention ? "waiting-row needs-attention" : "waiting-row"
            }
          >
            <div className="waiting-obligation">
              <small>{item.title}</small>
              <h3>{item.state}</h3>
              <p>
                Next: <strong>{item.actor}</strong>
              </p>
            </div>
            <div className="waiting-context">
              <p>{item.instruction}</p>
              <p className="waiting-time">
                {item.since ? (
                  <>
                    {item.sinceLabel}{" "}
                    <time dateTime={item.since}>{date(item.since)}</time>
                  </>
                ) : (
                  "Waiting start not recorded"
                )}
              </p>
              <p className="waiting-deadline">{item.dateNote}</p>
            </div>
            <Link className="waiting-record" href={item.recordHref}>
              {item.recordLabel} <span aria-hidden="true">↗</span>
            </Link>
          </article>
        ))}
      </div>
      </details>}
      {!!model.items.length && (
        <details className="waiting-resolve">
          <summary>
            Need help with a delay?
          </summary>
          <div className="waiting-recovery-grid">
            <div>
              <h3>Request an update</h3>
              <p>{model.reminders.message}</p>
              <p>
                Contact the other participant through your shared channel and keep a copy.
              </p>
              <p>
                If there is no response, preserve the records and refer to your
                agreement’s escalation terms. ProofPay has no active dispute or
                cancellation process.
              </p>
            </div>
            <div>
              <h3>
                {model.canManageInvitation
                  ? "An unaccepted invitation"
                  : "Protect the agreed work"}
              </h3>
              {model.canManageInvitation ? (
                <>
                  <p>
                    You can revoke a pending invitation or invite again. An accepted contract cannot be cancelled here.
                  </p>
                  <Link href={model.setupHref}>
                    Manage invitation ↗
                  </Link>
                </>
              ) : (
                <p>
                  An accepted freelancer cannot be replaced through an
                  invitation. Inactivity never cancels the contract or settles
                  unpaid work.
                </p>
              )}
              {model.hasAgreement && (
                <>
                  <h3>Need a different deadline?</h3>
                  <p>
                    {model.role === "client"
                      ? "Review the existing agreement before discussing a new timeline."
                      : "Ask the client about a new timeline through your shared contact channel."}{" "}
                    Agreed dates stay unchanged until a new agreement version is
                    accepted by both participants.
                  </p>
                  <p>
                    A new version supersedes the current one and blocks delivery
                    until both accept. Existing submissions and payments stay
                    with their original terms.
                  </p>
                  {model.hasHistory && (
                    <p>
                      Existing delivery or financial history needs an explicit
                      amendment plan. A one-click deadline extension is not
                      supported.
                    </p>
                  )}
                  <Link href={model.setupHref}>
                    Review agreement & version history ↗
                  </Link>
                </>
              )}
              <p>
                Archive is limited to eligible unshared drafts, not
                accepted-contract cancellation. No timeout triggers approval,
                payment or reassignment.
              </p>
            </div>
          </div>
        </details>
      )}
      <details className="waiting-activity">
        <summary>
          Project activity{" "}
          <span>
            {model.events[0]
              ? `Last recorded: ${date(model.events[0].at)}`
              : "No timestamped events available"}
          </span>
        </summary>
        <ol>
          {model.events.map((e) => (
            <li key={e.id}>
              <time dateTime={e.at}>{date(e.at)}</time>
              <Link href={e.href}>{e.text}</Link>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
