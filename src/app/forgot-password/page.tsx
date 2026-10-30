import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export default function Page() {
  return (
    <Suspense fallback={<div className="authloading">Loading…</div>}>
      <AuthForm mode="forgot" />
    </Suspense>
  );
}
