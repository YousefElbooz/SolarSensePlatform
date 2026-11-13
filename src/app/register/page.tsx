"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("Eng. Yousef");
  const [email, setEmail] = useState("yousef@solarsense.eg");
  const [siteName, setSiteName] = useState("New Cairo Rooftop Site");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/app");
  };

  return (
    <div className="cinematic-page text-[#f4f5fa]">
      <Navbar />

      <div className="mx-auto flex max-w-md flex-col justify-center px-6 pb-20 pt-32">
        <div data-gsap="card" className="glass p-8">
          <div className="eyebrow">SolarSense Operate Onboarding</div>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-[-0.02em] text-[#f4f5fa]">
            Register Site &amp;{" "}
            <em className="font-normal italic text-[#ffd166]">Account.</em>
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#b9bdcf]">
            Promote a planned rooftop assessment or register an active Egyptian PV plant for continuous forecasting.
          </p>

          <form onSubmit={handleRegister} className="mt-6 space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-[#b9bdcf]">
                Full Name / Organization
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm text-[#f4f5fa] focus:border-[#ffd166] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-[#b9bdcf]">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm text-[#f4f5fa] focus:border-[#ffd166] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-[#b9bdcf]">
                Initial PV Site Name
              </label>
              <input
                type="text"
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="mt-1.5 w-full rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm text-[#f4f5fa] focus:border-[#ffd166] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="btn-pill btn-pill-primary mt-2 w-full justify-center py-3"
            >
              Create Account &amp; Enter Operate →
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-[#b9bdcf]">
            <span>Already have an operator account?</span>
            <Link href="/login" className="font-medium text-[#ffd166] hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
