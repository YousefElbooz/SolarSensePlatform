import Link from 'next/link';
import { Sun } from 'lucide-react';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="cinematic-page flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <span className="liquid-glass mx-auto flex h-12 w-12 items-center justify-center rounded-full text-[#ffd60a]">
          <Sun className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-6 font-mono text-[12px] uppercase tracking-[0.14em] text-[#8e93a8]">Error 404</p>
        <h1 className="cinematic-h2 mt-2">This page is past the horizon.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#b4b8cb]">
          The address may be mistyped, or the page may have moved.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn-pill-primary">
            Back to the start
          </Link>
          <Link href="/twin" className="btn-pill">
            Open the digital twin
          </Link>
        </div>
      </div>
    </main>
  );
}
