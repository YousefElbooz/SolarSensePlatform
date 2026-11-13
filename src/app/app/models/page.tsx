'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { MODEL_BENCHMARK_TABLE, SHAP_FEATURE_IMPORTANCE } from '@/domain/benchmarkData';

export default function ModelBenchmarkPage() {
  const [horizonH, setHorizonH] = useState<1 | 6 | 24>(1);
  const [stratum, setStratum] = useState<string>('overall');

  const strataOptions = useMemo(() => {
    const s = new Set(
      MODEL_BENCHMARK_TABLE.filter((r) => r.horizonH === horizonH).map((r) => r.stratum)
    );
    return Array.from(s);
  }, [horizonH]);

  const activeStratum = strataOptions.includes(stratum as never)
    ? stratum
    : strataOptions[0] ?? 'overall';

  const filteredRows = useMemo(
    () =>
      MODEL_BENCHMARK_TABLE.filter(
        (r) => r.horizonH === horizonH && r.stratum === activeStratum
      ),
    [horizonH, activeStratum]
  );

  const stratumLabel = (s: string) => {
    if (s === 'overall') return 'Overall (Pooled 4 Regions)';
    if (s === 'dust_khamaseen') return 'Khamaseen Dust Season (Mar–May)';
    if (s === 'clear') return 'Clear Sky (k_c ≥ 0.75)';
    return s;
  };

  return (
    <div className="cinematic-page pb-20 pt-8">
      <Navbar clockLabel="15:00 · Model Benchmark" />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.14] pb-6">
          <div>
            <div className="eyebrow">
              SolarSense Research · Verified 2026 Held-Out Evaluation
            </div>
            <h1 className="cinematic-h2 mt-2">
              Model Benchmark &amp; Physics-Guided Ablation
            </h1>
            <p className="mt-1.5 text-xs text-[#b9bdcf]">
              Chronological Split: 2020–2024 Train (5 yrs) · 2025 Validation (1 yr) · 2026 Held-out
              Test (1 yr) · 990 ERA5 Grid Cells (02:00–17:00 UTC)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/app" className="btn-pill py-2 px-4 text-xs">
              ← Fleet Overview
            </Link>
            <Link href="/app/assistant" className="btn-pill-primary py-2 px-4 text-xs">
              Query Benchmark in AI Assistant →
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass mt-6 flex flex-wrap items-center justify-between gap-4 py-3.5 px-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs text-[#b4b8cb]">Forecast Horizon:</span>
            <div className="apple-segmented" role="group" aria-label="Forecast Horizon">
              {([1, 6, 24] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizonH(h)}
                  className={`apple-segment-btn font-mono text-xs ${
                    horizonH === h ? 'active' : ''
                  }`}
                >
                  {h}h Ahead
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs text-[#b4b8cb]">Sky Condition Stratum:</span>
            <div className="apple-segmented flex-wrap" role="group" aria-label="Sky Condition Stratum">
              {strataOptions.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStratum(st)}
                  className={`apple-segment-btn font-mono text-xs ${
                    activeStratum === st ? 'active' : ''
                  }`}
                >
                  {stratumLabel(st)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Benchmark Table */}
        <div className="glass mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="eyebrow">
                Standardized Daytime Evaluation (Solar Elevation &gt; 5° · 1,000 kWp Reference Basis)
              </div>
              <h2 className="mt-1.5 font-serif text-2xl font-semibold text-white">
                {horizonH}h Forecast Horizon — {stratumLabel(activeStratum)}
              </h2>
            </div>
            <span className="tag-pill live">
              Diebold–Mariano Significance: p &lt; 0.01 vs Smart Persistence &amp; CLIPER
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/[0.16] text-[#b9bdcf]">
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
                  const isPgnn = row.modelKey === 'pgnn';
                  return (
                    <tr
                      key={`${row.modelKey}-${row.horizonH}-${row.stratum}`}
                      className={`border-b border-white/[0.1] ${
                        isPgnn ? 'bg-[#f5a524]/15 font-semibold text-white' : 'text-[#b9bdcf]'
                      }`}
                    >
                      <td className="py-3.5">
                        {row.modelName}
                        {isPgnn && <span className="ml-2 tag-pill">CHAMPION</span>}
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
                            ? 'text-[#9fe9e9]'
                            : 'text-[#b9bdcf]/60'
                        }`}
                      >
                        {row.skillVsSmartPersistencePct > 0 ? '+' : ''}
                        {row.skillVsSmartPersistencePct.toFixed(1)}%
                      </td>
                      <td
                        className={`py-3.5 ${
                          row.skillVsCliperPct > 0 ? 'text-[#9fe9e9]' : 'text-[#b9bdcf]/60'
                        }`}
                      >
                        {row.skillVsCliperPct > 0 ? '+' : ''}
                        {row.skillVsCliperPct.toFixed(1)}%
                      </td>
                      <td className="py-3.5">{row.dmTestPValueVsSmartPers}</td>
                      <td className="py-3.5 text-right">
                        <span
                          className={
                            row.physicallyInvalidPredictionsPct === 0
                              ? 'tag-pill live'
                              : 'tag-pill'
                          }
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
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="glass p-6 lg:col-span-7">
            <div className="eyebrow">Explainable AI (XAI) · TreeSHAP / Integrated Gradients</div>
            <h3 className="mt-1.5 font-serif text-2xl font-semibold text-white">
              Global Feature Attribution (Mean |SHAP| Share)
            </h3>
            <p className="mt-1 text-xs text-[#b9bdcf]">
              Confirms that clear-sky physics envelope (`P_clear`) and clearness index (`k_c`) lags
              dominate model decisions, followed by atmospheric cloud/dust indicators.
            </p>

            <div className="mt-5 space-y-3">
              {SHAP_FEATURE_IMPORTANCE.map((item) => (
                <div key={item.feature} className="space-y-1">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-white">{item.feature}</span>
                    <span className="text-[#ffd166]">
                      {item.importancePct.toFixed(1)}% ·{' '}
                      <span className="text-[#b9bdcf]">{item.category}</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#f5a524] to-[#3fc1c1]"
                      style={{ width: `${Math.min(100, item.importancePct * 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-6 lg:col-span-5">
            <div className="eyebrow">Physics-Guided Loss Function</div>
            <h3 className="mt-1.5 font-serif text-2xl font-semibold text-white">
              Why PGNN Eliminates Unphysical Predictions
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#b9bdcf]">
              Pure black-box neural networks (standard LSTM) and gradient-boosted trees (XGBoost)
              occasionally predict negative power at dawn/dusk transitions or exceed the theoretical
              clear-sky ceiling during rapid cloud-edge enhancements.
            </p>

            <div className="mt-4 rounded-2xl border border-white/[0.14] bg-[#05070f]/80 p-4 font-mono text-xs text-[#ffd166]">
              <div>L_total = L_Pinball(y, P_hat_q)</div>
              <div className="mt-1 pl-4 text-[#9fe9e9]">
                + λ₁ · ReLU(-P_hat)² &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// Non-negativity
              </div>
              <div className="mt-1 pl-4 text-[#9fe9e9]">
                + λ₂ · ReLU(P_hat - 1.05·P_clear)² // Clear-sky ceiling
              </div>
              <div className="mt-1 pl-4 text-sky-300">
                + λ₃ · ReLU(P_10 - P_50) + ReLU(P_50 - P_90)
              </div>
            </div>

            <div className="mt-5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2.5">
                <span className="text-[#b9bdcf]">XGBoost Unconstrained Violations</span>
                <span className="font-mono font-semibold text-[#ffd166]">0.8% – 1.2% of hours</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2.5">
                <span className="text-[#b9bdcf]">Standard LSTM Unconstrained Violations</span>
                <span className="font-mono font-semibold text-[#ffd166]">2.1% – 2.9% of hours</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#3fc1c1]/35 bg-[#3fc1c1]/10 px-3.5 py-2.5">
                <span className="font-semibold text-white">
                  PGNN (Physics-Constrained + Hard Clamp)
                </span>
                <span className="font-mono font-semibold text-[#9fe9e9]">0.0% Violations</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
