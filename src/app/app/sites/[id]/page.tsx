"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { OPERATE_SITES } from "@/domain/benchmarkData";
import { REGIONS, snapToGridCell } from "@/domain/regions";
import { PANEL_TECHNOLOGIES } from "@/domain/panels";
import { predictionProvider } from "@/domain/providers/predictionProvider";
import { DEFAULT_FLEXIBLE_LOADS, recommendOptimalLoadWindow } from "@/domain/scheduler";
import { FlexibleLoadItem, SkyCondition } from "@/domain/types";

export default function SiteDetailSchedulerPage() {
  const params = useParams();
  const router = useRouter();
  const siteIdParam = typeof params?.id === "string" ? params.id : OPERATE_SITES[0].id;

  const site = useMemo(
    () => OPERATE_SITES.find((s) => s.id === siteIdParam) ?? OPERATE_SITES[0],
    [siteIdParam]
  );

  const sitePoint = useMemo(() => snapToGridCell(site.lat, site.lon), [site]);

  const [skyCondition, setSkyCondition] = useState<SkyCondition>("clear");
  const [dayOfYear, setDayOfYear] = useState<number>(172);
  const [loadName, setLoadName] = useState<string>(DEFAULT_FLEXIBLE_LOADS[0].name);
  const [loadPowerKw, setLoadPowerKw] = useState<number>(
    Math.min(240, Math.round(site.capacityKwp * 0.35))
  );
  const [durationH, setDurationH] = useState<number>(3);

  const forecast = useMemo(
    () =>
      predictionProvider.forecast({
        site: sitePoint,
        system: {
          tech: site.tech,
          panelCount: Math.round((site.capacityKwp * 1000) / 400),
          kWp: site.capacityKwp,
          tiltDeg: site.tiltDeg,
          azimuthDeg: site.azimuthDeg,
        },
        horizonH: 24,
        mode: site.status === "online-live" ? "live" : "replay",
        skyCondition,
        dayOfYear,
      }),
    [sitePoint, site, dayOfYear, skyCondition]
  );

  const customLoad: FlexibleLoadItem = useMemo(
    () => ({
      id: "custom-load",
      siteId: site.id,
      name: loadName,
      category: "pump",
      powerKw: loadPowerKw,
      durationH,
      earliestHour: 7,
      deadlineHour: 18,
      priority: 1,
    }),
    [site.id, loadName, loadPowerKw, durationH]
  );

  const scheduleResult = useMemo(
    () => recommendOptimalLoadWindow(forecast.points, customLoad, site.baseLoadKw),
    [forecast.points, customLoad, site.baseLoadKw]
  );

  const presetSchedules = useMemo(
    () =>
      DEFAULT_FLEXIBLE_LOADS.map((ld) =>
        recommendOptimalLoadWindow(forecast.points, ld, site.baseLoadKw)
      ),
    [forecast.points, site.baseLoadKw]
  );

  const region = REGIONS[site.region];
  const tech = PANEL_TECHNOLOGIES[site.tech];

  return (
    <div className="min-h-screen bg-[#0c0a08] text-[#FAF5EA]">
      <Navbar />

      <div className="mx-auto max-w-[1440px] px-6 py-10">
        {/* Header & Site Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#FAF5EA]/12 pb-6">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[#FFAA2B]">
              <span>Operate Site Telemetry &amp; Deterministic Load Scheduler</span>
              <span>·</span>
              <span>
                {region.code} ({site.cellId})
              </span>
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-semibold md:text-4xl">
              {site.nameEn}
            </h1>
            <p className="mt-1 text-xs text-[#FAF5EA]/70">
              Capacity: {site.capacityKwp.toLocaleString()} kWp · Technology: {tech.nameEn} ({tech.key}) · Base Load: {site.baseLoadKw} kW · BESS: {site.batteryKwh} kWh
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={site.id}
              onChange={(e) => router.push(`/app/sites/${e.target.value}`)}
              className="rounded-lg border border-[#FAF5EA]/20 bg-[#18130e] px-3.5 py-2 font-mono text-xs text-[#FAF5EA] focus:border-[#FFAA2B] focus:outline-none"
            >
              {OPERATE_SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn}
                </option>
              ))}
            </select>
            <Link
              href="/app"
              className="rounded-lg border border-[#FAF5EA]/20 bg-[#18130e] px-3.5 py-2 text-xs font-medium text-[#FAF5EA]/85 hover:border-[#FFAA2B]"
            >
              ← Fleet Overview
            </Link>
            <Link
              href={`/twin?tech=${site.tech}`}
              className="rounded-lg bg-[#FFAA2B] px-3.5 py-2 text-xs font-semibold text-[#110D08] hover:bg-[#FFB94A]"
            >
              Inspect in 3D Twin →
            </Link>
          </div>
        </div>

        {/* Top Grid: Deterministic Load Scheduler Controls + Optimal Recommendation */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* Scheduler Configuration (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
              Deterministic Optimization Engine
            </div>
            <h2 className="mt-1 font-serif text-2xl font-semibold">
              Flexible Load Window Solver
            </h2>
            <p className="mt-1 text-xs text-[#FAF5EA]/70">
              Evaluates every contiguous daytime block (07:00–18:00) against both expected P50 solar surplus and conservative P10 lower-bound surplus above the {site.baseLoadKw} kW base load.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block font-mono text-xs text-[#FAF5EA]/75">
                  Dispatchable Industrial / Agricultural Load
                </label>
                <input
                  type="text"
                  value={loadName}
                  onChange={(e) => setLoadName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#FAF5EA]/20 bg-[#1d1812] px-3 py-2 text-xs text-[#FAF5EA] focus:border-[#FFAA2B] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-[#FAF5EA]/75">Flexible Load Power Demand</span>
                  <span className="font-semibold text-[#FFAA2B]">{loadPowerKw} kW</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={Math.max(150, site.capacityKwp)}
                  step={10}
                  value={loadPowerKw}
                  onChange={(e) => setLoadPowerKw(Number(e.target.value))}
                  className="mt-2 h-1.5 w-full cursor-pointer accent-[#FFAA2B]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[#FAF5EA]/75">
                  Required Contiguous Duration
                </label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 6].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationH(d)}
                      className={`rounded-lg border py-2 font-mono text-xs transition ${
                        durationH === d
                          ? "border-[#FFAA2B] bg-[#FFAA2B] font-semibold text-[#110D08]"
                          : "border-[#FAF5EA]/15 bg-[#1d1812] text-[#FAF5EA]/75 hover:border-[#FAF5EA]/40"
                      }`}
                    >
                      {d} hr{d > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#FAF5EA]/75">
                  Simulated Atmospheric Regime
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "clear", label: "Clear Sky" },
                      { id: "dust", label: "Khamaseen Dust" },
                      { id: "cloud", label: "Cloud Transient" },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSkyCondition(sc.id)}
                      className={`rounded-lg border py-2 font-mono text-xs transition ${
                        skyCondition === sc.id
                          ? "border-[#FAF5EA] bg-[#FAF5EA] font-semibold text-[#110D08]"
                          : "border-[#FAF5EA]/15 bg-[#1d1812] text-[#FAF5EA]/75"
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Optimal Dispatch Recommendation Card (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#72B86A]">
                  Optimal Contiguous Dispatch Window
                </div>
                <h2 className="mt-1 font-serif text-3xl font-semibold text-[#FAF5EA]">
                  {scheduleResult.windowLabel} Local
                </h2>
              </div>
              <span className="rounded-full border border-[#72B86A]/40 bg-[#72B86A]/15 px-3.5 py-1 font-mono text-xs font-semibold text-[#72B86A]">
                Expected Solar Coverage: {scheduleResult.solarCoveragePct}%
              </span>
            </div>

            {/* KPIs */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-3.5">
                <div className="font-mono text-[10px] text-[#FAF5EA]/60">REQUIRED ENERGY</div>
                <div className="mt-1 font-serif text-xl font-semibold">
                  {scheduleResult.requiredEnergyKwh.toLocaleString()} kWh
                </div>
              </div>
              <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-3.5">
                <div className="font-mono text-[10px] text-[#FAF5EA]/60">P10 SAFE COVERAGE</div>
                <div
                  className={`mt-1 font-serif text-xl font-semibold ${
                    scheduleResult.p10CoveragePct >= 80
                      ? "text-[#72B86A]"
                      : "text-[#FFAA2B]"
                  }`}
                >
                  {scheduleResult.p10CoveragePct}%
                </div>
              </div>
              <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-3.5">
                <div className="font-mono text-[10px] text-[#FAF5EA]/60">TARIFF SAVING</div>
                <div className="mt-1 font-serif text-xl font-semibold text-[#FFAA2B]">
                  {scheduleResult.costSavedEgp.toLocaleString()} EGP
                </div>
              </div>
              <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-3.5">
                <div className="font-mono text-[10px] text-[#FAF5EA]/60">DIESEL AVOIDED</div>
                <div className="mt-1 font-serif text-xl font-semibold text-[#72B86A]">
                  {scheduleResult.dieselAvoidedLiters} L
                </div>
              </div>
            </div>

            {/* P10 Risk Warning or Verified Safe Banner */}
            <div
              className={`mt-4 rounded-xl border p-4 text-xs text-[#FAF5EA] ${
                scheduleResult.riskLevel === "low"
                  ? "border-[#72B86A]/35 bg-[#72B86A]/10"
                  : scheduleResult.riskLevel === "medium"
                    ? "border-[#FFAA2B]/35 bg-[#FFAA2B]/10"
                    : "border-[#E85D4A]/40 bg-[#E85D4A]/15"
              }`}
            >
              <div
                className={`font-mono font-semibold uppercase ${
                  scheduleResult.riskLevel === "low"
                    ? "text-[#72B86A]"
                    : scheduleResult.riskLevel === "medium"
                      ? "text-[#FFAA2B]"
                      : "text-[#E85D4A]"
                }`}
              >
                {scheduleResult.riskLevel === "low"
                  ? "✓ VERIFIED P10 ROBUST WINDOW (LOW RISK)"
                  : `⚠ P10 CONSERVATIVE RISK LEVEL: ${scheduleResult.riskLevel.toUpperCase()}`}
              </div>
              <p className="mt-1">{scheduleResult.rationale}</p>
            </div>

            {/* Multi-Load Queue Table */}
            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#FAF5EA]/60">
                Site Flexible Load Queue (Validated by Deterministic Engine)
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#FAF5EA]/15 text-[#FAF5EA]/60">
                      <th className="py-2">Flexible Load</th>
                      <th className="py-2">Demand</th>
                      <th className="py-2">Optimal Window</th>
                      <th className="py-2">Expected Cov.</th>
                      <th className="py-2">P10 Safe</th>
                      <th className="py-2 text-right">Diesel Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presetSchedules.map((w) => (
                      <tr key={w.loadId} className="border-b border-[#FAF5EA]/10 text-[#FAF5EA]/85">
                        <td className="py-2.5 font-semibold">{w.loadName}</td>
                        <td className="py-2.5">
                          {w.powerKw} kW × {w.durationH}h
                        </td>
                        <td className="py-2.5 text-[#FFAA2B]">{w.windowLabel}</td>
                        <td className="py-2.5 text-[#72B86A]">{w.solarCoveragePct}%</td>
                        <td className="py-2.5">{w.p10CoveragePct}%</td>
                        <td className="py-2.5 text-right">{w.dieselAvoidedLiters} L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Daytime Telemetry & Physics Breakdown Table */}
        <div className="mt-8 rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
                Hourly Daytime Physics &amp; Quantile Table
              </div>
              <h3 className="mt-1 font-serif text-xl font-semibold">
                {region.nameEn} ({site.cellId}) — Hourly Irradiance, Faiman Cell Temp &amp; AC Output
              </h3>
            </div>
            <span className="font-mono text-xs text-[#72B86A]">
              Highlighted rows indicate the optimal {durationH}h dispatch window ({scheduleResult.windowLabel})
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#FAF5EA]/15 text-[#FAF5EA]/60">
                  <th className="py-2.5">Hour</th>
                  <th className="py-2.5">Elevation (°)</th>
                  <th className="py-2.5">GHI (W/m²)</th>
                  <th className="py-2.5">Clearness k_c</th>
                  <th className="py-2.5">Ambient (°C)</th>
                  <th className="py-2.5">Faiman T_cell (°C)</th>
                  <th className="py-2.5">P10 Bound (kW)</th>
                  <th className="py-2.5">P50 Forecast (kW)</th>
                  <th className="py-2.5">P90 Bound (kW)</th>
                  <th className="py-2.5 text-right">Scheduler Status</th>
                </tr>
              </thead>
              <tbody>
                {forecast.points.map((pt) => {
                  const inBestWindow =
                    pt.hourLocal >= scheduleResult.recommendedStartHour &&
                    pt.hourLocal < scheduleResult.recommendedEndHour;
                  return (
                    <tr
                      key={pt.hourLocal}
                      className={`border-b border-[#FAF5EA]/10 ${
                        inBestWindow ? "bg-[#FFAA2B]/12" : ""
                      }`}
                    >
                      <td className="py-2.5 font-semibold">
                        {String(pt.hourLocal).padStart(2, "0")}:00
                      </td>
                      <td className="py-2.5 text-[#FAF5EA]/65">{pt.solarElevationDeg}°</td>
                      <td className="py-2.5">{pt.ghiWm2}</td>
                      <td className="py-2.5">{pt.kc}</td>
                      <td className="py-2.5">{pt.tAmbC}°C</td>
                      <td
                        className={`py-2.5 ${
                          pt.tCellC >= 50 ? "text-[#E85D4A]" : "text-[#FAF5EA]"
                        }`}
                      >
                        {pt.tCellC}°C
                      </td>
                      <td className="py-2.5 text-[#FAF5EA]/70">{pt.p10Kw} kW</td>
                      <td className="py-2.5 font-semibold text-[#FFAA2B]">{pt.pKw} kW</td>
                      <td className="py-2.5 text-[#FAF5EA]/70">{pt.p90Kw} kW</td>
                      <td className="py-2.5 text-right">
                        {inBestWindow ? (
                          <span className="rounded bg-[#72B86A] px-2 py-0.5 text-[10px] font-semibold text-[#0c0a08]">
                            DISPATCH ACTIVE ({loadPowerKw} kW)
                          </span>
                        ) : (
                          <span className="text-[#FAF5EA]/40">Standby</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
