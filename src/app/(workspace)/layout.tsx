import { WorkspaceShell } from "@/components/workspace-shell";
import { Suspense } from "react";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="authloading" role="status">Loading your workspace…</main>}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}
