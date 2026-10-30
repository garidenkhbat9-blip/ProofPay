"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Could not open this page</h1>
      <p>Please retry. Your saved work remains in Supabase.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
