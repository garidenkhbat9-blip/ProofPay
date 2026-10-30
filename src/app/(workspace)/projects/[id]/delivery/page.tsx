import { Suspense } from "react";
import { DeliveryPage } from "@/components/delivery";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="empty">Loading…</div>}>
      <DeliveryPage id={id} />
    </Suspense>
  );
}
