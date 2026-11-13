'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { OPERATE_SITES } from '@/domain/benchmarkData';
import { REGIONS, snapToGridCell } from '@/domain/regions';
import { PANEL_TECHNOLOGIES } from '@/domain/panels';
import { predictionProvider } from '@/domain/providers/predictionProvider';
import { DEFAULT_FLEXIBLE_LOADS, recommendOptimalLoadWindow } from '@/domain/scheduler';
import { FlexibleLoadItem, SkyCondition } from '@/domain/types';

export default function SiteDetailSchedulerPage() {
  const params = useParams();
  const router = useRouter();
  const siteIdParam = typeof params?.id === 'string' ? params.id : OPERATE_SITES[0].id;

  const site = useMemo(
    () => OPERATE_SITES.find((s) => s.id === siteIdParam) ?? OPERATE_SITES[0],
    [siteIdParam]
  );

  const sitePoint = useMemo(() => snapToGridCell(site.lat, site.lon), [site]);

  const [skyCondition, setSkyCondition] = useState<SkyCondition>('clear');
  const [dayOfYear] = useState<number>(172);
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
        mode: site.status === 'online-live' ? 'live' : 'replay',
        skyCondition,
        dayOfYear,
      }),
    [sitePoint, site, dayOfYear, skyCondition]
  );

  const customLoad: FlexibleLoadItem = useMemo(
    () => ({
      id: 'custom-load',
      siteId: site.id,
      name: loadName,
      category: 'pump',
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
    <div className="cinematic-page pb-20 pt-8">
      <Navbar clockLabel={`${scheduleResult.windowLabel} · Dispatch`} />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        {/* Header & Site Switcher */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.14] pb-6">
          <div>
            <div className="eyebrow">
              Operate Site Telemetry &amp; Deterministic Load Scheduler · {region.code} (
              {site.cellId})
            </div>
            <h1 className="cinematic-h2 mt-2">{site.nameEn}</h1>
            <p className="mt-1 text-xs text-[#b9bdcf]">
              Capacity: {site.capacityKwp.toLocaleString('en-US')} kWp · Technology: {tech.nameEn} (
              {tech.key}) · Base Load: {site.baseLoadKw} kW · BESS: {site.batteryKwh} kWh
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={site.id}
              onChange={(e) => router.push(`/app/sites/${e.target.value}`)}
              className="rounded-full border border-white/[0.16] bg-[#0a0d1c]/80 px-4 py-2 font-mono text-xs text-white focus:border-[#ffd166] focus:outline-none"
            >
              {OPERATE_SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn}
                </option>
              ))}
            </select>
            <Link href="/app" className="btn-pill py-2 px-4 text-xs">
              ← Fleet Overview
            </Link>
            <Link href={`/twin?tech=${site.tech}`} className="btn-pill-primary py-2 px-4 text-xs">
              Inspect in 3D Twin →
            </Link>
          </div>
        </div>

        {/* Top Grid: Deterministic Load Scheduler Controls + Optimal Recommendation */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* Scheduler Configuration (5 cols) */}
          <div className="glass p-6 lg:col-span-5">
            <div className="eyebrow">Deterministic Optimization Engine</div>
            <h2 className="mt-1.5 font-serif text-2xl font-semibold text-white">
              Flexible Load Window Solver
            </h2>
            <p className="mt-1 text-xs text-[#b9bdcf]">
              Evaluates every contiguous daytime block (07:00–18:00) against both expected P50 solar
              surplus and conservative P10 lower-bound surplus above the {site.baseLoadKw} kW base
              load.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block font-mono text-xs text-[#b9bdcf]">
                  Dispatchable Industrial / Agricultural Load
                </label>
                <input
                  type="text"
                  value={loadName}
                  onChange={(e) => setLoadName(e.target.value)}
                  className="mt-1.5 w-full rounded-full border border-white/[0.16] bg-white/[0.04] px-4 py-2 text-xs text-white focus:border-[#ffd166] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-[#b9bdcf]">Flexible Load Power Demand</span>
                  <span className="font-semibold text-[#ffd166]">{loadPowerKw} kW</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={Math.max(150, site.capacityKwp)}
                  step={10}
                  value={loadPowerKw}
                  onChange={(e) => setLoadPowerKw(Number(e.target.value))}
                  className="mt-2 h-1.5 w-full cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[#b9bdcf]">
                  Required Contiguous Duration
                </label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 6].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationH(d)}
                      className={`rounded-full border py-2 font-mono text-xs transition ${
                        durationH === d
                          ? 'border-[#f5a524] bg-[#f5a524] font-semibold text-[#221500]'
                          : 'border-white/[0.16] bg-white/[0.04] text-[#b9bdcf] hover:border-white/40'
                      }`}
                    >
                      {d} hr{d > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#b9bdcf]">
                  Simulated Atmospheric Regime
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'clear', label: 'Clear Sky' },
                      { id: 'dust', label: 'Khamaseen Dust' },
                      { id: 'cloud', label: 'Cloud Transient' },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSkyCondition(sc.id)}
                      className={`rounded-full border py-2 font-mono text-xs transition ${
                        skyCondition === sc.id
                          ? 'border-[#3fc1c1] bg-[#3fc1c1] font-semibold text-[#05070f]'
                          : 'border-white/[0.16] bg-white/[0.04] text-[#b9bdcf]'
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
          <div className="glass p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="eyebrow">Optimal Contiguous Dispatch Window</div>
                <h2 className="mt-1.5 font-serif text-3xl font-semibold text-white">
                  {scheduleResult.windowLabel} Local
                </h2>
              </div>
              <span className="tag-pill live">
                Expected Solar Coverage: {scheduleResult.solarCoveragePct}%
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                <div className="font-mono text-[10px] text-[#b9bdcf]">REQUIRED ENERGY</div>
                <div className="mt-1 font-serif text-xl font-semibold text-white">
                  {scheduleResult.requiredEnergyKwh.toLocaleString('en-US')} kWh
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                <div className="font-mono text-[10px] text-[#b9bdcf]">P10 SAFE COVERAGE</div>
                <div
                  className={`mt-1 font-serif text-xl font-semibold ${
                    scheduleResult.p10CoveragePct >= 80 ? 'text-[#9fe9e9]' : 'text-[#ffd166]'
                  }`}
                >
                  {scheduleResult.p10CoveragePct}%
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                <div className="font-mono text-[10px] text-[#b9bdcf]">TARIFF SAVING</div>
                <div className="mt-1 font-serif text-xl font-semibold text-[#ffd166]">
                  {scheduleResult.costSavedEgp.toLocaleString('en-US')} EGP
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                <div className="font-mono text-[10px] text-[#b9bdcf]">DIESEL AVOIDED</div>
                <div className="mt-1 font-serif text-xl font-semibold text-[#9fe9e9]">
                  {scheduleResult.dieselAvoidedLiters} L
                </div>
              </div>
            </div>

            <div
              className={`mt-4 rounded-2xl border p-4 text-xs ${
                scheduleResult.riskLevel === 'low'
                  ? 'border-[#3fc1c1]/35 bg-[#3fc1c1]/10'
                  : 'border-[#f5a524]/35 bg-[#f5a524]/10'
              }`}
            >
              <div
                className={`font-mono font-semibold uppercase ${
                  scheduleResult.riskLevel === 'low' ? 'text-[#9fe9e9]' : 'text-[#ffd166]'
                }`}
              >
                {scheduleResult.riskLevel === 'low'
                  ? '✓ VERIFIED P10 ROBUST WINDOW (LOW RISK)'
                  : `⚠ P10 CONSERVATIVE RISK LEVEL: ${scheduleResult.riskLevel.toUpperCase()}`}
              </div>
              <p className="mt-1 text-[#f4f5fa]">{scheduleResult.rationale}</p>
            </div>

            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#b9bdcf]">
                Site Flexible Load Queue (Validated by Deterministic Engine)
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.16] text-[#b9bdcf]">
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
                      <tr key={w.loadId} className="border-b border-white/[0.1] text-[#f4f5fa]">
                        <td className="py-2.5 font-semibold text-white">{w.loadName}</td>
                        <td className="py-2.5">
                          {w.powerKw} kW × {w.durationH}h
                        </td>
                        <td className="py-2.5 text-[#ffd166]">{w.windowLabel}</td>
                        <td className="py-2.5 text-[#9fe9e9]">{w.solarCoveragePct}%</td>
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
        <div className="glass mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="eyebrow">Hourly Daytime Physics &amp; Quantile Table</div>
              <h3 className="mt-1.5 font-serif text-xl font-semibold text-white">
                {region.nameEn} ({site.cellId}) — Hourly Irradiance, Faiman Cell Temp &amp; AC Output
              </h3>
            </div>
            <span className="tag-pill live">
              Optimal {durationH}h dispatch: {scheduleResult.windowLabel}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/[0.16] text-[#b9bdcf]">
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
                      className={`border-b border-white/[0.1] ${
                        inBestWindow ? 'bg-[#f5a524]/15' : ''
                      }`}
                    >
                      <td className="py-2.5 font-semibold text-white">
                        {String(pt.hourLocal).padStart(2, '0')}:00
                      </td>
                      <td className="py-2.5 text-[#b9bdcf]">{pt.solarElevationDeg}°</td>
                      <td className="py-2.5">{pt.ghiWm2}</td>
                      <td className="py-2.5">{pt.kc}</td>
                      <td className="py-2.5">{pt.tAmbC}°C</td>
                      <td
                        className={`py-2.5 ${
                          pt.tCellC >= 50 ? 'text-[#ffd166]' : 'text-[#f4f5fa]'
                        }`}
                      >
                        {pt.tCellC}°C
                      </td>
                      <td className="py-2.5 text-[#b9bdcf]">{pt.p10Kw} kW</td>
                      <td className="py-2.5 font-semibold text-[#ffd166]">{pt.pKw} kW</td>
                      <td className="py-2.5 text-[#b9bdcf]">{pt.p90Kw} kW</td>
                      <td className="py-2.5 text-right">
                        {inBestWindow ? (
                          <span className="tag-pill live">
                            DISPATCH ACTIVE ({loadPowerKw} kW)
                          </span>
                        ) : (
                          <span className="text-[#b9bdcf]/60">Standby</span>
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
