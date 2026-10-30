import { Suspense } from "react";
import { ProjectOverview } from "@/components/projects";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="empty">Loading…</div>}>
      <ProjectOverview id={id} />
    </Suspense>
  );
}
