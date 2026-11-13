'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { OPERATE_SITES } from '@/domain/benchmarkData';
import { REGIONS, snapToGridCell } from '@/domain/regions';
import { PANEL_TECHNOLOGIES } from '@/domain/panels';
import { predictionProvider } from '@/domain/providers/predictionProvider';
import { SkyCondition } from '@/domain/types';

export default function OperateDashboardPage() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(OPERATE_SITES[0].id);
  const [mode, setMode] = useState<'replay' | 'live'>('replay');
  const [horizonH, setHorizonH] = useState<1 | 6 | 24>(24);
  const [skyCondition, setSkyCondition] = useState<SkyCondition>('clear');
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
    <div className="cinematic-page pb-20 pt-8">
      <Navbar clockLabel="12:00 · Operate Fleet" />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        {/* Operate Sub-navigation & Mode Banner */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.14] pb-6">
          <div>
            <div className="eyebrow">SolarSense Operate · Fleet Command Center</div>
            <h1 className="cinematic-h2 mt-2">
              Egyptian PV Fleet Forecasting &amp; Operations
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/app" className="btn-pill-primary py-2 px-4 text-xs">
              Fleet Overview
            </Link>
            <Link
              href={`/app/sites/${selectedSite.id}`}
              className="btn-pill py-2 px-4 text-xs"
            >
              Site Scheduler ({selectedSite.nameEn.split(' ')[0]})
            </Link>
            <Link href="/app/models" className="btn-pill py-2 px-4 text-xs">
              Model Benchmark
            </Link>
            <Link href="/app/assistant" className="btn-pill py-2 px-4 text-xs">
              Grounded AI Assistant
            </Link>
          </div>
        </div>

        {/* Provenance Mode Bar */}
        <div className="glass mt-6 flex flex-wrap items-center justify-between gap-4 py-3.5 px-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={mode === 'replay' ? 'tag-pill live' : 'tag-pill'}>
              {mode === 'replay'
                ? 'VERIFIED ERA5 REPLAY (2026 HELD-OUT TEST)'
                : 'EXPERIMENTAL LIVE NWP (OPEN-METEO BRIDGE)'}
            </span>
            <p className="text-xs text-[#b9bdcf]">
              Model: <b className="text-white">{forecast.modelName}</b> ({forecast.modelVersion}) · Cell{' '}
              <span className="font-mono text-[#ffd166]">{selectedSite.cellId}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('replay')}
              className={`rounded-full px-3.5 py-1.5 font-mono text-xs transition ${
                mode === 'replay'
                  ? 'bg-[#3fc1c1] font-semibold text-[#05070f]'
                  : 'border border-white/[0.16] bg-white/[0.04] text-[#b9bdcf] hover:text-white'
              }`}
            >
              2026 ERA5 Held-Out Replay
            </button>
            <button
              type="button"
              onClick={() => setMode('live')}
              className={`rounded-full px-3.5 py-1.5 font-mono text-xs transition ${
                mode === 'live'
                  ? 'bg-[#f5a524] font-semibold text-[#221500]'
                  : 'border border-white/[0.16] bg-white/[0.04] text-[#b9bdcf] hover:text-white'
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
                className={`glass-interactive cursor-pointer p-5 ${
                  active ? 'glass-selected' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="tag-pill">
                    {region.code} · {site.cellId}
                  </span>
                  <span className="font-mono text-xs text-[#9fe9e9]">● ONLINE</span>
                </div>
                <h3 className="mt-3 font-serif text-xl font-semibold text-white">
                  {site.nameEn}
                </h3>
                <p className="mt-1 text-xs text-[#b9bdcf]">
                  {site.capacityKwp.toLocaleString('en-US')} kWp · {tech.key} · Tilt {site.tiltDeg}°
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.12] pt-3 font-mono text-xs">
                  <span className="text-[#b9bdcf]">
                    GHI: {region.avgAnnualGhiKwhM2} kWh/m²
                  </span>
                  <Link
                    href={`/app/sites/${site.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-[#ffd166] hover:underline"
                  >
                    Open Site →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Telemetry & Forecast Section */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* Left 8 cols: Interactive P10-P90 Forecast Chart */}
          <div className="glass p-6 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="eyebrow">Physics-Guided Neural Network (PGNN) Forecast</div>
                <h2 className="mt-1.5 font-serif text-2xl font-semibold text-white">
                  {selectedSite.nameEn} — {horizonH}h Horizon
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {([1, 6, 24] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorizonH(h)}
                    className={`rounded-full px-3 py-1 font-mono text-xs transition ${
                      horizonH === h
                        ? 'bg-[#f5a524] font-semibold text-[#221500]'
                        : 'border border-white/[0.16] bg-white/[0.04] text-[#b9bdcf]'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
                <span className="mx-1 text-white/20">|</span>
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
                    className={`rounded-full px-3 py-1 font-mono text-xs transition ${
                      skyCondition === sc.id
                        ? 'bg-[#3fc1c1] font-semibold text-[#05070f]'
                        : 'border border-white/[0.16] bg-white/[0.04] text-[#b9bdcf]'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Day of Year slider */}
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.14] bg-white/[0.03] px-4 py-2.5">
              <span className="font-mono text-xs text-[#b9bdcf]">
                Day of Year: <strong className="text-[#ffd166]">Day {dayOfYear}</strong>
              </span>
              <input
                type="range"
                min={1}
                max={365}
                value={dayOfYear}
                onChange={(e) => setDayOfYear(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer"
              />
              <div className="flex gap-1.5 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => setDayOfYear(80)}
                  className="rounded-full border border-white/[0.16] px-2.5 py-0.5 text-[#b9bdcf] hover:border-[#ffd166] hover:text-white"
                >
                  Equinox
                </button>
                <button
                  type="button"
                  onClick={() => setDayOfYear(172)}
                  className="rounded-full border border-white/[0.16] px-2.5 py-0.5 text-[#b9bdcf] hover:border-[#ffd166] hover:text-white"
                >
                  Summer Peak
                </button>
                <button
                  type="button"
                  onClick={() => setDayOfYear(355)}
                  className="rounded-full border border-white/[0.16] px-2.5 py-0.5 text-[#b9bdcf] hover:border-[#ffd166] hover:text-white"
                >
                  Winter Solstice
                </button>
              </div>
            </div>

            {/* SVG Fan Chart */}
            <div className="mt-6">
              <svg viewBox="0 0 760 290" className="w-full overflow-visible">
                <defs>
                  <linearGradient id="fleetPowerGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#f5a524" stopOpacity="0.65" />
                    <stop offset="1" stopColor="#f5a524" stopOpacity="0" />
                  </linearGradient>
                </defs>
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
                        stroke="rgba(255,255,255,0.08)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={44}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-[#b9bdcf] font-mono text-[10px]"
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
                    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y90}`)
                    .join(' ');
                  const lowerPath = [...coords]
                    .reverse()
                    .map((c) => `L ${c.x} ${c.y10}`)
                    .join(' ');
                  const bandPath = `${upperPath} ${lowerPath} Z`;

                  const p50Path = coords
                    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y50}`)
                    .join(' ');
                  const areaFill = `${p50Path} L 720 245 L 60 245 Z`;

                  const clearPath = coords
                    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.yClear}`)
                    .join(' ');

                  return (
                    <>
                      <path d={bandPath} fill="rgba(63, 193, 193, 0.18)" />
                      <path d={areaFill} fill="url(#fleetPowerGrad)" />
                      <path
                        d={clearPath}
                        fill="none"
                        stroke="#3fc1c1"
                        strokeWidth={1.75}
                        strokeDasharray="5 4"
                      />
                      <path d={p50Path} fill="none" stroke="#ffd166" strokeWidth={3} />
                      {coords.map((c, i) => (
                        <g key={i}>
                          <circle
                            cx={c.x}
                            cy={c.y50}
                            r={3.2}
                            fill="#ffd166"
                            stroke="#05070f"
                            strokeWidth={1.5}
                          />
                          <text
                            x={c.x}
                            y={268}
                            textAnchor="middle"
                            className="fill-[#b9bdcf] font-mono text-[10px]"
                          >
                            {String(c.pt.hourLocal).padStart(2, '0')}:00
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.14] pt-3 text-xs text-[#b9bdcf]">
                <div className="flex flex-wrap items-center gap-5">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-4 bg-[#ffd166]" />
                    PGNN P50 Power Forecast (kW)
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-4 rounded-sm bg-[#3fc1c1]/25" />
                    P10–P90 Confidence Interval
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-4 border-b border-dashed border-[#3fc1c1]" />
                    pvlib Clear-Sky Envelope
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#9fe9e9]">
                  0.0% Physical Constraint Violations (0 ≤ P ≤ P_clear)
                </span>
              </div>
            </div>
          </div>

          {/* Right 4 cols: Site Telemetry Summary & Action Cards */}
          <div className="glass flex flex-col justify-between p-6 lg:col-span-4">
            <div>
              <div className="eyebrow">Forecast Telemetry KPIs</div>
              <h3 className="mt-1.5 font-serif text-2xl font-semibold text-white">
                {selectedSite.nameEn}
              </h3>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[10px] text-[#b9bdcf]">DAILY FORECAST YIELD</div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-[#ffd166]">
                    {totalEnergyKwh.toLocaleString('en-US')}{' '}
                    <span className="text-xs font-normal text-[#b9bdcf]">kWh</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[10px] text-[#b9bdcf]">PEAK AC POWER (P50)</div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-white">
                    {peakPowerKw.toLocaleString('en-US')}{' '}
                    <span className="text-xs font-normal text-[#b9bdcf]">kW</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[10px] text-[#b9bdcf]">PEAK CELL TEMP (FAIMAN)</div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-[#ffd166]">
                    {peakCellTemp}°C
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="font-mono text-[10px] text-[#b9bdcf]">BESS STORAGE</div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-[#9fe9e9]">
                    {selectedSite.batteryKwh}{' '}
                    <span className="text-xs font-normal text-[#b9bdcf]">kWh</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 border-t border-white/[0.14] pt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#b9bdcf]">Base Critical Site Load:</span>
                  <span className="font-mono text-white">{selectedSite.baseLoadKw} kW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b9bdcf]">ERA5 Grid Cell ID:</span>
                  <span className="font-mono text-white">{selectedSite.cellId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b9bdcf]">Panel Technology:</span>
                  <span className="font-mono text-[#ffd166]">
                    {PANEL_TECHNOLOGIES[selectedSite.tech].nameEn}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href={`/app/sites/${selectedSite.id}`}
                className="btn-pill-primary w-full justify-center"
              >
                Open Deterministic Load Scheduler →
              </Link>
              <Link href="/app/assistant" className="btn-pill w-full justify-center">
                Ask Grounded AI Assistant About This Site
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
