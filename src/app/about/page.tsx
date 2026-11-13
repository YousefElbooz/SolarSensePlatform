"use client";

import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0c0a08] text-[#FAF5EA]">
      <Navbar />

      <div className="mx-auto max-w-[1360px] px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[#FAF5EA]/12 pb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#FFAA2B]">
              Research Methodology · Governance · Data Provenance
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold md:text-5xl">
              About SolarSense Egypt
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-[#FAF5EA]/75">
              Physics-Guided Solar Energy Forecasting, Rooftop Sizing, and Operational Decision Support across Egypt&apos;s four distinct solar climate regimes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/models"
              className="rounded-lg bg-[#FFAA2B] px-5 py-2.5 text-sm font-semibold text-[#110D08] transition hover:bg-[#FFB94A]"
            >
              View Research Benchmark →
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-[#FAF5EA]/25 bg-[#1b1611] px-4 py-2.5 text-sm font-medium text-[#FAF5EA] transition hover:bg-[#262019]"
            >
              Day Arc Planner
            </Link>
          </div>
        </div>

        {/* Pipeline Overview */}
        <section className="mt-10 rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
            End-to-End Scientific Pipeline
          </div>
          <h2 className="mt-2 font-serif text-2xl font-semibold">
            Two-Stage Hybrid Architecture (ERA5 → pvlib → XGBoost / LSTM / PGNN)
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-5">
              <div className="font-mono text-xs font-semibold text-[#FFAA2B]">STAGE 01 · DATA ARCHIVE</div>
              <h3 className="mt-2 font-serif text-lg font-semibold">Copernicus ERA5 Reanalysis</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#FAF5EA]/75">
                Verified 7-year archive (<span className="font-mono text-[#FAF5EA]">2020–2026</span>) covering{" "}
                <span className="font-mono text-[#FAF5EA]">990 grid cells</span> across Egypt (33 lat × 30 lon at 0.25° × 0.25° resolution,{" "}
                <span className="font-mono text-[#FAF5EA]">16 daytime hours 02:00–17:00 UTC</span> per day).
              </p>
              <div className="mt-3 font-mono text-[10px] text-[#FAF5EA]/55">
                Variables: ssrd (GHI), fdir (DNI), ssrdc (Clear-Sky), t2m, d2m, sp, u10/v10, tcc/hcc/mcc/lcc
              </div>
            </div>

            <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-5">
              <div className="font-mono text-xs font-semibold text-[#FFAA2B]">STAGE 02 · PHYSICS ENGINE</div>
              <h3 className="mt-2 font-serif text-lg font-semibold">pvlib Clear-Sky & POA</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#FAF5EA]/75">
                Computes exact solar zenith/azimuth geometry, Perez/Hay-Davies Plane-of-Array transposition (<span className="font-mono">G_POA</span>), and clearness index{" "}
                <span className="font-mono text-[#FAF5EA]">k_t = GHI / GHI_clear</span> to normalize diurnal &amp; seasonal cycles.
              </p>
              <div className="mt-3 font-mono text-[10px] text-[#FAF5EA]/55">
                Plus Faiman cell temperature model: T_cell = T_amb + G_POA / (U0 + U1 · WS)
              </div>
            </div>

            <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-5">
              <div className="font-mono text-xs font-semibold text-[#FFAA2B]">STAGE 03 · AI FORECASTERS</div>
              <h3 className="mt-2 font-serif text-lg font-semibold">XGBoost, LSTM &amp; PGNN</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#FAF5EA]/75">
                Trained with strict chronological splits (<span className="font-mono">2020–2024 Train</span>,{" "}
                <span className="font-mono">2025 Val</span>, <span className="font-mono">2026 Held-out Test</span>). PGNN enforces{" "}
                <span className="font-mono">0 ≤ GHI ≤ GHI_clear</span> and outputs P10/P50/P90 quantiles.
              </p>
              <div className="mt-3 font-mono text-[10px] text-[#FAF5EA]/55">
                Benchmarked against Persistence, Smart Persistence, and CLIPER
              </div>
            </div>

            <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-5">
              <div className="font-mono text-xs font-semibold text-[#FFAA2B]">STAGE 04 · PLAN + OPERATE</div>
              <h3 className="mt-2 font-serif text-lg font-semibold">Decision Support &amp; Sizing</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#FAF5EA]/75">
                Translates physics-validated irradiance into technology-specific AC yield (<span className="font-mono">pc-Si</span>,{" "}
                <span className="font-mono">a-Si:H/sc-Si HJT</span>, <span className="font-mono">CIGS</span>), EETC FY 2024/2025 payback, and deterministic load scheduling.
              </p>
              <div className="mt-3 font-mono text-[10px] text-[#FAF5EA]/55">
                Grounded AI Assistant with zero hallucinated numbers
              </div>
            </div>
          </div>
        </section>

        {/* Four Climate Regions & Three Technologies */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
              Spatial Coverage
            </div>
            <h2 className="mt-1 font-serif text-2xl font-semibold">
              Four Egyptian Solar Climate Regions
            </h2>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FAF5EA]">R1 · North Coast &amp; Nile Delta</span>
                  <span className="font-mono text-[#FFAA2B]">Alexandria, Cairo, Tanta, El Alamein</span>
                </div>
                <p className="mt-1 text-[#FAF5EA]/70">
                  Mediterranean coastal &amp; semi-arid urban climate. Moderate winter cloud transients, cool sea breeze, lower ambient temperatures.
                </p>
              </div>
              <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FAF5EA]">R2 · Western Desert Oases</span>
                  <span className="font-mono text-[#FFAA2B]">Siwa, Bahariya, Farafra, Kharga</span>
                </div>
                <p className="mt-1 text-[#FAF5EA]/70">
                  Hyper-arid continental desert. Extreme spring Khamaseen dust storms and high summer heat anomalies where HJT and CIGS excel.
                </p>
              </div>
              <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FAF5EA]">R3 · Sinai &amp; Red Sea Coast</span>
                  <span className="font-mono text-[#FFAA2B]">Hurghada, Sharm, Zafarana, St. Catherine</span>
                </div>
                <p className="mt-1 text-[#FAF5EA]/70">
                  Coastal-orographic wind corridor. Strong convective cooling (Faiman wind benefit) and high direct normal irradiance.
                </p>
              </div>
              <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#FAF5EA]">R4 · Nile Valley &amp; Upper Egypt</span>
                  <span className="font-mono text-[#FFAA2B]">Assiut, Luxor, Qena, Aswan (Benban)</span>
                </div>
                <p className="mt-1 text-[#FAF5EA]/70">
                  World-class solar belt (~6.8 kWh/m²/day peak). Clear skies 340+ days/year with extreme summer cell temperatures exceeding 60°C.
                </p>
              </div>
            </div>
          </div>

          {/* 4 Honesty Rules */}
          <div className="rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
              Scientific Integrity &amp; Engineering Rules
            </div>
            <h2 className="mt-1 font-serif text-2xl font-semibold">
              The 4 Platform Honesty Guarantees
            </h2>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-[#72B86A]/25 bg-[#72B86A]/10 p-4">
                <div className="font-mono font-semibold text-[#72B86A]">
                  RULE 01 · ZERO HARDCODED WEATHER ARRAYS
                </div>
                <p className="mt-1 text-[#FAF5EA]/80">
                  Every chart, forecast table, and sizing calculation reads through the centralized{" "}
                  <span className="font-mono">WeatherProvider</span> and <span className="font-mono">PredictionProvider</span> interfaces backed by our 2020–2026 ERA5 baseline and pvlib physics equations.
                </p>
              </div>

              <div className="rounded-xl border border-[#FFAA2B]/25 bg-[#FFAA2B]/10 p-4">
                <div className="font-mono font-semibold text-[#FFAA2B]">
                  RULE 02 · EXPLICIT DATA PROVENANCE BADGES
                </div>
                <p className="mt-1 text-[#FAF5EA]/80">
                  Every prediction clearly displays its provenance mode: either{" "}
                  <span className="font-mono text-[#FAF5EA]">Historical Replay (2026 ERA5 Held-Out Test)</span> or{" "}
                  <span className="font-mono text-[#FAF5EA]">Experimental Live Mode (Open-Meteo NWP Bridge)</span> with domain-shift disclosure.
                </p>
              </div>

              <div className="rounded-xl border border-[#38BDF8]/25 bg-[#38BDF8]/10 p-4">
                <div className="font-mono font-semibold text-[#38BDF8]">
                  RULE 03 · DETERMINISTIC SOLVERS OVER LLM GUESSWORK
                </div>
                <p className="mt-1 text-[#FAF5EA]/80">
                  Financial ROI, EETC tariff step calculations, and optimal load scheduling are executed by deterministic TypeScript/Python solvers—never delegated to generative text approximations.
                </p>
              </div>

              <div className="rounded-xl border border-[#FAF5EA]/20 bg-[#1d1812] p-4">
                <div className="font-mono font-semibold text-[#FAF5EA]">
                  RULE 04 · GROUNDED AI WITH TOOL TRACEABILITY
                </div>
                <p className="mt-1 text-[#FAF5EA]/80">
                  The AI Operations Assistant is restricted to structured read-only tools (<span className="font-mono">get_site_forecast</span>,{" "}
                  <span className="font-mono">recommend_load_window</span>, <span className="font-mono">compare_panel_technologies</span>,{" "}
                  <span className="font-mono">get_model_benchmark</span>) and exposes every tool call trace in the UI.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Credits & Footage Attribution */}
        <section className="mt-8 rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
                Graduation Project 2026 · Team &amp; Attribution
              </div>
              <h3 className="mt-1 font-serif text-xl font-semibold">
                Data Sources, Open-Source Stack &amp; Pexels Footage Credits
              </h3>
              <p className="mt-1 text-xs text-[#FAF5EA]/70">
                Meteorological data: Copernicus Climate Change Service (C3S) ERA5 (2020–2026). Physics: pvlib-python &amp; Faiman model. Tariffs: Egyptian Electric Utility &amp; Consumer Protection Regulatory Agency (EgyptERA / EETC FY 2024/2025).
              </p>
            </div>
            <div className="font-mono text-xs text-[#FAF5EA]/60">
               footage: Pexels License (Free for commercial &amp; academic use) · 9 clips in /public/footage/web/
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

