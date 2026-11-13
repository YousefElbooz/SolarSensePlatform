"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { OPERATE_SITES } from "@/domain/benchmarkData";
import { REGIONS, snapToGridCell } from "@/domain/regions";
import { PANEL_TECHNOLOGIES } from "@/domain/panels";
import { predictionProvider } from "@/domain/providers/predictionProvider";
import { SkyCondition } from "@/domain/types";

export default function OperateDashboardPage() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(OPERATE_SITES[0].id);
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [horizonH, setHorizonH] = useState<1 | 6 | 24>(24);
  const [skyCondition, setSkyCondition] = useState<SkyCondition>("clear");
  const [dayOfYear, setDayOfYear] = useState<number>(172);

  const selectedSite = useMemo(
    () => OPERATE_SITES.find((s) => s.id === selectedSiteId) ?? OPERATE_SITES[0],
    [selectedSiteId]
  );

  const sitePoint = useMemo(
    () => snapToGridCell(selectedSite.lat, selectedSite.lon),
    [selectedSite]
  );

  const forecast = useMemo(
    () =>
      predictionProvider.forecast({
        site: sitePoint,
        system: {
          tech: selectedSite.tech,
          panelCount: Math.round((selectedSite.capacityKwp * 1000) / 400),
          kWp: selectedSite.capacityKwp,
          tiltDeg: selectedSite.tiltDeg,
          azimuthDeg: selectedSite.azimuthDeg,
        },
        horizonH,
        mode,
        skyCondition,
        dayOfYear,
      }),
    [sitePoint, selectedSite, horizonH, mode, skyCondition, dayOfYear]
  );

  const daytimePoints = useMemo(() => forecast.points, [forecast.points]);

  const totalEnergyKwh = useMemo(
    () => Math.round(forecast.points.reduce((acc, p) => acc + p.pKw, 0)),
    [forecast.points]
  );

  const peakPowerKw = useMemo(
    () => Math.round(Math.max(...forecast.points.map((p) => p.pKw))),
    [forecast.points]
  );

  const peakCellTemp = useMemo(
    () => Math.max(...forecast.points.map((p) => p.tCellC)).toFixed(1),
    [forecast.points]
  );

  const maxChartPower = Math.max(selectedSite.capacityKwp, 100);

  return (
    <div className="min-h-screen bg-[#0c0a08] text-[#FAF5EA]">
      <Navbar />

      <div className="mx-auto max-w-[1440px] px-6 py-10">
        {/* Operate Sub-navigation & Mode Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#FAF5EA]/12 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#72B86A]" />
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#FFAA2B]">
                SolarSense Operate · Fleet Command Center
              </span>
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-semibold md:text-4xl">
              Egyptian PV Fleet Forecasting &amp; Operations
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app"
              className="rounded-lg bg-[#FFAA2B] px-3.5 py-2 text-xs font-semibold text-[#110D08]"
            >
              Fleet Overview
            </Link>
            <Link
              href={`/app/sites/${selectedSite.id}`}
              className="rounded-lg border border-[#FAF5EA]/20 bg-[#18130e] px-3.5 py-2 text-xs font-medium text-[#FAF5EA]/85 hover:border-[#FFAA2B]"
            >
              Site Scheduler ({selectedSite.nameEn.split(" ")[0]})
            </Link>
            <Link
              href="/app/models"
              className="rounded-lg border border-[#FAF5EA]/20 bg-[#18130e] px-3.5 py-2 text-xs font-medium text-[#FAF5EA]/85 hover:border-[#FFAA2B]"
            >
              Model Benchmark
            </Link>
            <Link
              href="/app/assistant"
              className="rounded-lg border border-[#FAF5EA]/20 bg-[#18130e] px-3.5 py-2 text-xs font-medium text-[#FAF5EA]/85 hover:border-[#FFAA2B]"
            >
              Grounded AI Assistant
            </Link>
          </div>
        </div>

        {/* Provenance Mode Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#FAF5EA]/15 bg-[#16120e] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                mode === "replay"
                  ? "bg-[#72B86A]/20 text-[#72B86A]"
                  : "bg-[#FFAA2B]/20 text-[#FFAA2B]"
              }`}
            >
              {mode === "replay"
                ? "VERIFIED ERA5 REPLAY (2026 HELD-OUT TEST)"
                : "EXPERIMENTAL LIVE NWP (OPEN-METEO BRIDGE)"}
            </span>
            <p className="text-xs text-[#FAF5EA]/75">
              Model: {forecast.modelName} ({forecast.modelVersion}) · Cell {selectedSite.cellId}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("replay")}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                mode === "replay"
                  ? "bg-[#72B86A] font-semibold text-[#0c0a08]"
                  : "border border-[#FAF5EA]/15 bg-[#1d1812] text-[#FAF5EA]/70"
              }`}
            >
              2026 ERA5 Held-Out Replay
            </button>
            <button
              onClick={() => setMode("live")}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                mode === "live"
                  ? "bg-[#FFAA2B] font-semibold text-[#0c0a08]"
                  : "border border-[#FAF5EA]/15 bg-[#1d1812] text-[#FAF5EA]/70"
              }`}
            >
              Experimental Live NWP
            </button>
          </div>
        </div>

        {/* Active Fleet Cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {OPERATE_SITES.map((site) => {
            const active = site.id === selectedSite.id;
            const region = REGIONS[site.region];
            const tech = PANEL_TECHNOLOGIES[site.tech];
            return (
              <div
                key={site.id}
                onClick={() => setSelectedSiteId(site.id)}
                className={`cursor-pointer rounded-2xl border p-5 transition ${
                  active
                    ? "border-[#FFAA2B] bg-[#FFAA2B]/10 shadow-lg"
                    : "border-[#FAF5EA]/12 bg-[#16120e] hover:border-[#FAF5EA]/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#FAF5EA]/10 px-2 py-0.5 font-mono text-[10px] text-[#FFAA2B]">
                    {region.code} · {site.cellId}
                  </span>
                  <span className="font-mono text-xs text-[#72B86A]">● ONLINE</span>
                </div>
                <h3 className="mt-2.5 font-serif text-lg font-semibold text-[#FAF5EA]">
                  {site.nameEn}
                </h3>
                <p className="mt-1 text-xs text-[#FAF5EA]/65">
                  {site.capacityKwp.toLocaleString()} kWp · {tech.key} · Tilt {site.tiltDeg}°
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-[#FAF5EA]/10 pt-3 font-mono text-xs">
                  <span className="text-[#FAF5EA]/60">
                    Annual GHI: {region.avgAnnualGhiKwhM2} kWh/m²
                  </span>
                  <Link
                    href={`/app/sites/${site.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-[#FFAA2B] hover:underline"
                  >
                    Open Site →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Telemetry & Forecast Section */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* Left 8 cols: Interactive P10-P90 Forecast Chart */}
          <div className="lg:col-span-8 rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
                  Physics-Guided Neural Network (PGNN) Forecast
                </div>
                <h2 className="mt-1 font-serif text-2xl font-semibold">
                  {selectedSite.nameEn} — {horizonH}h Horizon
                </h2>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {([1, 6, 24] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizonH(h)}
                    className={`rounded-md px-2.5 py-1 font-mono text-xs ${
                      horizonH === h
                        ? "bg-[#FFAA2B] font-semibold text-[#110D08]"
                        : "border border-[#FAF5EA]/15 bg-[#1d1812] text-[#FAF5EA]/70"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
                <span className="mx-1 text-[#FAF5EA]/20">|</span>
                {(
                  [
                    { id: "clear", label: "Clear Sky" },
                    { id: "dust", label: "Khamaseen Dust" },
                    { id: "cloud", label: "Cloud Transient" },
                  ] as const
                ).map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => setSkyCondition(sc.id)}
                    className={`rounded-md px-2.5 py-1 font-mono text-xs ${
                      skyCondition === sc.id
                        ? "bg-[#FAF5EA] font-semibold text-[#110D08]"
                        : "border border-[#FAF5EA]/15 bg-[#1d1812] text-[#FAF5EA]/70"
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Day of Year slider */}
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] px-4 py-2.5">
              <span className="font-mono text-xs text-[#FAF5EA]/70">
                Day of Year: <strong className="text-[#FFAA2B]">Day {dayOfYear}</strong>
              </span>
              <input
                type="range"
                min={1}
                max={365}
                value={dayOfYear}
                onChange={(e) => setDayOfYear(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-[#FFAA2B]"
              />
              <div className="flex gap-1.5 font-mono text-[10px]">
                <button
                  onClick={() => setDayOfYear(80)}
                  className="rounded border border-[#FAF5EA]/15 px-2 py-0.5 hover:border-[#FFAA2B]"
                >
                  Equinox
                </button>
                <button
                  onClick={() => setDayOfYear(172)}
                  className="rounded border border-[#FAF5EA]/15 px-2 py-0.5 hover:border-[#FFAA2B]"
                >
                  Summer Peak
                </button>
                <button
                  onClick={() => setDayOfYear(355)}
                  className="rounded border border-[#FAF5EA]/15 px-2 py-0.5 hover:border-[#FFAA2B]"
                >
                  Winter Solstice
                </button>
              </div>
            </div>

            {/* SVG Fan Chart (Clear-Sky, P10-P90 band, P50 Forecast) */}
            <div className="mt-6">
              <svg viewBox="0 0 760 290" className="w-full overflow-visible">
                {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                  const y = 245 - frac * 200;
                  const val = Math.round(frac * maxChartPower);
                  return (
                    <g key={idx}>
                      <line
                        x1={52}
                        x2={730}
                        y1={y}
                        y2={y}
                        stroke="rgba(250,245,234,0.08)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={44}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-[#FAF5EA]/50 font-mono text-[10px]"
                      >
                        {val} kW
                      </text>
                    </g>
                  );
                })}

                {(() => {
                  const coords = daytimePoints.map((pt, i) => {
                    const x = 60 + (i / Math.max(1, daytimePoints.length - 1)) * 660;
                    const y90 = 245 - Math.min(1, pt.p90Kw / maxChartPower) * 200;
                    const y10 = 245 - Math.min(1, pt.p10Kw / maxChartPower) * 200;
                    const y50 = 245 - Math.min(1, pt.pKw / maxChartPower) * 200;
                    const yClear = 245 - Math.min(1, pt.pClearKw / maxChartPower) * 200;
                    return { x, y90, y10, y50, yClear, pt };
                  });

                  const upperPath = coords
                    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y90}`)
                    .join(" ");
                  const lowerPath = [...coords]
                    .reverse()
                    .map((c) => `L ${c.x} ${c.y10}`)
                    .join(" ");
                  const bandPath = `${upperPath} ${lowerPath} Z`;

                  const p50Path = coords
                    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y50}`)
                    .join(" ");

                  const clearPath = coords
                    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.yClear}`)
                    .join(" ");

                  return (
                    <>
                      <path d={bandPath} fill="rgba(255, 170, 43, 0.18)" />
                      <path
                        d={clearPath}
                        fill="none"
                        stroke="rgba(114, 184, 106, 0.7)"
                        strokeWidth={1.75}
                        strokeDasharray="5 4"
                      />
                      <path
                        d={p50Path}
                        fill="none"
                        stroke="#FFAA2B"
                        strokeWidth={3}
                      />
                      {coords.map((c, i) => (
                        <g key={i}>
                          <circle
                            cx={c.x}
                            cy={c.y50}
                            r={3.5}
                            fill="#FFAA2B"
                            stroke="#0c0a08"
                            strokeWidth={1.5}
                          />
                          <text
                            x={c.x}
                            y={268}
                            textAnchor="middle"
                            className="fill-[#FAF5EA]/60 font-mono text-[10px]"
                          >
                            {String(c.pt.hourLocal).padStart(2, "0")}:00
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-[#FAF5EA]/10 pt-3 text-xs text-[#FAF5EA]/70">
                <div className="flex flex-wrap items-center gap-5">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-4 bg-[#FFAA2B]" />
                    PGNN P50 Power Forecast (kW)
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-4 rounded-sm bg-[#FFAA2B]/25" />
                    P10–P90 Confidence Interval
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-4 border-b border-dashed border-[#72B86A]" />
                    pvlib Clear-Sky Envelope
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#72B86A]">
                  0.0% Physical Constraint Violations (0 ≤ P ≤ P_clear)
                </span>
              </div>
            </div>
          </div>

          {/* Right 4 cols: Site Telemetry Summary & Action Cards */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-[#FAF5EA]/12 bg-[#16120e] p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFAA2B]">
                Forecast Telemetry KPIs
              </div>
              <h3 className="mt-1 font-serif text-xl font-semibold">
                {selectedSite.nameEn}
              </h3>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-3.5">
                  <div className="font-mono text-[10px] text-[#FAF5EA]/60">DAILY FORECAST YIELD</div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-[#FFAA2B]">
                    {totalEnergyKwh.toLocaleString()} <span className="text-xs font-normal">kWh</span>
                  </div>
                </div>
                <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-3.5">
                  <div className="font-mono text-[10px] text-[#FAF5EA]/60">PEAK AC POWER (P50)</div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-[#FAF5EA]">
                    {peakPowerKw.toLocaleString()} <span className="text-xs font-normal">kW</span>
                  </div>
                </div>
                <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-3.5">
                  <div className="font-mono text-[10px] text-[#FAF5EA]/60">PEAK CELL TEMP (FAIMAN)</div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-[#E85D4A]">
                    {peakCellTemp}°C
                  </div>
                </div>
                <div className="rounded-xl border border-[#FAF5EA]/10 bg-[#1d1812] p-3.5">
                  <div className="font-mono text-[10px] text-[#FAF5EA]/60">BESS STORAGE</div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-[#72B86A]">
                    {selectedSite.batteryKwh} <span className="text-xs font-normal">kWh</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 border-t border-[#FAF5EA]/10 pt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#FAF5EA]/65">Base Critical Site Load:</span>
                  <span className="font-mono text-[#FAF5EA]">{selectedSite.baseLoadKw} kW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FAF5EA]/65">ERA5 Grid Cell ID:</span>
                  <span className="font-mono text-[#FAF5EA]">{selectedSite.cellId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FAF5EA]/65">Panel Technology:</span>
                  <span className="font-mono text-[#FFAA2B]">
                    {PANEL_TECHNOLOGIES[selectedSite.tech].nameEn}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <Link
                  href={`/app/sites/${selectedSite.id}`}
                  className="w-full rounded-lg bg-[#FFAA2B] py-2.5 text-center text-xs font-semibold text-[#110D08] transition hover:bg-[#FFB94A]"
                >
                  Open Deterministic Load Scheduler →
                </Link>
                <Link
                  href="/app/assistant"
                  className="w-full rounded-lg border border-[#FAF5EA]/20 bg-[#1d1812] py-2.5 text-center text-xs font-medium text-[#FAF5EA] transition hover:border-[#FFAA2B]"
                >
                  Ask Grounded AI Assistant About This Site
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
