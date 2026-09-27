"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>We couldn’t open this page.</h1>
      <p>Your saved answers are kept on the server.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
