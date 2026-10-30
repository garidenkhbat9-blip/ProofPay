"use client";
import Link from "next/link";
import {
  useEffect,
  useState,
  type FormEvent,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { safeReturn } from "@/lib/domain";
import { useWorkspace } from "./provider";
import { Icon, useTask, FormMessage } from "./ui";
import { PasswordField } from "./password-field";
import {
  authErrorMessage,
  validateAuthField,
  type AuthMode,
  type AuthField,
  type AuthErrors,
} from "@/lib/auth-validation";
export function AuthForm({ mode }: { mode: AuthMode }) {
  const { user, ready, authError, recovery } = useWorkspace(),
    router = useRouter(),
    params = useSearchParams();
  const task = useTask();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<AuthErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [role, setRole] = useState<"client" | "freelancer">("client");
  const destination = safeReturn(params.get("next"));
  const signup = mode === "signup",
    forgot = mode === "forgot",
    reset = mode === "reset";
  useEffect(() => {
    if (
      ready &&
      user &&
      !recovery &&
      (mode === "login" || mode === "signup") &&
      !window.location.hash.includes("type=recovery")
    ) {
      let pending: string | null = null;
      try {
        pending = sessionStorage.getItem("proofpay-next");
        sessionStorage.removeItem("proofpay-next");
      } catch {}
      router.replace(safeReturn(pending || destination));
    }
  }, [user, ready, recovery, mode, destination, router]);
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
    if (task.busy || submitted || !ready || authError) return;
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
    void task.run(async () => {
      if (reset && !user)
        throw new Error("Open the password reset link from your email first.");
      try {
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
              emailRedirectTo: location.origin + "/login",
            },
          });
          if (error) throw error;
          if (!data.session) {
            setMessage(
              "Check your inbox for a confirmation link. If you already have an account, sign in or reset your password.",
            );
          } else {
            setMessage("Account created. Opening your workspace…");
            setSubmitted(true);
          }
        } else if (forgot) {
          const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: location.origin + "/reset-password",
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
          router.replace("/dashboard");
        } else {
          const { error } = await client.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          setMessage("Signed in. Opening your workspace…");
          setSubmitted(true);
        }
      } catch (error) {
        throw new Error(authErrorMessage(error));
      }
    });
  }
  return (
    <div className="authpage">
      <header>
        <Link className="brand" href="/">
          <span className="brandmark">
            <Icon name="shield" />
          </span>
          ProofPay
        </Link>
        <Link href="/">Back to home →</Link>
      </header>
      <main className="authlayout">
        <section className="authstory">
          <div className="eyebrow">THE TRUST LAYER FOR DIGITAL WORK</div>
          <h1>
            Clear agreements.
            <br />
            Recorded decisions.
            <br />
            <span>Confident handoffs.</span>
          </h1>
          <p>
            Create projects as a client. Deliver as a freelancer.
            <br />
            Your role is defined in each project.
          </p>
        </section>
        <section className="authcard">
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
              ? "Choose how you'll use ProofPay."
              : forgot
                ? "We will email you a reset link."
                : reset
                  ? "Choose a password for your account."
                  : "Sign in to your workspace."}
          </p>
          <form onSubmit={submit} noValidate aria-busy={task.busy}>
            {signup && (
              <>
                <div className="role-picker">
                  <button
                    type="button"
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
                    aria-describedby={errors.full_name ? "name-error" : undefined}
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
            <button
              className="primary widebutton"
              type="submit"
              disabled={task.busy || submitted || !ready || !!authError}
            >
              {task.busy
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
          </form>
          {mode === "login" && (
            <Link className="authforgot" href="/forgot-password">
              Forgot password?
            </Link>
          )}
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
          <div className="authdivider">Explore without an account</div>
          <Link className="buttonlike widebutton" href="/demo">
            Open demo workspace →
          </Link>
        </section>
      </main>
    </div>
  );
}
