import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/provider";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./precision.css";
import "./workspace.css";
export const metadata: Metadata = {
  title: { default: "ProofPay — Work, with proof.", template: "%s · ProofPay" },
  description:
    "Agree on work, deliver evidence, review milestones. One account for clients and freelancers.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
