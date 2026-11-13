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
    <div className="min-h-screen bg-[#0c0a08] text-[#FAF5EA]">
      <Navbar />

      <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-20">
        <div className="rounded-2xl border border-[#FAF5EA]/15 bg-[#16120e] p-8 shadow-2xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFAA2B]">
            SolarSense Operate Onboarding
          </div>
          <h1 className="mt-2 font-serif text-3xl font-semibold">
            Register Site &amp; Account
          </h1>
          <p className="mt-2 text-xs text-[#FAF5EA]/70">
            Promote a planned rooftop assessment or register an active Egyptian PV plant for continuous forecasting.
          </p>

          <form onSubmit={handleRegister} className="mt-6 space-y-4">
            <div>
              <label className="block font-mono text-xs text-[#FAF5EA]/75">
                Full Name / Organization
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#FAF5EA]/20 bg-[#1d1812] px-3.5 py-2.5 text-sm text-[#FAF5EA] focus:border-[#FFAA2B] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-xs text-[#FAF5EA]/75">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#FAF5EA]/20 bg-[#1d1812] px-3.5 py-2.5 text-sm text-[#FAF5EA] focus:border-[#FFAA2B] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-xs text-[#FAF5EA]/75">
                Initial PV Site Name
              </label>
              <input
                type="text"
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#FAF5EA]/20 bg-[#1d1812] px-3.5 py-2.5 text-sm text-[#FAF5EA] focus:border-[#FFAA2B] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#FFAA2B] py-3 text-sm font-semibold text-[#110D08] transition hover:bg-[#FFB94A]"
            >
              Create Account &amp; Enter Operate →
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-[#FAF5EA]/10 pt-4 text-xs text-[#FAF5EA]/60">
            <span>Already have an operator account?</span>
            <Link href="/login" className="font-medium text-[#FFAA2B] hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

