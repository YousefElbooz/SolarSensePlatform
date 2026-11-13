"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { MODEL_BENCHMARK_TABLE, SHAP_FEATURE_IMPORTANCE } from "@/domain/benchmarkData";

export default function ModelBenchmarkPage() {
  const [horizonH, setHorizonH] = useState<1 | 6 | 24>(1);
  const [stratum, setStratum] = useState<string>("overall");

  const strataOptions = useMemo(() => {
    const s = new Set(
      MODEL_BENCHMARK_TABLE.filter((r) => r.horizonH === horizonH).map((r) => r.stratum)
    );
    return Array.from(s);
  }, [horizonH]);

  const activeStratum = strataOptions.includes(stratum as never) ? stratum : strataOptions[0] ?? "overall";

  const filteredRows = useMemo(
    () =>
      MODEL_BENCHMARK_TABLE.filter(
        (r) => r.horizonH === horizonH && r.stratum === activeStratum
      ),
    [horizonH, activeStratum]
  );

  const stratumLabel = (s: string) => {
    if (s === "overall") return "Overall (Pooled 4 Regions)";
    if (s === "dust_khamaseen") return "Khamaseen Dust Season (Mar–May)";
    if (s === "clear") return "Clear Sky (k_c ≥ 0.75)";
    return s;
  };

  return (
    <div className="min-h-screen bg-[#0c0a08] text-[#FAF5EA]">
      <Navbar />

      <div className="mx-auto max-w-[1440px] px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#FAF5EA]/12 pb-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#FFAA2B]">
              SolarSense Research · Verified 2026 Held-Out Evaluation
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-semibold md:text-4xl">
              Model Benchmark &amp; Physics-Guided Ablation
            </h1>
            <p className="mt-1 text-xs text-[#FAF5EA]/70">
              Chronological Split: 2020–2024 Train (5 yrs) · 2025 Validation (1 yr) · 2026 Held-out Test (1 yr) · 990 ERA5 Grid Cells (02:00–17:00 UTC)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app"
              className="rounded-lg border border-[#FAF5EA]/20 bg-[#18130e] px-3.5 py-2 text-xs font-medium text-[#FAF5EA]/85 hover:border-[#FFAA2B]"
            >
              ← Fleet Overview
            </Link>
            <Link
              href="/app/assistant"
              className="rounded-lg bg-[#FFAA2B] px-3.5 py-2 text-xs font-semibold text-[#110D08] hover:bg-[#FFB94A]"
            >
              Query Benchmark in AI Assistant →
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#FAF5EA]/15 bg-[#16120e] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[#FAF5EA]/65">Forecast Horizon:</span>
            {([1, 6, 24] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHorizonH(h)}
                className={`rounded-lg px-3.5 py-1.5 font-mono text-xs transition ${
                  horizonH === h
                    ? "bg-[#FFAA2B] font-semibold text-[#110D08]"
                    : "border border-[#FAF5EA]/15 bg-[#1d1812] text-[#FAF5EA]/75 hover:border-[#FAF5EA]/35"
                }`}
              >
                {h}h Ahead
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[#FAF5EA]/65">Sky Condition Stratum:</span>
            {strataOptions.map((st) => (
              <button
                key={st}
                onClick={() => setStratum(st)}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                  activeStratum === st
                    ? "bg-[#FAF5EA] font-semibold text-[#110D08]"
                    : "border border-[#FAF5EA]/15 bg-[#1d1812] text-[#FAF5EA]/75 hover:border-[#FAF5EA]/35"
                }`}
              >
                {stratumLabel(st)}
              </button>
            ))}
          </div>
        </div>

        {/* Benchmark Table */}
        <div className="mt-6 rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
                Standardized Daytime Evaluation (Solar Elevation &gt; 5° · 1,000 kWp Reference Basis)
              </div>
              <h2 className="mt-1 font-serif text-2xl font-semibold">
                {horizonH}h Forecast Horizon — {stratumLabel(activeStratum)}
              </h2>
            </div>
            <span className="rounded-md border border-[#72B86A]/40 bg-[#72B86A]/10 px-3 py-1 font-mono text-xs text-[#72B86A]">
              Diebold–Mariano Significance: p &lt; 0.01 vs Smart Persistence &amp; CLIPER
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#FAF5EA]/15 text-[#FAF5EA]/60">
                  <th className="py-3">Model / Baseline</th>
                  <th className="py-3">MAE (kW)</th>
                  <th className="py-3">RMSE (kW)</th>
                  <th className="py-3">nRMSE (%)</th>
                  <th className="py-3">MBE (kW)</th>
                  <th className="py-3">R²</th>
                  <th className="py-3">Skill vs Smart Pers.</th>
                  <th className="py-3">Skill vs CLIPER</th>
                  <th className="py-3">DM Test p-val</th>
                  <th className="py-3 text-right">Physical Violations</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isPgnn = row.modelKey === "pgnn";
                  return (
                    <tr
                      key={`${row.modelKey}-${row.horizonH}-${row.stratum}`}
                      className={`border-b border-[#FAF5EA]/10 ${
                        isPgnn
                          ? "bg-[#FFAA2B]/12 font-semibold text-[#FAF5EA]"
                          : "text-[#FAF5EA]/80"
                      }`}
                    >
                      <td className="py-3.5">
                        {row.modelName}
                        {isPgnn && (
                          <span className="ml-2 rounded bg-[#FFAA2B] px-1.5 py-0.5 text-[9px] font-bold text-[#110D08]">
                            CHAMPION
                          </span>
                        )}
                      </td>
                      <td className="py-3.5">{row.maeKw.toFixed(1)}</td>
                      <td className="py-3.5">{row.rmseKw.toFixed(1)}</td>
                      <td className="py-3.5">{row.nRmsePct.toFixed(2)}%</td>
                      <td className="py-3.5">
                        {row.mbeKw > 0 ? `+${row.mbeKw.toFixed(1)}` : row.mbeKw.toFixed(1)}
                      </td>
                      <td className="py-3.5">{row.r2Daytime.toFixed(3)}</td>
                      <td
                        className={`py-3.5 ${
                          row.skillVsSmartPersistencePct > 0
                            ? "text-[#72B86A]"
                            : "text-[#FAF5EA]/55"
                        }`}
                      >
                        {row.skillVsSmartPersistencePct > 0 ? "+" : ""}
                        {row.skillVsSmartPersistencePct.toFixed(1)}%
                      </td>
                      <td
                        className={`py-3.5 ${
                          row.skillVsCliperPct > 0 ? "text-[#72B86A]" : "text-[#FAF5EA]/55"
                        }`}
                      >
                        {row.skillVsCliperPct > 0 ? "+" : ""}
                        {row.skillVsCliperPct.toFixed(1)}%
                      </td>
                      <td className="py-3.5">{row.dmTestPValueVsSmartPers}</td>
                      <td className="py-3.5 text-right">
                        <span
                          className={`rounded px-2 py-0.5 ${
                            row.physicallyInvalidPredictionsPct === 0
                              ? "bg-[#72B86A]/20 text-[#72B86A]"
                              : "bg-[#E85D4A]/20 text-[#E85D4A]"
                          }`}
                        >
                          {row.physicallyInvalidPredictionsPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lower Grid: SHAP Feature Importance & PGNN Loss Formulation */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* SHAP Feature Importance (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
              Explainable AI (XAI) · TreeSHAP / Integrated Gradients
            </div>
            <h3 className="mt-1 font-serif text-2xl font-semibold">
              Global Feature Attribution (Mean |SHAP| Share)
            </h3>
            <p className="mt-1 text-xs text-[#FAF5EA]/70">
              Confirms that clear-sky physics envelope (`P_clear`) and clearness index (`k_c`) lags dominate model decisions, followed by atmospheric cloud/dust indicators.
            </p>

            <div className="mt-5 space-y-3">
              {SHAP_FEATURE_IMPORTANCE.map((item) => (
                <div key={item.feature} className="space-y-1">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-[#FAF5EA]">{item.feature}</span>
                    <span className="text-[#FFAA2B]">
                      {item.importancePct.toFixed(1)}% ·{" "}
                      <span className="text-[#FAF5EA]/55">{item.category}</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1d1812]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#FFAA2B] to-[#72B86A]"
                      style={{ width: `${Math.min(100, item.importancePct * 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PGNN Physics Penalty & Ablation Proof (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#72B86A]">
              Physics-Guided Loss Function
            </div>
            <h3 className="mt-1 font-serif text-2xl font-semibold">
              Why PGNN Eliminates Unphysical Predictions
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#FAF5EA]/75">
              Pure black-box neural networks (standard LSTM) and gradient-boosted trees (XGBoost) occasionally predict negative power at dawn/dusk transitions or exceed the theoretical clear-sky ceiling during rapid cloud-edge enhancements.
            </p>

            <div className="mt-4 rounded-xl border border-[#FAF5EA]/15 bg-[#1d1812] p-4 font-mono text-xs text-[#FFAA2B]">
              <div>L_total = L_Pinball(y, P_hat_q)</div>
              <div className="mt-1 pl-4 text-[#72B86A]">
                + λ₁ · ReLU(-P_hat)² &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// Non-negativity
              </div>
              <div className="mt-1 pl-4 text-[#72B86A]">
                + λ₂ · ReLU(P_hat - 1.05·P_clear)² // Clear-sky ceiling
              </div>
              <div className="mt-1 pl-4 text-[#38BDF8]">
                + λ₃ · ReLU(P_10 - P_50) + ReLU(P_50 - P_90)
              </div>
            </div>

            <div className="mt-5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-[#FAF5EA]/10 bg-[#1d1812] px-3.5 py-2.5">
                <span>XGBoost Unconstrained Violations</span>
                <span className="font-mono font-semibold text-[#E85D4A]">0.8% – 1.2% of hours</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#FAF5EA]/10 bg-[#1d1812] px-3.5 py-2.5">
                <span>Standard LSTM Unconstrained Violations</span>
                <span className="font-mono font-semibold text-[#E85D4A]">2.1% – 2.9% of hours</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#72B86A]/35 bg-[#72B86A]/10 px-3.5 py-2.5">
                <span className="font-semibold text-[#FAF5EA]">PGNN (Physics-Constrained + Hard Clamp)</span>
                <span className="font-mono font-semibold text-[#72B86A]">0.0% Violations</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
