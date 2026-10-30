import Link from "next/link";
export function ProductPage() {
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
        <div className={"microtag"}>{"THE PROOFPAY PRODUCT"}</div>
        <h1>
          {"One place for the brief,"}
          <br />
          <span>{"the proof, and the decision."}</span>
        </h1>
        <p>
          {"A shared workspace for the moments that matter"}
          <br />
          {"between starting a project and accepting the work."}
        </p>
        <Link className={"buttonlike forest"} href={"/explore"}>
          {"Explore ProofPay "}
          <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
            <path d={"M5 12h14M14 7l5 5-5 5"}></path>
          </svg>
        </Link>
      </section>
      <section className={"productpage-preview"}>
        <div className={"sectioncaption"}>
          <span>{"INSIDE THE WORKSPACE"}</span>
          <span>{"Illustrative example"}</span>
        </div>
        <div
          className={"productmock"}
          aria-label={"Illustrative project workflow"}
        >
          <aside className={"mocknav"}>
            <div>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path
                  d={"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3M8 12l3 3 5-6"}
                ></path>
              </svg>
              <b>{"ProofPay"}</b>
            </div>
            <span>{"Client workspace"}</span>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path
                  d={"M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"}
                ></path>
              </svg>
              {"Overview"}
            </p>
            <p className={"chosen"}>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M3 7V5h6l2 2h10v13H3z"}></path>
              </svg>
              {"Projects"}
            </p>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5"}></path>
              </svg>
              {"Reviews"}
            </p>
            <p>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M3 6h17v14H3zM3 6l13-3v3M15 11h6v5h-6z"}></path>
              </svg>
              {"Payments"}
            </p>
          </aside>
          <div className={"mockbody"}>
            <div className={"mockbreadcrumb"}>
              {"Projects "}
              <span>{"/"}</span>
              {" Website launch "}
              <span className={"mockexample"}>{"Example"}</span>
            </div>
            <div className={"mocktitle"}>
              <div>
                <span className={"eyebrow"}>{"PROJECT WORKSPACE"}</span>
                <h3>{"Website launch"}</h3>
                <p>{"A shared definition of done."}</p>
              </div>
              <span className={"badge review"}>
                {"Awaiting client approval"}
              </span>
            </div>
            <div className={"mocktabs"}>
              <span>{"Overview"}</span>
              <span className={"selected"}>{"Milestones"}</span>
              <span>{"Agreement"}</span>
              <span>{"Activity"}</span>
            </div>
            <div className={"mocktable"}>
              <div className={"mocktablerow mocktablehead"}>
                <span>{"Milestone"}</span>
                <span>{"Evidence"}</span>
                <span>{"Status"}</span>
              </div>
              <div className={"mocktablerow"}>
                <span>
                  <i>{"01"}</i>
                  {"Scope & agreement"}
                </span>
                <span>{"Agreed requirements"}</span>
                <span className={"mockstatus done"}>{"Agreed"}</span>
              </div>
              <div className={"mocktablerow"}>
                <span>
                  <i>{"02"}</i>
                  {"Frontend delivery"}
                </span>
                <span>{"Link + test report"}</span>
                <span className={"mockstatus waiting"}>{"In review"}</span>
              </div>
              <div className={"mocktablerow"}>
                <span>
                  <i>{"03"}</i>
                  {"Final handoff"}
                </span>
                <span>{"Source + assets"}</span>
                <span className={"mockstatus"}>{"Upcoming"}</span>
              </div>
            </div>
            <div className={"mockdecision"}>
              <span>
                <svg
                  className={"icon"}
                  viewBox={"0 0 24 24"}
                  aria-hidden={"true"}
                >
                  <path d={"M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5"}></path>
                </svg>
                {"Evidence informs the decision. The client approves."}
              </span>
              <span>
                {"Review work "}
                <svg
                  className={"icon"}
                  viewBox={"0 0 24 24"}
                  aria-hidden={"true"}
                >
                  <path d={"M5 12h14M14 7l5 5-5 5"}></path>
                </svg>
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className={"featuresection"}>
        <div className={"centerheading"}>
          <div className={"eyebrow"}>{"BUILT AROUND THE HANDOFF"}</div>
          <h2>{"Every part has a purpose."}</h2>
        </div>
        <div className={"featurebento"}>
          <article className={"bentocard agreement-bento"}>
            <div className={"bentohead"}>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5"}></path>
              </svg>
              <div>
                <h3>{"Agree on what done means."}</h3>
                <p>{"Turn a loose brief into measurable expectations."}</p>
              </div>
            </div>
            <div className={"agreementpaper"}>
              <div>
                <span className={"eyebrow"}>{"ACCEPTANCE CRITERIA"}</span>
                <span className={"smallstatus"}>{"Example draft"}</span>
              </div>
              <p>
                <span>{"01"}</span>
                {"Navigation opens at 375 px width"}
                <i>
                  <svg
                    className={"icon"}
                    viewBox={"0 0 24 24"}
                    aria-hidden={"true"}
                  >
                    <path d={"M5 12l4 4L19 6"}></path>
                  </svg>
                </i>
              </p>
              <p>
                <span>{"02"}</span>
                {"Contact form shows a confirmation"}
                <i>
                  <svg
                    className={"icon"}
                    viewBox={"0 0 24 24"}
                    aria-hidden={"true"}
                  >
                    <path d={"M5 12l4 4L19 6"}></path>
                  </svg>
                </i>
              </p>
              <p>
                <span>{"03"}</span>
                {"Source files included in delivery"}
                <i>
                  <svg
                    className={"icon"}
                    viewBox={"0 0 24 24"}
                    aria-hidden={"true"}
                  >
                    <path d={"M5 12l4 4L19 6"}></path>
                  </svg>
                </i>
              </p>
              <div className={"paperfoot"}>
                {"Clear requirements. Fewer surprises."}
              </div>
            </div>
          </article>
          <article className={"bentocard evidence-bento"}>
            <div className={"bentohead"}>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path
                  d={"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3M8 12l3 3 5-6"}
                ></path>
              </svg>
              <div>
                <h3>{"Proof behind every decision."}</h3>
                <p>{"Trace a requirement to the evidence that supports it."}</p>
              </div>
            </div>
            <div className={"evidencevisual"}>
              <span className={"evidencenode"}>
                <svg
                  className={"icon"}
                  viewBox={"0 0 24 24"}
                  aria-hidden={"true"}
                >
                  <path d={"M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5"}></path>
                </svg>
                {"Requirement"}
              </span>
              <span className={"evidenceline"}></span>
              <span className={"evidencecore"}>
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
              <span className={"evidenceline"}></span>
              <span className={"evidencenode"}>
                <svg
                  className={"icon"}
                  viewBox={"0 0 24 24"}
                  aria-hidden={"true"}
                >
                  <path d={"M5 12l4 4L19 6"}></path>
                </svg>
                {"Evidence"}
              </span>
            </div>
            <div className={"evidencecaption"}>
              <span>{"PASS"}</span>
              <span>{"FAIL"}</span>
              <span>{"CANNOT VERIFY"}</span>
            </div>
            <p className={"bentofine"}>
              {"Planned verification model \u00b7 live runners not connected"}
            </p>
          </article>
          <article className={"bentocard role-bento"}>
            <div className={"bentohead"}>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M3 7V5h6l2 2h10v13H3z"}></path>
              </svg>
              <div>
                <h3>{"Two perspectives. One place."}</h3>
                <p>{"Stay focused on your role in each project."}</p>
              </div>
            </div>
            <div className={"perspectivevisual"}>
              <div>
                <span className={"roleicon"}>{"C"}</span>
                <strong>{"Client workspace"}</strong>
                <small>{"Review the work."}</small>
              </div>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path
                  d={
                    "M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2M14 11a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2"
                  }
                ></path>
              </svg>
              <div>
                <span className={"roleicon"}>{"F"}</span>
                <strong>{"Freelancer workspace"}</strong>
                <small>{"Deliver with clarity."}</small>
              </div>
            </div>
          </article>
          <article className={"bentocard payment-bento"}>
            <div className={"bentohead"}>
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M3 6h17v14H3zM3 6l13-3v3M15 11h6v5h-6z"}></path>
              </svg>
              <div>
                <h3>{"Approval is a milestone."}</h3>
                <p>{"Keep work approval separate from payment status."}</p>
              </div>
            </div>
            <div className={"invoicevisual"}>
              <div>
                <span>
                  <svg
                    className={"icon"}
                    viewBox={"0 0 24 24"}
                    aria-hidden={"true"}
                  >
                    <path d={"M5 12l4 4L19 6"}></path>
                  </svg>
                  {"Work approved"}
                </span>
                <b>{"Client decision"}</b>
              </div>
              <div>
                <span>
                  <svg
                    className={"icon"}
                    viewBox={"0 0 24 24"}
                    aria-hidden={"true"}
                  >
                    <path d={"M3 6h17v14H3zM3 6l13-3v3M15 11h6v5h-6z"}></path>
                  </svg>
                  {"Invoice payment"}
                </span>
                <b>{"Separate confirmation"}</b>
              </div>
            </div>
            <p className={"bentofine"}>
              {"PayPal integration planned \u00b7 no funds held in escrow"}
            </p>
          </article>
        </div>
      </section>
      <section className={"capabilitysection"}>
        <div>
          <div className={"eyebrow"}>{"WHERE WE ARE TODAY"}</div>
          <h2>
            {"A working preview."}
            <br />
            {"A clear path forward."}
          </h2>
          <p>
            {
              "We distinguish what you can try today from the services still being connected."
            }
          </p>
        </div>
        <div className={"capabilitytable"}>
          <div>
            <strong>{"Project workspace & role views"}</strong>
            <span className={"ready"}>{"Available in local preview"}</span>
          </div>
          <div>
            <strong>{"Briefs, submissions & human review"}</strong>
            <span className={"ready"}>{"Available in local preview"}</span>
          </div>
          <div>
            <strong>{"Accounts & shared database"}</strong>
            <span className={""}>{"Connection pending"}</span>
          </div>
          <div>
            <strong>{"AI agreements & automated evidence"}</strong>
            <span className={""}>{"In development"}</span>
          </div>
          <div>
            <strong>{"PayPal invoices & payment sync"}</strong>
            <span className={""}>{"In development"}</span>
          </div>
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
