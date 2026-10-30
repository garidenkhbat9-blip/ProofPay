import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>Page not found</h1>
      <p>This address is not available.</p>
      <Link className="buttonlike" href="/">
        Back to ProofPay
      </Link>
    </main>
  );
}
