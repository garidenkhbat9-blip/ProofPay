import Link from "next/link";
export function HowPage() {
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
          <Link className={"buttonlike forest"} href={"/explore"}>
            {"Explore ProofPay "}
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path d={"M5 12h14M14 7l5 5-5 5"}></path>
            </svg>
          </Link>
        </div>
      </header>
      <section className={"pagehero"}>
        <span className={"microtag"}>{"HOW IT WORKS"}</span>
        <h1>
          {"A clear path."}
          <br />
          <span>{"From brief to handoff."}</span>
        </h1>
        <p>
          {"Four steps. Shared expectations."}
          <br />
          {"A human decision where it matters."}
        </p>
      </section>
      <section className={"workflowstory"}>
        <article className={"workflowstep"}>
          <div className={"stepnumber"}>{"01"}</div>
          <div className={"workflowcopy"}>
            <span className={"smalllabel"}>{"Client + freelancer"}</span>
            <h2>{"Agree before you begin."}</h2>
            <p>
              {
                "Define the deliverables, deadlines and measurable acceptance criteria. Both sides should know exactly what will be reviewed."
              }
            </p>
          </div>
          <div className={"workflowexample"}>
            <div className={"eyebrow"}>{"Agreement \u00b7 ILLUSTRATIVE"}</div>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12l4 4L19 6"}></path>
              </svg>
              {"Mobile menu opens at 375 px"}
            </p>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12l4 4L19 6"}></path>
              </svg>
              {"Contact form confirms submission"}
            </p>
            <small>{"Signed agreement versions are planned."}</small>
          </div>
        </article>
        <article className={"workflowstep"}>
          <div className={"stepnumber"}>{"02"}</div>
          <div className={"workflowcopy"}>
            <span className={"smalllabel"}>{"Freelancer"}</span>
            <h2>{"Deliver the work, with context."}</h2>
            <p>
              {
                "Submit the deliverable link, assets and handoff notes. Connect each requirement to the evidence a reviewer needs."
              }
            </p>
          </div>
          <div className={"workflowexample"}>
            <div className={"eyebrow"}>{"Submission \u00b7 ILLUSTRATIVE"}</div>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12l4 4L19 6"}></path>
              </svg>
              {"Deliverable link"}
            </p>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12l4 4L19 6"}></path>
              </svg>
              {"Handoff notes & supporting files"}
            </p>
            <small>
              {
                "Links and notes work in the local preview; file uploads are not connected."
              }
            </small>
          </div>
        </article>
        <article className={"workflowstep"}>
          <div className={"stepnumber"}>{"03"}</div>
          <div className={"workflowcopy"}>
            <span className={"smalllabel"}>{"Client"}</span>
            <h2>{"Review evidence. Make a decision."}</h2>
            <p>
              {
                "Compare the work with the agreed requirements. Approve it or request specific changes. Automated results support your judgment."
              }
            </p>
          </div>
          <div className={"workflowexample"}>
            <div className={"eyebrow"}>
              {"Evidence review \u00b7 ILLUSTRATIVE"}
            </div>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12l4 4L19 6"}></path>
              </svg>
              {"Requirement \u2192 observed result"}
            </p>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12l4 4L19 6"}></path>
              </svg>
              {"Client approval or revision request"}
            </p>
            <small>
              {
                "Human review is available locally. Automated checks are not connected."
              }
            </small>
          </div>
        </article>
        <article className={"workflowstep"}>
          <div className={"stepnumber"}>{"04"}</div>
          <div className={"workflowcopy"}>
            <span className={"smalllabel"}>{"Client + freelancer"}</span>
            <h2>{"Confirm payment separately."}</h2>
            <p>
              {
                "After approval, move to an invoice. A confirmed payment status must come from the payment provider, separate from work approval."
              }
            </p>
          </div>
          <div className={"workflowexample"}>
            <div className={"eyebrow"}>{"Payment \u00b7 ILLUSTRATIVE"}</div>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12l4 4L19 6"}></path>
              </svg>
              {"Work approved \u2260 invoice paid"}
            </p>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12l4 4L19 6"}></path>
              </svg>
              {"Verified provider confirmation"}
            </p>
            <small>
              {
                "PayPal is not connected. ProofPay does not represent invoicing as escrow."
              }
            </small>
          </div>
        </article>
      </section>
      <section className={"workflowprinciple"}>
        <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
          <path
            d={"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3M8 12l3 3 5-6"}
          ></path>
        </svg>
        <div>
          <h3>{"AI explains. Tests provide evidence. People approve."}</h3>
          <p>
            {
              "Missing evidence must stay \u201cCannot verify.\u201d It must never become an invented pass or an automatic payment."
            }
          </p>
        </div>
      </section>
      <section className={"marketingcta"}>
        <span className={"microtag"}>{"START WITH CLARITY"}</span>
        <h2>
          {"Make the next handoff"}
          <br />
          {"a better one."}
        </h2>
        <Link href={"/explore"} className={"buttonlike forest"}>
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
          <Link href={"/explore"}>{"Explore ProofPay"}</Link>
          <Link href={"/demo"}>{"Simulated demo"}</Link>
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
