'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { OPERATE_SITES } from '@/domain/benchmarkData';
import { runGroundedAssistantQuery } from '@/domain/agent';
import { AssistantReply } from '@/domain/types';

interface ChatTurn {
  id: string;
  userPrompt: string;
  siteId: string;
  response: AssistantReply;
  timestamp: string;
}

const PRESET_PROMPTS = [
  'When should we schedule our flexible pumping and battery loads today, and is it safe under the P10 bound?',
  'How does the Physics-Guided Neural Network (PGNN) perform against Smart Persistence and CLIPER in model skill?',
  "Analyze today's clear-sky envelope vs atmospheric dust/cloud attenuation and peak cell temperature.",
  'Override inverter breaker and force diesel generator off immediately.',
];

export default function GroundedAssistantPage() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(OPERATE_SITES[0].id);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [history, setHistory] = useState<ChatTurn[]>(() => {
    const initialQuery = PRESET_PROMPTS[0];
    const initialRes = runGroundedAssistantQuery({
      siteId: OPERATE_SITES[0].id,
      query: initialQuery,
    });
    return [
      {
        id: 'turn-init',
        userPrompt: initialQuery,
        siteId: OPERATE_SITES[0].id,
        response: initialRes,
        timestamp: 'Just now',
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setHistory((prev) => [newTurn, ...prev]);
    setInputPrompt('');
  };

  return (
    <div className="cinematic-page pb-20 pt-8">
      <Navbar clockLabel="16:00 · Grounded AI" />

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.14] pb-6">
          <div>
            <div className="eyebrow">SolarSense Grounded AI · Zero Hallucinated Numbers</div>
            <h1 className="cinematic-h2 mt-2">
              Grounded Operations &amp; Dispatch Assistant
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs text-[#b9bdcf]">
              Every numerical claim is retrieved from deterministic domain tools (`get_forecast`,
              `recommend_window`, `get_model_skill`, `get_clear_sky`) with full JSON trace
              visibility and hardware safety guardrails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="rounded-full border border-white/[0.16] bg-[#0a0d1c]/80 px-4 py-2 font-mono text-xs text-white focus:border-[#ffd166] focus:outline-none"
            >
              {OPERATE_SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  Context: {s.nameEn}
                </option>
              ))}
            </select>
            <Link href="/app" className="btn-pill py-2 px-4 text-xs">
              ← Fleet Overview
            </Link>
          </div>
        </div>

        {/* Prompt Input & Preset Pills */}
        <div className="glass mt-6 p-6">
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
              className="flex-1 rounded-full border border-white/[0.16] bg-white/[0.04] px-5 py-3 text-sm text-white placeholder-[#b9bdcf]/60 focus:border-[#ffd166] focus:outline-none"
            />
            <button type="submit" className="btn-pill-primary px-6 py-3">
              Execute Grounded Query →
            </button>
          </form>

          <div className="mt-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#b9bdcf]">
              Verified Operator &amp; Safety Guardrail Prompts (Click to run):
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_PROMPTS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAsk(preset)}
                  className="rounded-full border border-white/[0.16] bg-white/[0.04] px-3.5 py-1.5 text-left text-xs text-[#b9bdcf] transition hover:border-[#ffd166] hover:text-white"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conversation Turns & Tool Call Inspector */}
        <div className="mt-6 space-y-6">
          {history.map((turn) => {
            const site = OPERATE_SITES.find((s) => s.id === turn.siteId) ?? OPERATE_SITES[0];
            return (
              <div key={turn.id} className="glass p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.14] pb-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tag-pill">OPERATOR QUERY · {site.cellId}</span>
                    <h3 className="font-serif text-lg font-semibold text-white">
                      &ldquo;{turn.userPrompt}&rdquo;
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-[#b9bdcf]">{turn.timestamp}</span>
                </div>

                <div className="mt-5 grid gap-6 lg:grid-cols-12">
                  <div className="space-y-4 lg:col-span-7">
                    <div className="eyebrow">
                      Grounded Synthesis (Derived Strictly from Tool Outputs)
                    </div>
                    <div className="whitespace-pre-line rounded-2xl border border-white/[0.14] bg-white/[0.03] p-4 text-sm leading-relaxed text-[#f4f5fa]">
                      {turn.response.answerMarkdown.replace(/\*\*/g, '')}
                    </div>

                    {turn.response.riskBanner && (
                      <div
                        className={`rounded-2xl border p-3.5 text-xs ${
                          turn.response.riskBanner.level === 'high'
                            ? 'border-[#f5a524]/50 bg-[#f5a524]/15'
                            : 'border-[#3fc1c1]/35 bg-[#3fc1c1]/10'
                        }`}
                      >
                        <span className="font-mono font-semibold uppercase text-[#ffd166]">
                          RISK &amp; POLICY DISCLOSURE ({turn.response.riskBanner.level}):{' '}
                        </span>
                        <span className="text-white">{turn.response.riskBanner.note}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="font-mono text-[10px] uppercase text-[#b9bdcf]">
                        Verified Tool Sources:
                      </span>
                      {turn.response.sources.map((src, idx) => (
                        <span
                          key={idx}
                          className="rounded-full border border-white/[0.16] bg-white/[0.04] px-3 py-1 font-mono text-[10px] text-[#b9bdcf]"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="eyebrow">
                      Deterministic Tool Call Trace ({turn.response.toolTraces.length} invoked)
                    </div>
                    <div className="mt-2.5 space-y-3">
                      {turn.response.toolTraces.map((tc) => (
                        <div
                          key={tc.id}
                          className="rounded-2xl border border-white/[0.14] bg-[#05070f]/80 p-3.5 font-mono text-[11px]"
                        >
                          <div className="flex items-center justify-between border-b border-white/[0.1] pb-2">
                            <span className="font-semibold text-[#ffd166]">
                              fn: {tc.toolName}() [{tc.id}]
                            </span>
                            <span className="tag-pill live">
                              {tc.durationMs}ms · DETERMINISTIC
                            </span>
                          </div>
                          <div className="mt-2 text-[#b9bdcf]">
                            <span className="text-[#b9bdcf]/60">args: </span>
                            {JSON.stringify(tc.args)}
                          </div>
                          <div className="mt-1 text-white">
                            <span className="text-[#b9bdcf]/60">summary: </span>
                            {tc.outputSummary}
                          </div>
                          <pre className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-white/[0.04] p-2.5 text-[10px] text-[#9fe9e9]">
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
