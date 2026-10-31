import { Dashboard } from "@/components/projects";
import { judgeProjectIds } from "@/lib/judge-access";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Dashboard projectIds={judgeProjectIds(process.env.PROOFPAY_JUDGE_PROJECT_IDS)} />;
}
