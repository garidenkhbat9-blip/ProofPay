import { Suspense } from "react";
import { AgreementPage } from "@/components/agreement";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="empty">Loading…</div>}>
      <AgreementPage id={id} />
    </Suspense>
  );
}
