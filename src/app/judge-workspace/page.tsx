import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { legacyJudgeDestination } from "@/lib/judge-access";

export const metadata: Metadata = {
  title: "Your workspace",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ perspective?: string | string[] }>;
}) {
  const params = await searchParams;
  redirect(legacyJudgeDestination(params.perspective));
}
