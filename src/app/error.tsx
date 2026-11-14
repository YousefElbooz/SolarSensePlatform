'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="cinematic-page flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center" role="alert">
        <span className="liquid-glass mx-auto flex h-12 w-12 items-center justify-center rounded-full text-[#ffd60a]">
          <TriangleAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="cinematic-h2 mt-6">This page could not be shown.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#b4b8cb]">
          Something failed while loading it. Your inputs on other pages are not affected.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn-pill-primary">
            Try again
          </button>
          <Link href="/" className="btn-pill">
            Back to the start
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 font-mono text-[11px] text-[#8e93a8]">Reference: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
