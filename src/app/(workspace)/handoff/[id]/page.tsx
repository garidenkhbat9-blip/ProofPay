import { Suspense } from "react";
import { HandoffPage } from "@/components/delivery";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="empty">Loading…</div>}>
      <HandoffPage id={id} />
    </Suspense>
  );
}
