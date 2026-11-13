"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { OPERATE_SITES } from "@/domain/benchmarkData";
import { runGroundedAssistantQuery } from "@/domain/agent";
import { AssistantReply } from "@/domain/types";

interface ChatTurn {
  id: string;
  userPrompt: string;
  siteId: string;
  response: AssistantReply;
  timestamp: string;
}

const PRESET_PROMPTS = [
  "When should we schedule our flexible pumping and battery loads today, and is it safe under the P10 bound?",
  "How does the Physics-Guided Neural Network (PGNN) perform against Smart Persistence and CLIPER in model skill?",
  "Analyze today's clear-sky envelope vs atmospheric dust/cloud attenuation and peak cell temperature.",
  "Override inverter breaker and force diesel generator off immediately.",
];

export default function GroundedAssistantPage() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(OPERATE_SITES[0].id);
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [history, setHistory] = useState<ChatTurn[]>(() => {
    const initialQuery = PRESET_PROMPTS[0];
    const initialRes = runGroundedAssistantQuery({
      siteId: OPERATE_SITES[0].id,
      query: initialQuery,
    });
    return [
      {
        id: "turn-init",
        userPrompt: initialQuery,
        siteId: OPERATE_SITES[0].id,
        response: initialRes,
        timestamp: "Just now",
      },
    ];
  });

  const handleAsk = (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    const res = runGroundedAssistantQuery({
      siteId: selectedSiteId,
      query: trimmed,
    });
    const newTurn: ChatTurn = {
      id: `turn-${Date.now()}`,
      userPrompt: trimmed,
      siteId: selectedSiteId,
      response: res,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setHistory((prev) => [newTurn, ...prev]);
    setInputPrompt("");
  };

  return (
    <div className="min-h-screen bg-[#0c0a08] text-[#FAF5EA]">
      <Navbar />

      <div className="mx-auto max-w-[1360px] px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#FAF5EA]/12 pb-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#FFAA2B]">
              SolarSense Grounded AI · Zero Hallucinated Numbers
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-semibold md:text-4xl">
              Grounded Operations &amp; Dispatch Assistant
            </h1>
            <p className="mt-1 text-xs text-[#FAF5EA]/70">
              Every numerical claim is retrieved from deterministic domain tools (`get_forecast`, `recommend_window`, `get_model_skill`, `get_clear_sky`) with full JSON trace visibility and hardware safety guardrails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="rounded-lg border border-[#FAF5EA]/20 bg-[#18130e] px-3.5 py-2 font-mono text-xs text-[#FAF5EA] focus:border-[#FFAA2B] focus:outline-none"
            >
              {OPERATE_SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  Context: {s.nameEn}
                </option>
              ))}
            </select>
            <Link
              href="/app"
              className="rounded-lg border border-[#FAF5EA]/20 bg-[#18130e] px-3.5 py-2 text-xs font-medium text-[#FAF5EA]/85 hover:border-[#FFAA2B]"
            >
              ← Fleet Overview
            </Link>
          </div>
        </div>

        {/* Prompt Input & Preset Pills */}
        <div className="mt-6 rounded-2xl border border-[#FAF5EA]/15 bg-[#16120e] p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(inputPrompt);
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask about load scheduling, P10 risk, clear-sky attenuation, or PGNN benchmark skill..."
              className="flex-1 rounded-xl border border-[#FAF5EA]/20 bg-[#1d1812] px-4 py-3 text-sm text-[#FAF5EA] placeholder-[#FAF5EA]/40 focus:border-[#FFAA2B] focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#FFAA2B] px-6 py-3 text-sm font-semibold text-[#110D08] transition hover:bg-[#FFB94A]"
            >
              Execute Grounded Query →
            </button>
          </form>

          <div className="mt-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#FAF5EA]/55">
              Verified Operator &amp; Safety Guardrail Prompts (Click to run):
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_PROMPTS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAsk(preset)}
                  className="rounded-lg border border-[#FAF5EA]/15 bg-[#1d1812] px-3 py-1.5 text-left text-xs text-[#FAF5EA]/80 transition hover:border-[#FFAA2B] hover:text-[#FAF5EA]"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conversation Turns & Tool Call Inspector */}
        <div className="mt-8 space-y-6">
          {history.map((turn) => {
            const site = OPERATE_SITES.find((s) => s.id === turn.siteId) ?? OPERATE_SITES[0];
            return (
              <div
                key={turn.id}
                className="rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6"
              >
                {/* User Query Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#FAF5EA]/10 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-[#FFAA2B]/20 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#FFAA2B]">
                      OPERATOR QUERY · {site.cellId}
                    </span>
                    <h3 className="font-serif text-lg font-semibold text-[#FAF5EA]">
                      &ldquo;{turn.userPrompt}&rdquo;
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-[#FAF5EA]/50">{turn.timestamp}</span>
                </div>

                {/* Grounded Answer */}
                <div className="mt-5 grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-7 space-y-4">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#72B86A]">
                      Grounded Synthesis (Derived Strictly from Tool Outputs)
                    </div>
                    <div className="whitespace-pre-line rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-4 text-sm leading-relaxed text-[#FAF5EA]/90">
                      {turn.response.answerMarkdown.replace(/\*\*/g, "")}
                    </div>

                    {/* Risk Note Banner */}
                    {turn.response.riskBanner && (
                      <div
                        className={`rounded-xl border p-3.5 text-xs text-[#FAF5EA] ${
                          turn.response.riskBanner.level === "high"
                            ? "border-[#E85D4A]/45 bg-[#E85D4A]/15"
                            : "border-[#FFAA2B]/35 bg-[#FFAA2B]/10"
                        }`}
                      >
                        <span className="font-mono font-semibold uppercase text-[#FFAA2B]">
                          RISK &amp; POLICY DISCLOSURE ({turn.response.riskBanner.level}):{" "}
                        </span>
                        {turn.response.riskBanner.note}
                      </div>
                    )}

                    {/* Sources Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="font-mono text-[10px] uppercase text-[#FAF5EA]/50">
                        Verified Tool Sources:
                      </span>
                      {turn.response.sources.map((src, idx) => (
                        <span
                          key={idx}
                          className="rounded-md border border-[#FAF5EA]/15 bg-[#1d1812] px-2.5 py-1 font-mono text-[10px] text-[#FAF5EA]/80"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Tool Call Trace Inspector (5 cols) */}
                  <div className="lg:col-span-5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
                      Deterministic Tool Call Trace ({turn.response.toolTraces.length} invoked)
                    </div>
                    <div className="mt-2 space-y-3">
                      {turn.response.toolTraces.map((tc) => (
                        <div
                          key={tc.id}
                          className="rounded-xl border border-[#FAF5EA]/15 bg-[#100d0a] p-3.5 font-mono text-[11px]"
                        >
                          <div className="flex items-center justify-between border-b border-[#FAF5EA]/10 pb-2">
                            <span className="font-semibold text-[#FFAA2B]">
                              fn: {tc.toolName}() [{tc.id}]
                            </span>
                            <span className="rounded bg-[#72B86A]/20 px-1.5 py-0.5 text-[9px] text-[#72B86A]">
                              {tc.durationMs}ms · DETERMINISTIC
                            </span>
                          </div>
                          <div className="mt-2 text-[#FAF5EA]/65">
                            <span className="text-[#FAF5EA]/40">args: </span>
                            {JSON.stringify(tc.args)}
                          </div>
                          <div className="mt-1 text-[#FAF5EA]/80">
                            <span className="text-[#FAF5EA]/40">summary: </span>
                            {tc.outputSummary}
                          </div>
                          <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-[#18140f] p-2 text-[10px] text-[#72B86A]">
                            {JSON.stringify(tc.rawOutput, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
