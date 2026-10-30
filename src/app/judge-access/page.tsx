import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { judgeDestination } from "@/lib/judge-access";

export const metadata: Metadata = {
  title: "Judge Access",
  description:
    "Experience ProofPay with your own authenticated account and designated Sandbox projects.",
};

export default function JudgeAccessPage() {
  return (
    <div className="judge-page">
      <a className="skip-link" href="#judge-main">
        Skip to content
      </a>
      <header className="judge-header">
        <Link className="brand" href="/">
          <span className="brandmark">
            <Image src="/logo.png" alt="" width={38} height={38} />
          </span>
          ProofPay
        </Link>
        <Link href="/login">
          Sign in <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main id="judge-main" className="judge-main">
        <div className="judge-intro">
          <span className="judge-eyebrow">
            PAYPAL AI HACKATHON 2026 <span aria-hidden="true">/</span> JUDGE
            ACCESS
          </span>
          <h1>
            Experience <span>ProofPay.</span>
          </h1>
          <p>
            Clear agreements. Evidence you can review.
            <br />A confident next step, on both sides of the work.
          </p>
        </div>
        <div className="judge-choices">
          {(["client", "freelancer"] as const).map((role, i) => (
            <Link
              key={role}
              className="judge-choice"
              href={`/login?next=${encodeURIComponent(judgeDestination(role))}`}
            >
              <div className="judge-choice-top">
                <span className="judge-icon">
                  <Icon name={role === "client" ? "briefcase" : "user"} />
                </span>
                <span className="judge-index">0{i + 1}</span>
              </div>
              <span className="judge-eyebrow">
                {role === "client" ? "BRING THE VISION" : "DELIVER THE WORK"}
              </span>
              <h2>Continue as {role === "client" ? "Client" : "Freelancer"}</h2>
              <p>
                {role === "client"
                  ? "Create milestones, review evidence, and manage payments."
                  : "Accept agreements, submit proof, and manage invoices."}
              </p>
              <div className="judge-choice-bottom">
                <span>Enter authenticated workspace</span>
                <span aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="judge-access-note">
          <Icon name="shield" />
          <p>
            Sign in with your own judge account, or create one using the email
            invited by the organizer. Your selection changes the workspace view;
            project membership determines your permissions.
          </p>
        </div>
        <section className="judge-guide" aria-labelledby="judge-guide-title">
          <div>
            <span className="judge-eyebrow">
              A CLEAR PATH FROM WORK TO PAYMENT
            </span>
            <h2 id="judge-guide-title">Real work. A considered workflow.</h2>
          </div>
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
        <section className="judge-demo">
          <div>
            <span className="judge-eyebrow">JUST LOOKING AROUND?</span>
            <h2>Take the guided demo.</h2>
            <p>A separate, simulated walkthrough. No account or payments.</p>
          </div>
          <Link className="buttonlike" href="/demo">
            Explore simulated demo <span aria-hidden="true">→</span>
          </Link>
        </section>
        <p className="judge-footnote">
          Prepared projects require an organizer invitation. Automated evidence
          verification is not connected. Approval is not payment.
        </p>
      </main>
      <footer className="judge-footer">
        <span>ProofPay · Work, with proof.</span>
        <Link href="/how-it-works">
          How it works <span aria-hidden="true">↗</span>
        </Link>
      </footer>
    </div>
  );
}
