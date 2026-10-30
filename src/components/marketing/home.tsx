import Link from "next/link";
export function HomePage() {
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
      <section className={"showhero"}>
        <div className={"microtag"}>
          <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
            <path
              d={"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3M8 12l3 3 5-6"}
            ></path>
          </svg>
          {" THE TRUST LAYER FOR DIGITAL WORK"}
        </div>
        <h1>
          {"Great work deserves"}
          <br />
          <span>{"a clear agreement."}</span>
        </h1>
        <p>
          {"Agree on the work. Review the proof."}
          <br />
          {"Move forward with confidence, on both sides."}
        </p>
        <div className={"herobuttons"}>
          <Link className={"buttonlike forest"} href={"/signup"}>
            {"Get started "}
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path d={"M5 12h14M14 7l5 5-5 5"}></path>
            </svg>
          </Link>
          <Link className={"buttonlike quietbutton"} href={"/demo"}>
            {"Explore workspace "}
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path d={"M5 12h14M14 7l5 5-5 5"}></path>
            </svg>
          </Link>
        </div>
        <span className={"herotiny"}>
          {"One account. Client today, freelancer tomorrow."}
        </span>
        <div className={"hero-orbit"} aria-hidden={"true"}></div>
      </section>
      <section className={"showcase"}>
        <div className={"sectioncaption"}>
          <span>{"THE WORK, ALL IN ONE PLACE"}</span>
          <span>{"Illustrative product preview"}</span>
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
        <div className={"categorystrip"}>
          <span>{"Built around your deliverables"}</span>
          <div>
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path
                d={
                  "M3 12h18M12 3c-6 6-6 12 0 18 6-6 6-12 0-18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18"
                }
              ></path>
            </svg>
            {"Web development"}
          </div>
          <div>
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path d={"m12 3 9 9-9 9-9-9zM8 12h8"}></path>
            </svg>
            {"Graphic & UI design"}
          </div>
          <div>
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path d={"M3 5h13v14H3zM16 9l5-3v12l-5-3"}></path>
            </svg>
            {"Video & content"}
          </div>
        </div>
      </section>
      <section className={"featuresection"}>
        <div className={"centerheading"}>
          <span className={"microtag"}>{"A CLEARER WAY TO COLLABORATE"}</span>
          <h2>
            {"Less ambiguity."}
            <br />
            {"More shared understanding."}
          </h2>
          <p>{"Keep the brief, the work, and the decision connected."}</p>
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
        <Link className={"inlineaction"} href={"/product"}>
          {"Explore the product "}
          <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
            <path d={"M5 12h14M14 7l5 5-5 5"}></path>
          </svg>
        </Link>
      </section>
      <section className={"splitstory"}>
        <div>
          <div className={"eyebrow"}>{"ONE ACCOUNT. BOTH SIDES."}</div>
          <h2>
            {"Your role changes."}
            <br />
            {"Your workspace keeps up."}
          </h2>
          <p>
            {
              "Commission a website as a client. Deliver a brand identity as a freelancer. Each project has its own roles and responsibilities."
            }
          </p>
          <div className={"rolebuttons"}>
            <Link href={"/demo?role=client"} className={"buttonlike"}>
              {"Client preview "}
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12h14M14 7l5 5-5 5"}></path>
              </svg>
            </Link>
            <Link href={"/demo?role=freelancer"} className={"buttonlike"}>
              {"Freelancer preview "}
              <svg
                className={"icon"}
                viewBox={"0 0 24 24"}
                aria-hidden={"true"}
              >
                <path d={"M5 12h14M14 7l5 5-5 5"}></path>
              </svg>
            </Link>
          </div>
        </div>
        <div className={"rolescene"}>
          <div className={"roleperson"}>
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path
                d={"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3M8 12l3 3 5-6"}
              ></path>
            </svg>
            <strong>{"Your ProofPay account"}</strong>
            <small>{"One identity, every collaboration"}</small>
          </div>
          <div className={"rolecolumns"}>
            <div>
              <span className={"roleicon"}>{"C"}</span>
              <strong>{"Client"}</strong>
              <p>{"Create \u00b7 Review \u00b7 Approve"}</p>
              <span className={"smallstatus"}>{"Website launch"}</span>
            </div>
            <div>
              <span className={"roleicon"}>{"F"}</span>
              <strong>{"Freelancer"}</strong>
              <p>{"Accept \u00b7 Deliver \u00b7 Get paid"}</p>
              <span className={"smallstatus"}>{"Brand identity"}</span>
            </div>
          </div>
          <span className={"scenefoot"}>
            {"Roles belong to projects, not to your account."}
          </span>
        </div>
      </section>
      <section className={"homequestions"}>
        <div>
          <div className={"eyebrow"}>{"GOOD QUESTIONS. CLEAR ANSWERS."}</div>
          <h2>
            {"A little clarity"}
            <br />
            {"before you begin."}
          </h2>
          <Link className={"inlineaction"} href={"/faq"}>
            {"Read the FAQ "}
            <svg className={"icon"} viewBox={"0 0 24 24"} aria-hidden={"true"}>
              <path d={"M5 12h14M14 7l5 5-5 5"}></path>
            </svg>
          </Link>
        </div>
        <div>
          <article>
            <h3>{"Can I be both a client and a freelancer?"}</h3>
            <p>
              {
                "Yes. One account can have different roles in different projects. Switching the workspace view changes what you see, not your project permissions."
              }
            </p>
          </article>
          <article>
            <h3>{"Does approval mean the invoice is paid?"}</h3>
            <p>
              {
                "No. Work approval and payment are separate events. A payment is confirmed only from a verified payment-provider response."
              }
            </p>
          </article>
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
