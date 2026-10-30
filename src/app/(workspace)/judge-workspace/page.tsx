import type { Metadata } from "next";
import { JudgeWorkspace } from "@/components/judge-workspace";
import { judgeProjectIds, judgeRole } from "@/lib/judge-access";

export const metadata: Metadata = {
  title: "Judge Workspace",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ perspective?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <JudgeWorkspace
      projectIds={judgeProjectIds(process.env.PROOFPAY_JUDGE_PROJECT_IDS)}
      initialRole={judgeRole(params.perspective)}
    />
  );
}
