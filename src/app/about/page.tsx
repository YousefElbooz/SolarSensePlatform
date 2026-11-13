"use client";

import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function AboutPage() {
  return (
    <div className="cinematic-page text-[#f4f5fa]">
      <Navbar />

      <div className="mx-auto max-w-[1380px] px-6 pb-20 pt-28 md:px-10">
        <div
          data-gsap="hero"
          className="flex flex-wrap items-end justify-between gap-6 border-b border-white/12 pb-8"
        >
          <div>
            <p className="eyebrow">
              Research Methodology · Governance · Data Provenance
            </p>
            <h1 className="cinematic-h2 mt-2">
              About{" "}
              <em className="font-normal italic text-[#ffd166]">
                SolarSense Egypt.
              </em>
            </h1>
            <p className="cinematic-lede mt-3 max-w-2xl">
              Physics-Guided Solar Energy Forecasting, Rooftop Sizing, and Operational Decision Support across Egypt&apos;s four distinct solar climate regimes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/app/models" className="btn-pill btn-pill-primary">
              View Research Benchmark →
            </Link>
            <Link href="/" className="btn-pill">
              Day Arc Planner
            </Link>
          </div>
        </div>

        {/* Pipeline Overview */}
        <section data-gsap="section" className="glass mt-10 p-8">
          <div className="eyebrow">End-to-End Scientific Pipeline</div>
          <h2 className="mt-2 font-serif text-2xl font-medium tracking-[-0.02em] text-[#f4f5fa] md:text-3xl">
            Two-Stage Hybrid Architecture{" "}
            <em className="font-normal italic text-[#ffd166]">
              (ERA5 → pvlib → XGBoost / LSTM / PGNN)
            </em>
          </h2>

          <div data-gsap="grid" className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5">
              <div className="font-mono text-[11px] font-semibold tracking-[0.14em] text-[#ffd166]">
                STAGE 01 · DATA ARCHIVE
              </div>
              <h3 className="mt-2 font-serif text-lg font-medium text-[#f4f5fa]">
                Copernicus ERA5 Reanalysis
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#b9bdcf]">
                Verified 7-year archive (<span className="font-mono text-[#f4f5fa]">2020–2026</span>) covering{" "}
                <span className="font-mono text-[#f4f5fa]">990 grid cells</span> across Egypt (33 lat × 30 lon at 0.25° × 0.25° resolution,{" "}
                <span className="font-mono text-[#f4f5fa]">16 daytime hours 02:00–17:00 UTC</span> per day).
              </p>
              <div className="mt-3 font-mono text-[10px] text-[#b9bdcf]/75">
                Variables: ssrd (GHI), fdir (DNI), ssrdc (Clear-Sky), t2m, d2m, sp, u10/v10, tcc/hcc/mcc/lcc
              </div>
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5">
              <div className="font-mono text-[11px] font-semibold tracking-[0.14em] text-[#ffd166]">
                STAGE 02 · PHYSICS ENGINE
              </div>
              <h3 className="mt-2 font-serif text-lg font-medium text-[#f4f5fa]">
                pvlib Clear-Sky &amp; POA
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#b9bdcf]">
                Computes exact solar zenith/azimuth geometry, Perez/Hay-Davies Plane-of-Array transposition (<span className="font-mono text-[#f4f5fa]">G_POA</span>), and clearness index{" "}
                <span className="font-mono text-[#f4f5fa]">k_t = GHI / GHI_clear</span> to normalize diurnal &amp; seasonal cycles.
              </p>
              <div className="mt-3 font-mono text-[10px] text-[#b9bdcf]/75">
                Plus Faiman cell temperature model: T_cell = T_amb + G_POA / (U0 + U1 · WS)
              </div>
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5">
              <div className="font-mono text-[11px] font-semibold tracking-[0.14em] text-[#ffd166]">
                STAGE 03 · AI FORECASTERS
              </div>
              <h3 className="mt-2 font-serif text-lg font-medium text-[#f4f5fa]">
                XGBoost, LSTM &amp; PGNN
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#b9bdcf]">
                Trained with strict chronological splits (<span className="font-mono text-[#f4f5fa]">2020–2024 Train</span>,{" "}
                <span className="font-mono text-[#f4f5fa]">2025 Val</span>, <span className="font-mono text-[#f4f5fa]">2026 Held-out Test</span>). PGNN enforces{" "}
                <span className="font-mono text-[#f4f5fa]">0 ≤ GHI ≤ GHI_clear</span> and outputs P10/P50/P90 quantiles.
              </p>
              <div className="mt-3 font-mono text-[10px] text-[#b9bdcf]/75">
                Benchmarked against Persistence, Smart Persistence, and CLIPER
              </div>
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5">
              <div className="font-mono text-[11px] font-semibold tracking-[0.14em] text-[#ffd166]">
                STAGE 04 · PLAN + OPERATE
              </div>
              <h3 className="mt-2 font-serif text-lg font-medium text-[#f4f5fa]">
                Decision Support &amp; Sizing
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#b9bdcf]">
                Translates physics-validated irradiance into technology-specific AC yield (<span className="font-mono text-[#f4f5fa]">pc-Si</span>,{" "}
                <span className="font-mono text-[#f4f5fa]">a-Si:H/sc-Si HJT</span>, <span className="font-mono text-[#f4f5fa]">CIGS</span>), EETC FY 2024/2025 payback, and deterministic load scheduling.
              </p>
              <div className="mt-3 font-mono text-[10px] text-[#b9bdcf]/75">
                Grounded AI Assistant with zero hallucinated numbers
              </div>
            </div>
          </div>
        </section>

        {/* Four Climate Regions & Four Honesty Rules */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div data-gsap="card" className="glass p-6">
            <div className="eyebrow">Spatial Coverage</div>
            <h2 className="mt-1 font-serif text-2xl font-medium tracking-[-0.02em] text-[#f4f5fa]">
              Four Egyptian Solar Climate Regions
            </h2>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#f4f5fa]">R1 · North Coast &amp; Nile Delta</span>
                  <span className="font-mono text-[#ffd166]">Alexandria, Cairo, Tanta, El Alamein</span>
                </div>
                <p className="mt-1 leading-relaxed text-[#b9bdcf]">
                  Mediterranean coastal &amp; semi-arid urban climate. Moderate winter cloud transients, cool sea breeze, lower ambient temperatures.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#f4f5fa]">R2 · Western Desert Oases</span>
                  <span className="font-mono text-[#ffd166]">Siwa, Bahariya, Farafra, Kharga</span>
                </div>
                <p className="mt-1 leading-relaxed text-[#b9bdcf]">
                  Hyper-arid continental desert. Extreme spring Khamaseen dust storms and high summer heat anomalies where HJT and CIGS excel.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#f4f5fa]">R3 · Sinai &amp; Red Sea Coast</span>
                  <span className="font-mono text-[#ffd166]">Hurghada, Sharm, Zafarana, St. Catherine</span>
                </div>
                <p className="mt-1 leading-relaxed text-[#b9bdcf]">
                  Coastal-orographic wind corridor. Strong convective cooling (Faiman wind benefit) and high direct normal irradiance.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#f4f5fa]">R4 · Nile Valley &amp; Upper Egypt</span>
                  <span className="font-mono text-[#ffd166]">Assiut, Luxor, Qena, Aswan (Benban)</span>
                </div>
                <p className="mt-1 leading-relaxed text-[#b9bdcf]">
                  World-class solar belt (~6.8 kWh/m²/day peak). Clear skies 340+ days/year with extreme summer cell temperatures exceeding 60°C.
                </p>
              </div>
            </div>
          </div>

          {/* 4 Honesty Rules */}
          <div data-gsap="card" className="glass p-6">
            <div className="eyebrow">Scientific Integrity &amp; Engineering Rules</div>
            <h2 className="mt-1 font-serif text-2xl font-medium tracking-[-0.02em] text-[#f4f5fa]">
              The 4 Platform Honesty Guarantees
            </h2>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-[#3fc1c1]/30 bg-[#3fc1c1]/10 p-4">
                <div className="font-mono font-semibold text-[#3fc1c1]">
                  RULE 01 · ZERO HARDCODED WEATHER ARRAYS
                </div>
                <p className="mt-1 leading-relaxed text-[#f4f5fa]/85">
                  Every chart, forecast table, and sizing calculation reads through the centralized{" "}
                  <span className="font-mono">WeatherProvider</span> and <span className="font-mono">PredictionProvider</span> interfaces backed by our 2020–2026 ERA5 baseline and pvlib physics equations.
                </p>
              </div>

              <div className="rounded-xl border border-[#f5a524]/30 bg-[#f5a524]/10 p-4">
                <div className="font-mono font-semibold text-[#ffd166]">
                  RULE 02 · EXPLICIT DATA PROVENANCE BADGES
                </div>
                <p className="mt-1 leading-relaxed text-[#f4f5fa]/85">
                  Every prediction clearly displays its provenance mode: either{" "}
                  <span className="font-mono text-[#f4f5fa]">Historical Replay (2026 ERA5 Held-Out Test)</span> or{" "}
                  <span className="font-mono text-[#f4f5fa]">Experimental Live Mode (Open-Meteo NWP Bridge)</span> with domain-shift disclosure.
                </p>
              </div>

              <div className="rounded-xl border border-[#38BDF8]/30 bg-[#38BDF8]/10 p-4">
                <div className="font-mono font-semibold text-[#38BDF8]">
                  RULE 03 · DETERMINISTIC SOLVERS OVER LLM GUESSWORK
                </div>
                <p className="mt-1 leading-relaxed text-[#f4f5fa]/85">
                  Financial ROI, EETC tariff step calculations, and optimal load scheduling are executed by deterministic TypeScript/Python solvers—never delegated to generative text approximations.
                </p>
              </div>

              <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
                <div className="font-mono font-semibold text-[#f4f5fa]">
                  RULE 04 · GROUNDED AI WITH TOOL TRACEABILITY
                </div>
                <p className="mt-1 leading-relaxed text-[#b9bdcf]">
                  The AI Operations Assistant is restricted to structured read-only tools (<span className="font-mono text-[#f4f5fa]">get_site_forecast</span>,{" "}
                  <span className="font-mono text-[#f4f5fa]">recommend_load_window</span>, <span className="font-mono text-[#f4f5fa]">compare_panel_technologies</span>,{" "}
                  <span className="font-mono text-[#f4f5fa]">get_model_benchmark</span>) and exposes every tool call trace in the UI.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Credits & Footage Attribution */}
        <section data-gsap="section" className="glass mt-8 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="eyebrow">Graduation Project 2026 · Team &amp; Attribution</div>
              <h3 className="mt-1 font-serif text-xl font-medium text-[#f4f5fa]">
                Data Sources, Open-Source Stack &amp; Pexels Footage Credits
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#b9bdcf]">
                Meteorological data: Copernicus Climate Change Service (C3S) ERA5 (2020–2026). Physics: pvlib-python &amp; Faiman model. Tariffs: Egyptian Electric Utility &amp; Consumer Protection Regulatory Agency (EgyptERA / EETC FY 2024/2025).
              </p>
            </div>
            <div className="tag-pill">
              Footage: Pexels License · 9 clips in /public/footage/web/
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
