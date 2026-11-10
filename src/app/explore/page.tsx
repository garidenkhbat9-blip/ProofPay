import { Brand } from "@/components/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { judgeDestination } from "@/lib/judge-access";

export const metadata: Metadata = {
  title: "Explore ProofPay",
  description:
    "Experience ProofPay with your own authenticated account and designated Sandbox projects.",
};

export default function ExplorePage() {
  return (
    <div className="judge-page">
      <a className="skip-link" href="#judge-main">
        Skip to content
      </a>
      <header className="judge-header">
        <Brand />
        <Link href="/how-it-works">
          How it works <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main id="judge-main" className="judge-main">
        <div className="judge-intro">
          <h1>
            Explore <span>ProofPay</span>
          </h1>
          <h2>Choose your perspective</h2>
          <p>
            Choose how you want to start, then sign in with Google or email.
          </p>
        </div>
        <div className="judge-choices">
          {(["client", "freelancer"] as const).map((role, i) => (
            <Link
              key={role}
              id={role}
              className="judge-choice"
              aria-labelledby={`${role}-title ${role}-continue`}
              aria-describedby={`${role}-description explore-auth-note`}
              href={`/login?next=${encodeURIComponent(judgeDestination(role))}`}
            >
              <div className="judge-choice-top">
                <span className="judge-icon">
                  <Icon name={role === "client" ? "briefcase" : "user"} />
                </span>
                <span className="judge-index">0{i + 1}</span>
              </div>
              <h2 id={`${role}-title`}>
                {role === "client" ? "Client" : "Freelancer"}
              </h2>
              <p id={`${role}-description`}>
                {role === "client"
                  ? "Review agreements, inspect submitted work, and approve milestones."
                  : "Review invitations and agreements, submit evidence, and track payment status."}
              </p>
              <div
                className="perspective-preview"
                aria-label={`${role === "client" ? "Client" : "Freelancer"} workflow preview`}
              >
                <span className="perspective-preview-label">
                  YOUR SIDE OF THE WORKFLOW
                </span>
                {(role === "client"
                  ? [
                      "Define the outcome",
                      "Review the evidence",
                      "Record your decision",
                    ]
                  : [
                      "Align on the scope",
                      "Deliver with evidence",
                      "Track every milestone",
                    ]
                ).map((step, index) => (
                  <div key={step}>
                    <span className="perspective-step">0{index + 1}</span>
                    <span>{step}</span>
                    <Icon
                      name={
                        index === 0 ? "report" : index === 1 ? "link" : "check"
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="judge-choice-bottom">
                <span id={`${role}-continue`}>
                  Continue as {role === "client" ? "Client" : "Freelancer"}
                </span>
                <span aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="judge-access-note">
          <Icon name="shield" />
          <p id="explore-auth-note">
            Sign in with your own account. Choosing a workspace does not sign
            you in, switch accounts, or grant project access.
          </p>
        </div>
        <section className="judge-guide" aria-labelledby="judge-guide-title">
          <h2 id="judge-guide-title">Real work. A considered workflow.</h2>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Agree on the outcome</strong>
                <p>
                  Versioned scope and milestones. AI drafting when configured;
                  both people decide.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Review the proof</strong>
                <p>
                  Submitted files, links and revision history. Evidence review
                  stays with the client.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Pay with confidence</strong>
                <p>
                  PayPal Sandbox invoices after approval and merchant setup.
                  Test payments only.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <p className="judge-footnote">
          Prepared projects require an organizer invitation. Automated evidence
          verification is not connected. Approval is not payment.
        </p>
      </main>
      <footer className="judge-footer">
        <span>ProofPay · Work, with proof.</span>
        <Link href="/demo">
          Simulated demo <span aria-hidden="true">↗</span>
        </Link>
      </footer>
    </div>
  );
}
