import Link from "next/link";
export function FaqPage() {
  return (
    <div className={"marketing"}>
      <header className={"marketingnav"}>
        <Link className={"brand"} href={"/"}>
          <span className={"brandmark"}>
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path
                d={"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3M8 12l3 3 5-6"}
              ></path>
            </svg>
          </span>
          {"ProofPay"}
        </Link>
        <nav aria-label={"Main navigation"}>
          <Link href={"/"}>{"Home"}</Link>
          <Link href={"/product"}>{"Product"}</Link>
          <Link href={"/how-it-works"}>{"How it works"}</Link>
          <Link href={"/faq"}>{"FAQ"}</Link>
        </nav>
        <div className={"navaccount"}>
          <Link href={"/login"}>{"Sign in"}</Link>
          <Link className={"buttonlike forest"} href={"/signup"}>
            {"Get started "}
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path d={"M5 12h14M14 7l5 5-5 5"}></path>
            </svg>
          </Link>
        </div>
      </header>
      <section className={"pagehero"}>
        <span className={"microtag"}>{"FREQUENTLY ASKED QUESTIONS"}</span>
        <h1>
          {"Good questions."}
          <br />
          <span>{"Straight answers."}</span>
        </h1>
        <p>
          {"What ProofPay does, how the roles work,"}
          <br />
          {"and what is available in the current preview."}
        </p>
      </section>
      <section className={"faqcontent"}>
        <aside>
          <span className={"eyebrow"}>{"A LITTLE MORE CLARITY"}</span>
          <h2>
            {"Before your"}
            <br />
            {"next project."}
          </h2>
          <p>
            {"Start with the product."}
            <br />
            {"Then explore the workspace."}
          </p>
          <Link className={"inlineaction"} href={"/product"}>
            {"View the product "}
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path d={"M5 12h14M14 7l5 5-5 5"}></path>
            </svg>
          </Link>
        </aside>
        <div className={"faqlist"}>
          <details open={true}>
            <summary>
              {"Can I be both a client and a freelancer?"}
              <span aria-hidden={"true"}>{"+"}</span>
            </summary>
            <p>
              {
                "Yes. One account can have different roles in different projects. Switching the workspace view changes what you see, not your project permissions."
              }
            </p>
          </details>
          <details>
            <summary>
              {"Does approval mean the invoice is paid?"}
              <span aria-hidden={"true"}>{"+"}</span>
            </summary>
            <p>
              {
                "No. Work approval and payment are separate events. A payment is confirmed only from a verified payment-provider response."
              }
            </p>
          </details>
          <details>
            <summary>
              {"What can I try right now?"}
              <span aria-hidden={"true"}>{"+"}</span>
            </summary>
            <p>
              {
                "Signed-in accounts can create project briefs and in-app invitations. Versioned agreements and milestone acceptance are available after database setup. Verification and payments are not connected yet."
              }
            </p>
          </details>
          <details>
            <summary>
              {"Is automated AI verification running?"}
              <span aria-hidden={"true"}>{"+"}</span>
            </summary>
            <p>
              {
                "Not yet. Playwright, Lighthouse and AI evidence analysis are planned integrations. The current preview does not run these tools or invent verification results."
              }
            </p>
          </details>
          <details>
            <summary>
              {"Can I create a real account?"}
              <span aria-hidden={"true"}>{"+"}</span>
            </summary>
            <p>
              {
                "Yes. Email signup and sign-in use Supabase. Confirm your email before signing in. The separate demo does not create an account."
              }
            </p>
          </details>
          <details>
            <summary>
              {"Are invitations emailed to freelancers?"}
              <span aria-hidden={"true"}>{"+"}</span>
            </summary>
            <p>
              {
                "Email delivery is not connected yet. Clients can create an in-app invitation for an email address. The recipient signs in with that verified email and accepts from Invitations."
              }
            </p>
          </details>
          <details>
            <summary>
              {"What kind of work is supported?"}
              <span aria-hidden={"true"}>{"+"}</span>
            </summary>
            <p>
              {
                "The MVP focuses on website development. The structure also includes graphic design and video work, with category-specific verification planned."
              }
            </p>
          </details>
          <details>
            <summary>
              {"Does ProofPay hold money in escrow?"}
              <span aria-hidden={"true"}>{"+"}</span>
            </summary>
            <p>
              {
                "No. The planned PayPal invoicing flow is an invoice and payment workflow, not an escrow service. No live payment processing is connected in this preview."
              }
            </p>
          </details>
        </div>
      </section>
      <section className={"marketingcta"}>
        <span className={"microtag"}>{"START WITH CLARITY"}</span>
        <h2>
          {"Make the next handoff"}
          <br />
          {"a better one."}
        </h2>
        <Link href={"/signup"} className={"buttonlike forest"}>
          {"Get started "}
          <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
            <path d={"M5 12h14M14 7l5 5-5 5"}></path>
          </svg>
        </Link>
        <p>
          {
            "Explore the workspace preview while live integrations are in development."
          }
        </p>
      </section>
      <footer className={"marketingfooter"}>
        <div>
          <Link className={"brand"} href={"/"}>
            <span className={"brandmark"}>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path
                  d={"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3M8 12l3 3 5-6"}
                ></path>
              </svg>
            </span>
            {"ProofPay"}
          </Link>
          <p>
            {"Clear expectations."}
            <br />
            {"Confident handoffs."}
          </p>
        </div>
        <div>
          <strong>{"Explore"}</strong>
          <Link href={"/product"}>{"Product"}</Link>
          <Link href={"/how-it-works"}>{"How it works"}</Link>
          <Link href={"/faq"}>{"FAQ"}</Link>
        </div>
        <div>
          <strong>{"Workspace"}</strong>
          <Link href={"/demo"}>{"Open preview"}</Link>
          <Link href={"/login"}>{"Sign in"}</Link>
          <Link href={"/signup"}>{"Create account"}</Link>
        </div>
        <div className={"footerstatus"}>
          <span className={"microtag"}>
            <i className={"dot"}></i>
            {" IN DEVELOPMENT"}
          </span>
          <p>
            {"Explore the interactive preview."}
            <br />
            {"AI verification and payments are not connected."}
          </p>
        </div>
        <div className={"footerbase"}>
          <span>{"\u00a9 2026 ProofPay AI"}</span>
          <span>{"Clear agreements. Recorded decisions."}</span>
        </div>
      </footer>
    </div>
  );
}
