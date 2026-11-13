"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("operator@solarsense.eg");
  const [password, setPassword] = useState("••••••••••••");
  const [role, setRole] = useState<"OPERATOR" | "RESEARCHER" | "HOMEOWNER">("OPERATOR");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/app");
  };

  return (
    <div className="min-h-screen bg-[#0c0a08] text-[#FAF5EA]">
      <Navbar />

      <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-20">
        <div className="rounded-2xl border border-[#FAF5EA]/15 bg-[#16120e] p-8 shadow-2xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFAA2B]">
            SolarSense Operate Portal
          </div>
          <h1 className="mt-2 font-serif text-3xl font-semibold">
            Sign in to Operate
          </h1>
          <p className="mt-2 text-xs text-[#FAF5EA]/70">
            Access live &amp; replay site telemetry, deterministic load scheduling, and the grounded AI assistant.
          </p>

          <div className="mt-6">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[#FAF5EA]/60">
              Quick Demo Role Preset
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  { id: "OPERATOR", label: "Grid Operator", mail: "operator@solarsense.eg" },
                  { id: "RESEARCHER", label: "ML Researcher", mail: "research@solarsense.eg" },
                  { id: "HOMEOWNER", label: "Site Owner", mail: "owner@solarsense.eg" },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRole(r.id);
                    setEmail(r.mail);
                  }}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                    role === r.id
                      ? "border-[#FFAA2B] bg-[#FFAA2B]/15 text-[#FFAA2B]"
                      : "border-[#FAF5EA]/15 bg-[#1d1812] text-[#FAF5EA]/70 hover:text-[#FAF5EA]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block font-mono text-xs text-[#FAF5EA]/75">
                Email Address
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
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#FAF5EA]/20 bg-[#1d1812] px-3.5 py-2.5 text-sm text-[#FAF5EA] focus:border-[#FFAA2B] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#FFAA2B] py-3 text-sm font-semibold text-[#110D08] transition hover:bg-[#FFB94A]"
            >
              Launch Operate Workspace →
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-[#FAF5EA]/10 pt-4 text-xs text-[#FAF5EA]/60">
            <span>New solar plant or rooftop?</span>
            <Link href="/register" className="font-medium text-[#FFAA2B] hover:underline">
              Create Operator Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

