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
    <div className="cinematic-page text-[#f4f5fa]">
      <Navbar />

      <div className="mx-auto flex max-w-md flex-col justify-center px-6 pb-20 pt-32">
        <div data-gsap="card" className="glass p-8">
          <div className="eyebrow">SolarSense Operate Portal</div>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-[-0.02em] text-[#f4f5fa]">
            Sign in to{" "}
            <em className="font-normal italic text-[#ffd166]">Operate.</em>
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#b9bdcf]">
            Access live &amp; replay site telemetry, deterministic load scheduling, and the grounded AI assistant.
          </p>

          <div className="mt-6">
            <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#b9bdcf]">
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
                  className={`rounded-full border px-2.5 py-2 text-xs font-medium transition ${
                    role === r.id
                      ? "border-[#ffd166] bg-[#f5a524]/15 text-[#ffd166]"
                      : "border-white/15 bg-white/[0.04] text-[#b9bdcf] hover:text-[#f4f5fa]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-[#b9bdcf]">
                Email Address
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
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm text-[#f4f5fa] focus:border-[#ffd166] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="btn-pill btn-pill-primary mt-2 w-full justify-center py-3"
            >
              Launch Operate Workspace →
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-[#b9bdcf]">
            <span>New solar plant or rooftop?</span>
            <Link href="/register" className="font-medium text-[#ffd166] hover:underline">
              Create Operator Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
