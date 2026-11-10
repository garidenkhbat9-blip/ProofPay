export type AuthMode = "login" | "signup" | "forgot" | "reset";
export type AuthField = "full_name" | "email" | "password";
export type AuthErrors = Partial<Record<AuthField, string>>;

export const MIN_PASSWORD_LENGTH = 8;

export function validateAuthField(
  field: AuthField,
  value: string,
  mode: AuthMode,
): string {
  if (field === "full_name") return value.trim() ? "" : "Enter your full name.";
  if (field === "email") {
    if (!value.trim()) return "Enter your email address.";
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
      ? ""
      : "Enter a valid email address, like name@example.com.";
  }
  if (!value) return "Enter your password.";
  return mode !== "login" && value.length < MIN_PASSWORD_LENGTH
    ? "Use at least 8 characters."
    : "";
}

export function authErrorMessage(error: unknown): string {
  const detail =
    typeof error === "object" && error !== null
      ? (error as { code?: string; message?: string; status?: number })
      : {};
  switch (detail.code) {
    case "invalid_credentials":
      return "The email or password is incorrect. Try again or reset your password.";
    case "email_exists":
    case "user_already_exists":
      return "If you already registered, sign in or reset your password. Otherwise check your confirmation email.";
    case "email_address_invalid":
    case "email_address_not_authorized":
      return "This email address cannot be used. Check it and try again.";
    case "email_not_confirmed":
      return "Confirm your email before signing in. Check your inbox for the confirmation link.";
    case "weak_password":
      return (
        detail.message ||
        "This password is too weak. Choose a different password with at least 8 characters."
      );
    case "same_password":
      return "Choose a password different from your current password.";
    case "over_request_rate_limit":
      return "Too many authentication attempts. Wait for the cooldown before trying again.";
    case "over_email_send_rate_limit":
      return "Too many verification emails requested. Wait before requesting another email, or sign in if already confirmed.";
    case "signup_disabled":
      return "Account creation is currently unavailable. Please try again later.";
    case "session_not_found":
    case "session_expired":
    case "otp_expired":
      return "This verification or reset link is invalid, expired or already used. Sign in if already confirmed, or request a new link.";
  }
  if (detail.status === 429)
    return "Too many attempts. Wait a few minutes, then try again.";
  return "We couldn't complete your request. Check your connection and try again.";
}
