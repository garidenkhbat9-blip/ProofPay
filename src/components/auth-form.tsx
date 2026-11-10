"use client";
import { Brand } from "@/components/brand";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { safeReturn } from "@/lib/domain";
import { judgeDestination, entryPerspective } from "@/lib/judge-access";
import { authenticationReturn, needsAccountConfirmation } from "@/lib/auth-navigation";
import { useWorkspace } from "./provider";
import { Icon, useTask, FormMessage } from "./ui";
import { PasswordField } from "./password-field";
import { GoogleAuthButton } from "./google-sign-in";
import { ReviewerSignIn } from "./reviewer-sign-in";
import { authCooldown, deferAuth } from "@/lib/auth-cooldown";
import {
  authErrorMessage,
  validateAuthField,
  type AuthMode,
  type AuthField,
  type AuthErrors,
} from "@/lib/auth-validation";
export function AuthForm({ mode }: { mode: AuthMode }) {
  const { user, ready, authError, recovery, signOut } = useWorkspace(),
    router = useRouter(),
    params = useSearchParams();
  const task = useTask();
  const [googlePending, setGooglePending] = useState(false);
  const [emailCode, setEmailCode] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const requestLock = useRef(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { const timer = setInterval(() => setCooldown(authCooldown()), 1000); return () => clearInterval(timer); }, []);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<AuthErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmedAccount, setConfirmedAccount] = useState<string | null>(null);
  const requestedDestination = safeReturn(params.get("next"));
  const requestedRole = entryPerspective(requestedDestination);
  const judge = !!requestedRole;
  const [role, setRole] = useState<"client" | "freelancer">(
    requestedRole || "client",
  );
  const signup = mode === "signup",
    forgot = mode === "forgot",
    reset = mode === "reset";
  const destination =
    signup ? judgeDestination(role) : requestedDestination;
  useEffect(() => {
    if (
      ready &&
      user &&
      !recovery &&
      (mode === "login" || mode === "signup") &&
      !window.location.hash.includes("type=recovery")
    ) {
      if (needsAccountConfirmation(destination, user.id, submitted, confirmedAccount)) return;
      let pending: string | null = null;
      try {
        pending = sessionStorage.getItem("proofpay-next");
        sessionStorage.removeItem("proofpay-next");
      } catch {}
      router.replace(
        authenticationReturn(params.has("next") ? destination : null, pending || destination),
      );
    }
  }, [user, ready, recovery, mode, destination, params, router, judge, submitted, confirmedAccount]);
  function validateInput(
    event: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>,
  ) {
    const { name, value } = event.currentTarget;
    const field = name as AuthField;
    setErrors((current) => ({
      ...current,
      [field]: validateAuthField(field, value, mode),
    }));
  }
  function changeInput(event: ChangeEvent<HTMLInputElement>) {
    task.clearError();
    setMessage("");
    const field = event.currentTarget.name as AuthField;
    if (errors[field] || (field === "password" && (signup || reset))) {
      validateInput(event);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (googlePending || requestLock.current || authCooldown() || task.busy || submitted || pendingEmail || !ready || authError) return;
    const form = e.currentTarget,
      f = new FormData(form);
    const fields: AuthField[] = [
      ...(signup ? ["full_name" as const] : []),
      ...(!reset ? ["email" as const] : []),
      ...(!forgot ? ["password" as const] : []),
    ];
    const nextErrors: AuthErrors = {};
    for (const field of fields) {
      nextErrors[field] = validateAuthField(
        field,
        String(f.get(field) || ""),
        mode,
      );
    }
    setErrors(nextErrors);
    setMessage("");
    task.clearError();
    const firstInvalid = fields.find((field) => nextErrors[field]);
    if (firstInvalid) {
      (form.elements.namedItem(firstInvalid) as HTMLInputElement)?.focus();
      return;
    }
    requestLock.current = true;
    void task.run(async () => {
      try {
        if (reset && !user) throw new Error("Open the password reset link from your email first.");
        const client = getSupabase(),
          email = String(f.get("email") || "").trim(),
          password = String(f.get("password") || "");
        setMessage("");
        if (signup) {
          const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: String(f.get("full_name")).trim(),
                preferred_workspace: role,
              },
              emailRedirectTo:
                location.origin +
                "/auth/confirm",
            },
          });
          if (error) throw error;
          if (!data.session) {
            setPendingEmail(email);
            deferAuth(); setCooldown(authCooldown());
            setMessage(
              "Check your inbox for a confirmation link. If you already have an account, sign in or reset your password.",
            );
          } else {
            const verified = await client.auth.getUser();
            if (verified.error || verified.data.user?.id !== data.session.user.id || !verified.data.user.email_confirmed_at) throw Error("Account verification failed. Sign in again.");
            setMessage("Account created. Opening your workspace…");
            setSubmitted(true);
          }
        } else if (forgot) {
          const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: location.origin + "/reset-password" + (params.has("next") ? "?next=" + encodeURIComponent(destination) : ""),
          });
          if (error) throw error;
          setMessage(
            "If an account exists, a reset link has been sent. Check your inbox.",
          );
        } else if (reset) {
          const { error } = await client.auth.updateUser({ password });
          if (error) throw error;
          setMessage("Password updated. Opening your workspace…");
          setSubmitted(true);
          router.replace(destination);
        } else {
          const { data: signedIn, error } = await client.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          setMessage("Signed in. Opening your workspace…");
          const verified = await client.auth.getUser();
          if (verified.error || !verified.data.user?.email_confirmed_at || verified.data.user.id !== signedIn.user?.id) throw Error("Confirm your email before signing in.");
          setSubmitted(true);
        }
      } catch (error) {
        throw new Error(authErrorMessage(error));
      } finally {
        requestLock.current = false;
        setCooldown(authCooldown());
      }
    });
  }
  return (
    <div className={`authpage auth-polished ${signup ? "auth-signup" : "auth-signin"}`}>
      <header>
        <Brand />
        <Link href="/">Back to home →</Link>
      </header>
      <main className="authlayout">
        <section className="authstory">
          <div className="eyebrow">THE TRUST LAYER FOR DIGITAL WORK</div>
          <h1>
            Proof the work.
            <br />
            Build the trust.
            <br />
            <span>Pay with confidence.</span>
          </h1>
          <p>
            Create projects as a client. Deliver as a freelancer.
            <br />
            Your role is defined in each project.
          </p>
          <ol className="auth-principles">
            <li>
              <span>01</span>Agree on a measurable outcome
            </li>
            <li>
              <span>02</span>Review the evidence together
            </li>
            <li>
              <span>03</span>Approve work before requesting payment
            </li>
          </ol>
          <Link className="auth-judge-link" href="/explore">
            Explore ProofPay <span aria-hidden="true">↗</span>
          </Link>
        </section>
        <section className="authcard">
          {params.has("oauth_error") && <p role="alert">{params.get("oauth_error") === "profile" ? "Your account profile could not be loaded. Contact support or retry sign-in." : "Google sign-in was cancelled or could not be confirmed. Start again; your previous account has not been used as a substitute."}</p>}
          {pendingEmail ? <>
            <h2>Check your email</h2>
            <p>Registration was submitted for {pendingEmail}. Email verification is pending. If you already registered, sign in instead of creating another account.</p>
            <p><Link href={"/login?next=" + encodeURIComponent(destination)}>Already confirmed? Sign in.</Link></p>
            <FormMessage error={task.error} /><p role="status">{message}</p>
            <button disabled={task.busy || cooldown > 0} onClick={() => {
              if (requestLock.current || authCooldown()) return;
              requestLock.current = true; deferAuth(); setCooldown(authCooldown());
              void task.run(async () => { try {
                const { error } = await getSupabase().auth.resend({ type: "signup", email: pendingEmail, options: { emailRedirectTo: location.origin + "/auth/confirm" } });
                if (error) throw Error(authErrorMessage(error));
                setMessage("If confirmation is still required, a new email has been requested. Check your inbox.");
              } finally { requestLock.current = false; setCooldown(authCooldown()); } });
            }}>{cooldown ? `Resend available in ${cooldown}s` : "Resend confirmation"}</button>
          </> : ready && user && !recovery && !submitted && (mode === "login" || signup) ? (
            <>
              <div className="auth-judge-context"><Icon name="shield" /><span>Explore ProofPay · {requestedRole === "client" ? "Client" : "Freelancer"} workspace</span></div>
              <h2>Confirm your account</h2>
              <p>Signed in as <strong className="account-email">{user.email || "your current account"}</strong>.</p>
              <p>Continue to the {requestedRole === "client" ? "Client" : "Freelancer"} view with this account, or sign in with another account. Your project access stays the same.</p>
              <FormMessage error={task.error} />
              <div className="account-entry-actions">
                <button className="primary widebutton" disabled={task.busy} onClick={() => setConfirmedAccount(user.id)}>Continue with this account</button>
                <button className="widebutton" disabled={task.busy} onClick={() => void task.run(() => signOut(destination))}>Sign in with a different account</button>
                <Link href="/dashboard">Back to my workspace</Link>
              </div>
              <div className="authdivider">or switch with Google</div>
              <p className="auth-quiet">Google sign-in replaces the account in this browser.</p>
              <GoogleAuthButton intent={signup ? role : requestedRole} disabled={task.busy || submitted || !ready} onBusy={setGooglePending} />
            </>
          ) : <>
          {judge && (
            <div className="auth-judge-context">
              <Icon name="shield" />
              <span>
                Explore ProofPay ·{" "}
                {(signup ? role : requestedRole) === "freelancer"
                  ? "Freelancer"
                  : "Client"}{" "}
                view
              </span>
            </div>
          )}
          <h2>
            {signup
              ? "Create your account"
              : forgot
                ? "Reset your password"
                : reset
                  ? "Choose a new password"
                  : "Welcome back"}
          </h2>
          <p>
            {signup
              ? "A clear start for your next collaboration."
              : forgot
                ? "We will email you a reset link."
                : reset
                  ? "Choose a password for your account."
                  : judge
                    ? `Sign in to continue to your ${requestedRole === "client" ? "Client" : "Freelancer"} workspace.`
                    : "Sign in to your workspace."}
          </p>
          {mode === "login" && <button type="button" disabled={task.busy || codeBusy || googlePending || submitted || !ready} onClick={() => setEmailCode(!emailCode)}>{emailCode ? "Use email and password" : "Sign in without a password"}</button>}
          {mode === "login" && emailCode ? <ReviewerSignIn destination={destination} disabled={!ready || !!authError || googlePending || submitted} cooldown={cooldown} onBusy={setCodeBusy} onVerified={() => setSubmitted(true)} /> : <form onSubmit={submit} noValidate aria-busy={task.busy}>
            {signup && (
              <>
                <div className="role-picker" role="group" aria-label="How will you use ProofPay?">
                  <button
                    type="button"
                    aria-pressed={role === "client"}
                    disabled={task.busy || submitted}
                    className={`role-card ${role === "client" ? "selected" : ""}`}
                    onClick={() => setRole("client")}
                  >
                    <div className="role-icon">
                      <Icon name="briefcase" />
                    </div>
                    <strong>I{"'"}m hiring</strong>
                    <span>Post projects & review work</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={role === "freelancer"}
                    disabled={task.busy || submitted}
                    className={`role-card ${role === "freelancer" ? "selected" : ""}`}
                    onClick={() => setRole("freelancer")}
                  >
                    <div className="role-icon">
                      <Icon name="user" />
                    </div>
                    <strong>I{"'"}m freelancing</strong>
                    <span>Accept jobs & deliver work</span>
                  </button>
                </div>
                <div className="authfield">
                  <label className="formlabel" htmlFor="full_name">
                    Full name
                  </label>
                  <input
                    className="field"
                    id="full_name"
                    name="full_name"
                    autoComplete="name"
                    required
                    maxLength={120}
                    disabled={task.busy || submitted}
                    aria-invalid={!!errors.full_name}
                    aria-describedby={
                      errors.full_name ? "name-error" : undefined
                    }
                    onChange={changeInput}
                    onBlur={validateInput}
                  />
                  <p
                    id="name-error"
                    className="authhint is-error"
                    aria-live="polite"
                  >
                    {errors.full_name}
                  </p>
                </div>
              </>
            )}
            {!reset && (
              <div className="authfield">
                <label className="formlabel" htmlFor="email">
                  Email address
                </label>
                <input
                  className="field"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={task.busy || submitted}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  onChange={changeInput}
                  onBlur={validateInput}
                />
                <p
                  id="email-error"
                  className="authhint is-error"
                  aria-live="polite"
                >
                  {errors.email}
                </p>
              </div>
            )}
            {!forgot && (
              <PasswordField
                newPassword={signup || reset}
                label={reset ? "New password" : "Password"}
                error={errors.password}
                disabled={task.busy || submitted}
                onChange={changeInput}
                onBlur={validateInput}
              />
            )}
            <FormMessage
              error={
                task.error ||
                (authError
                  ? "Authentication is currently unavailable. Refresh the page and try again."
                  : "")
              }
            />
            <p role="status" className="authmessage">
              {message}
            </p>
            {mode === "login" && <Link className="authforgot" href={"/forgot-password?next=" + encodeURIComponent(destination)}>Forgot password?</Link>}
            <button
              className="primary widebutton"
              type="submit"
              disabled={googlePending || task.busy || submitted || !ready || !!authError || cooldown > 0}
            >
              {cooldown > 0 ? `Try again in ${cooldown}s` : task.busy
                ? signup
                  ? "Creating account…"
                  : forgot
                    ? "Sending link…"
                    : reset
                      ? "Saving password…"
                      : "Signing in…"
                : submitted
                  ? "Opening workspace…"
                  : !ready
                    ? "Getting ready…"
                    : signup
                      ? "Create account"
                      : forgot
                        ? "Send reset link"
                        : reset
                          ? "Save password"
                          : "Sign in"}
            </button>
          </form>}
          {(mode === "login" || signup) && <>
            <div className="authdivider">{signup ? "or sign up with" : "or continue with"}</div>
            <GoogleAuthButton intent={signup ? role : requestedRole} disabled={task.busy || codeBusy || submitted || !ready} onBusy={setGooglePending} />
          </>}
          <p className="authalternate">
            {signup ? "Already have an account?" : "New to ProofPay?"}{" "}
            <Link
              href={
                (signup ? "/login" : "/signup") +
                "?next=" +
                encodeURIComponent(destination)
              }
            >
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
          {signup && <p className="auth-quiet">You can hire and freelance with the same account.</p>}
          <footer className="auth-demo-footer"><span>Just looking around?</span> <Link href="/demo">Explore the simulated demo <span aria-hidden="true">→</span></Link></footer>
          </>}
        </section>
      </main>
    </div>
  );
}
