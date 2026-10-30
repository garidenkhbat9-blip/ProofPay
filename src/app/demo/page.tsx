import { Suspense } from "react";
import { DemoPage } from "@/components/demo";
import "./demo.css";
export default function Page() {
  return (
    <Suspense fallback={<div className="authloading">Loading preview…</div>}>
      <DemoPage />
    </Suspense>
  );
}
