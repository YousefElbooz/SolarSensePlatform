'use client';

import React, { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { CountUp, fmt } from './charts';
import { Note, Panel, Seg } from './ui';
import type { PPData } from './types';

const STAGE_MS = 11000;

const STAGES = [
  { id: 'merge', name: 'Find and merge', short: 'Merge' },
  { id: 'time', name: 'Check the time axis', short: 'Time' },
  { id: 'units', name: 'Convert units', short: 'Units' },
  { id: 'local', name: 'Local time and daylight', short: 'Daylight' },
  { id: 'features', name: 'Derived features', short: 'Features' },
  { id: 'quality', name: 'Quality report and save', short: 'Quality' },
] as const;

function Why({ what, why, code }: { what: React.ReactNode; why: React.ReactNode; code: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3 text-[13.5px] leading-relaxed text-[#cfd6e6]">
        <div>
          <div className="pp-hud mb-1">What the script does</div>
          {what}
        </div>
        <div>
          <div className="pp-hud pp-hud-amber mb-1">Why it matters</div>
          {why}
        </div>
      </div>
      <div>
        <div className="pp-hud mb-1">Code</div>
        <pre className="pp-code">{code}</pre>
      </div>
    </div>
  );
}

function Stat({ label, value, decimals = 0, suffix = '', run }: { label: string; value: number; decimals?: number; suffix?: string; run: unknown }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="pp-num text-[20px] font-semibold leading-tight text-white">
        <CountUp value={value} decimals={decimals} run={run} />
        {suffix && <span className="ms-1 text-[12px] font-medium text-[#8e93a8]">{suffix}</span>}
      </div>
      <div className="pp-hud mt-1 !text-[9.5px] !text-[#8e93a8]">{label}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- stages */
function MergeStage({ d }: { d: PPData }) {
  const L = d.report.load;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label=".nc files found" value={L.files} run="merge" />
        <Stat label="Download folders" value={L.folders} run="merge" />
        <Stat label="On disk" value={L.size_mb} suffix="MB" run="merge" />
        <Stat label="Hourly steps merged" value={L.steps_merged} run="merge" />
      </div>
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_240px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {(['accum', 'instant'] as const).map((kind) => (
            <div key={kind} className="rounded-lg border border-white/10 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className={`pp-hud ${kind === 'accum' ? 'pp-hud-amber' : ''}`}>{kind === 'accum' ? 'Accumulated files' : 'Instant files'}</span>
                <span className="pp-num text-[11px] text-[#8e93a8]">{kind === 'accum' ? L.accum_files : L.instant_files} files</span>
              </div>
              <div className="flex flex-wrap gap-[3px]">
                {Array.from({ length: kind === 'accum' ? L.accum_files : L.instant_files }).map((_, i) => (
                  <i
                    key={i}
                    className="pp-pop block h-3 w-3 rounded-[3px]"
                    style={{
                      background: kind === 'accum' ? '#ffd60a' : '#30d5c8',
                      boxShadow: `0 0 6px ${kind === 'accum' ? '#ffd60a88' : '#30d5c888'}`,
                      animationDelay: `${i * 28 + (kind === 'instant' ? 300 : 0)}ms`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {L.raw_vars[kind].map((v) => (
                  <span key={v} className="pp-num rounded border border-white/12 bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] text-[#dfe7f5]">
                    {v}
                  </span>
                ))}
              </div>
              <Note>
                {kind === 'accum'
                  ? 'Totals collected over each hour: radiation and rain.'
                  : 'Snapshots taken at the top of each hour: temperature, wind, pressure, cloud.'}
              </Note>
            </div>
          ))}
        </div>
        <svg width="64" height="40" className="mx-auto hidden lg:block" aria-hidden="true">
          <line x1="2" y1="20" x2="52" y2="20" stroke="#30d5c8" strokeWidth="2" className="pp-flow" />
          <path d="M50 12 L62 20 L50 28" fill="none" stroke="#30d5c8" strokeWidth="2" />
        </svg>
        <div className="rounded-lg border border-[#30d5c8]/40 bg-[#30d5c8]/[0.07] p-3 text-center shadow-[0_0_30px_-8px_rgba(48,213,200,0.5)]">
          <div className="pp-hud">One data cube</div>
          <div className="pp-num mt-2 text-[15px] font-semibold text-white">
            {fmt(L.steps_merged, 0)} × {L.n_lat} × {L.n_lon}
          </div>
          <div className="pp-num text-[11px] text-[#8e93a8]">time × latitude × longitude</div>
          <div className="mt-2 text-[12px] text-[#cfd6e6]">
            {L.cells} cells of {L.resolution_deg}° over {L.lat_range[0]}–{L.lat_range[1]}°N, {L.lon_range[0]}–{L.lon_range[1]}°E
          </div>
        </div>
      </div>
      <Why
        what={
          <p>
            Scans the data folder for every NetCDF file, opens each one, renames the new CDS time axis (<code>valid_time</code>) to <code>time</code>, and drops the bookkeeping coordinates. Accumulated and
            instant files are stacked along time separately, then joined on the timestamps they share. Duplicated timestamps found: <b className="text-white">{L.duplicates}</b>.
          </p>
        }
        why={
          <p>
            The Climate Data Store delivers each download as two files with different variables. A model needs all of them in one table, on one clock. Joining on shared timestamps guarantees that every
            row has radiation and weather from the same hour, with no silent misalignment.
          </p>
        }
        code={`files  = DATA_DIR.rglob("*.nc")
ds     = ds.rename(valid_time="time")
accum  = xr.concat(accum_parts,   dim="time")
inst   = xr.concat(instant_parts, dim="time")
ds     = xr.merge([accum, inst], join="inner")
ds     = ds.sortby(["time", "latitude"])`}
      />
    </div>
  );
}

function TimeStage({ d }: { d: PPData }) {
  const T = d.report.time;
  const top = Math.max(...T.step_sizes.map((s) => s.count));
  const meaning = (h: number) =>
    h === 1 ? 'consecutive hours inside one day' : h < 24 ? `the overnight jump: night hours were never downloaded` : 'a whole day is missing';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Hourly steps" value={T.steps} run="time" />
        <Stat label="Calendar days" value={T.days} run="time" />
        <Stat label="Hours per day" value={T.utc_hours.length} run="time" />
        <Stat label="Missing days" value={T.gaps.length} run="time" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/25 p-3">
          <div className="pp-hud mb-2">One day of the download, by UTC hour</div>
          <div className="grid grid-cols-12 gap-1 sm:grid-cols-[repeat(24,minmax(0,1fr))]">
            {Array.from({ length: 24 }).map((_, h) => {
              const on = T.utc_hours.includes(h);
              return (
                <div
                  key={h}
                  className="pp-pop pp-num flex h-8 items-center justify-center rounded text-[10px]"
                  style={{
                    animationDelay: `${h * 35}ms`,
                    background: on ? 'rgba(255,214,10,0.85)' : 'rgba(255,255,255,0.05)',
                    color: on ? '#140d00' : '#6c7288',
                    boxShadow: on ? '0 0 10px rgba(255,214,10,0.45)' : 'none',
                  }}
                >
                  {String(h).padStart(2, '0')}
                </div>
              );
            })}
          </div>
          <Note>
            Data runs from <b className="text-white">{T.start.slice(0, 16)}</b> to <b className="text-white">{T.end.slice(0, 16)}</b> UTC. Only the {T.utc_hours.length} lit hours of each day were
            requested, because a solar model has nothing to learn at night.
          </Note>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-3">
          <div className="pp-hud mb-2">Gap between one step and the next</div>
          <div className="space-y-2.5">
            {T.step_sizes.map((s, i) => (
              <div key={s.step_hours}>
                <div className="flex items-baseline justify-between text-[12.5px] text-[#cfd6e6]">
                  <span>
                    <b className="pp-num text-white">{s.step_hours} h</b> · {meaning(s.step_hours)}
                  </span>
                  <span className="pp-num text-[#8e93a8]">{fmt(s.count, 0)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="pp-progress h-full rounded-full"
                    style={{
                      width: `${Math.max(1.5, (100 * s.count) / top)}%`,
                      background: s.step_hours >= 24 ? '#ff5c7a' : '#30d5c8',
                      animationDuration: '0.9s',
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {T.gaps.length > 0 && (
            <Note>
              Days with no data: {T.gaps.map((g) => new Date(new Date(g.after.replace(' ', 'T') + 'Z').getTime() + 86400000).toISOString().slice(0, 10)).join(', ')}. Each is the 31st of a
              month in 2026, so those downloads stopped at day 30. The last day in the archive is also incomplete.
            </Note>
          )}
        </div>
      </div>
      <Why
        what={<p>Prints the first and last timestamp, the number of steps, and how often each step size occurs. It only reports; nothing is changed here.</p>}
        why={
          <p>
            Lag features and forecast horizons assume a regular clock. This check proves the clock is regular (1 hour inside the day, one fixed overnight jump) and exposes real holes before they turn
            into wrong &quot;previous hour&quot; values. The missing days it found are a concrete item to re-download.
          </p>
        }
        code={`t     = ds.indexes["time"]
steps = pd.Series(t).diff().value_counts()
print(t[0], t[-1], len(t))
print(steps.head(4))`}
      />
    </div>
  );
}

function UnitsStage({ d }: { d: PPData }) {
  const U = d.report.units;
  const s = d.samples.find((x) => x.site === 'Cairo' && x.time.startsWith('2025-07-15T10')) ?? d.samples[0];
  const rows = [
    { v: 'ssrd', rawUnit: 'J/m² per hour', op: '÷ 3600', unit: 'W/m²', color: '#ffd60a' },
    { v: 'fdir', rawUnit: 'J/m² per hour', op: '÷ 3600', unit: 'W/m²', color: '#ff8a3d' },
    { v: 't2m', rawUnit: 'K', op: '− 273.15', unit: '°C', color: '#ff5c7a' },
    { v: 'sp', rawUnit: 'Pa', op: '÷ 100', unit: 'hPa', color: '#6fd3ff' },
    { v: 'u10', rawUnit: 'm/s', op: 'unchanged', unit: 'm/s', color: '#5ab0ff' },
    { v: 'v10', rawUnit: 'm/s', op: 'unchanged', unit: 'm/s', color: '#c58cff' },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-black/25 p-3">
        <div className="pp-hud mb-2">
          One real cell before and after · {s.site} cell ({s.lat}°N, {s.lon}°E) · {s.time.replace('T', ' ')} UTC
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r, i) => (
            <div key={r.v} className="pp-rise flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2" style={{ animationDelay: `${i * 110}ms` }}>
              <span className="pp-num w-9 shrink-0 text-[12px] font-semibold" style={{ color: r.color }}>
                {r.v}
              </span>
              <span className="min-w-0 flex-1">
                <span className="pp-num block truncate text-[12.5px] text-[#8e93a8] line-through decoration-white/25">
                  {fmt(s.raw[r.v], r.rawUnit.startsWith('J') ? 0 : 2)} {r.rawUnit}
                </span>
                <span className="pp-num block text-[10px] text-[#30d5c8]">{r.op}</span>
              </span>
              <span className="pp-num shrink-0 text-end text-[16px] font-semibold text-white">
                <CountUp value={(s.clean?.[r.v] as number) ?? 0} decimals={2} run="units" />
                <span className="ms-1 text-[11px] font-medium text-[#8e93a8]">{r.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Values checked per variable" value={U.total_values} run="units" />
        <Stat label="Negative ssrd values set to 0" value={U.negative_clipped.ssrd ?? 0} run="units" />
        <Stat label="Cases of fdir above ssrd" value={U.fdir_gt_ssrd} run="units" />
      </div>
      <Why
        what={
          <p>
            Radiation arrives as energy collected over the hour (joules per m²). Dividing by 3600 seconds turns it into average power (watts per m²). Temperature moves from kelvin to Celsius and
            pressure from pascal to hectopascal. Small negative radiation values, a known rounding artefact of the file compression, are set to zero.
          </p>
        }
        why={
          <p>
            W/m² is the unit PV engineering uses: panels are rated at 1000 W/m², so the cleaned number can be read directly against a datasheet and against the model&apos;s power output. The two checks
            are physical sanity tests. Direct light can never exceed total light, and it never does here.
          </p>
        }
        code={`ds[v]     = (ds[v] / 3600).clip(min=0)   # J/m² -> W/m²
ds["t2m"] = ds["t2m"] - 273.15           # K  -> °C
ds["sp"]  = ds["sp"] / 100               # Pa -> hPa
bad = (ds["fdir"] > ds["ssrd"] + 1).sum()`}
      />
    </div>
  );
}

function LocalStage({ d }: { d: PPData }) {
  const L = d.report.local;
  const top = Math.max(...L.per_local_hour.map((h) => h.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Steps before" value={L.steps_before} run="local" />
        <Stat label="Steps kept" value={L.steps_after} run="local" />
        <Stat label="Steps dropped" value={L.steps_before - L.steps_after} run="local" />
        <Stat label="Kept" value={(100 * L.steps_after) / L.steps_before} decimals={1} suffix="%" run="local" />
      </div>
      <div className="rounded-lg border border-white/10 bg-black/25 p-3">
        <div className="pp-hud mb-3">Steps available at each local hour ({L.tz})</div>
        <div className="flex h-[150px] items-end gap-1.5">
          {L.per_local_hour.map((h, i) => (
            <div key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div
                className="pp-bar w-full rounded-t"
                title={`${h.count} steps`}
                style={{
                  height: `${(100 * h.count) / top}%`,
                  background: h.kept ? 'linear-gradient(180deg,#ffd60a,#f59e0b)' : 'repeating-linear-gradient(45deg,#3a2030,#3a2030 4px,#281622 4px,#281622 8px)',
                  boxShadow: h.kept ? '0 0 12px rgba(255,214,10,0.35)' : 'none',
                  animationDelay: `${i * 45}ms`,
                }}
              />
              <span className={`pp-num text-[10px] ${h.kept ? 'text-white' : 'text-[#ff5c7a]'}`}>{String(h.hour).padStart(2, '0')}</span>
            </div>
          ))}
        </div>
        <Note>
          Amber hours are kept ({String(L.window[0]).padStart(2, '0')}:00 to {String(L.window[1]).padStart(2, '0')}:00). Hatched hours are dropped. Hours 04 and 20 are short because of daylight saving:
          the same UTC window lands on 04–19 in winter and 05–20 in summer.
        </Note>
      </div>
      <Why
        what={
          <p>
            Converts every UTC timestamp to the Egyptian clock, daylight saving included, stores it as <code>local_hour</code>, and keeps only hours {L.window[0]} to {L.window[1]}.
          </p>
        }
        why={
          <p>
            The sun follows local time, not UTC. After this step every day has the same {L.window[1] - L.window[0] + 1} hours in every season, which removes the pre-dawn rows where radiation is zero and
            would teach the model nothing, and makes the daily-cycle plot comparable across the year.
          </p>
        }
        code={`idx  = time.tz_localize("UTC").tz_convert("Africa/Cairo")
ds   = ds.assign_coords(local_hour=("time", idx.hour))
keep = (idx.hour >= 6) & (idx.hour <= 19)
ds   = ds.isel(time=keep)`}
      />
    </div>
  );
}

function FeaturesStage({ d }: { d: PPData }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 24), 450);
    return () => clearInterval(id);
  }, []);
  const feats = [
    { name: 'wind_speed', formula: '√(u10² + v10²)', why: 'One number for how hard the wind blows. It sets how fast panels shed heat.' },
    { name: 'wind_dir_sin · wind_dir_cos', formula: 'sin, cos of atan2(−u10, −v10)', why: 'Direction the wind comes from, on a circle, so 359° and 1° stay neighbours.' },
    { name: 'diffuse', formula: 'max(ssrd − fdir, 0)', why: 'Light scattered by haze, dust and cloud. Its share tells a clear day from a hazy one.' },
    { name: 'clear_sky_index', formula: 'ssrd ÷ ssrdc  (when ssrdc > 20)', why: 'Share of the cloud-free sunlight that arrived. 1 is clear; lower means cloud.' },
    { name: 'hour_sin · hour_cos', formula: 'sin, cos of 2π · hour ÷ 24', why: 'Time of day on a circle, so 23:00 sits next to 00:00.' },
    { name: 'doy_sin · doy_cos', formula: 'sin, cos of 2π · (day − 1) ÷ 365.25', why: 'Season on a circle, so 31 December sits next to 1 January.' },
  ];
  const ang = (tick / 24) * 2 * Math.PI;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_230px]">
        <div className="grid gap-2 sm:grid-cols-2">
          {feats.map((f, i) => (
            <div key={f.name} className="pp-rise rounded-lg border border-white/10 bg-black/25 p-3" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="pp-num text-[12.5px] font-semibold text-[#7ef2e8]">{f.name}</div>
              <div className="pp-num mt-1 text-[12px] text-[#ffd60a]">{f.formula}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#cfd6e6]">{f.why}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-center">
          <div className="pp-hud mb-1">Hour on a circle</div>
          <svg viewBox="-70 -70 140 140" className="mx-auto w-[170px]" aria-hidden="true">
            <circle r="52" fill="none" stroke="rgba(48,213,200,0.35)" />
            <line x1="-60" x2="60" y1="0" y2="0" stroke="rgba(255,255,255,0.12)" />
            <line y1="-60" y2="60" x1="0" x2="0" stroke="rgba(255,255,255,0.12)" />
            {Array.from({ length: 24 }).map((_, h) => {
              const a = (h / 24) * 2 * Math.PI;
              return <circle key={h} cx={52 * Math.sin(a)} cy={-52 * Math.cos(a)} r={h === tick ? 5 : 1.8} fill={h === tick ? '#ffd60a' : '#30d5c8'} />;
            })}
            <line x1="0" y1="0" x2={52 * Math.sin(ang)} y2={-52 * Math.cos(ang)} stroke="#ffd60a" strokeWidth="1.5" />
            <text y="-58" textAnchor="middle" className="pp-axis">00</text>
            <text x="62" y="3" textAnchor="middle" className="pp-axis">06</text>
            <text y="66" textAnchor="middle" className="pp-axis">12</text>
            <text x="-62" y="3" textAnchor="middle" className="pp-axis">18</text>
          </svg>
          <div className="pp-num mt-1 text-[11.5px] text-[#dfe7f5]">
            {String(tick).padStart(2, '0')}:00 → sin {Math.sin(ang).toFixed(2)}, cos {Math.cos(ang).toFixed(2)}
          </div>
          <Note>As a plain number, 23 and 0 look 23 apart. On the circle they are one step apart.</Note>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Columns added" value={d.report.features.added.length} run="features" />
        <Stat label="Hourly steps" value={d.report.features.steps} run="features" />
        <Stat label="Rows in the final table" value={d.report.features.rows} run="features" />
      </div>
      <Why
        what={<p>Builds new columns from the cleaned ones. Nothing is downloaded; each is a formula on values already in the table.</p>}
        why={
          <p>
            A model learns faster from physically meaningful inputs than from raw components. These columns hand it the quantities a PV engineer would compute by hand: how windy, how cloudy, what time
            of day and what season, each in a form without artificial jumps.
          </p>
        }
        code={`ws = np.hypot(ds["u10"], ds["v10"])
wd = np.arctan2(-ds["u10"], -ds["v10"])
ds["diffuse"]         = (ds["ssrd"] - ds["fdir"]).clip(min=0)
ds["clear_sky_index"] = (ds["ssrd"] / ds["ssrdc"]).where(ds["ssrdc"] > 20)
ds["hour_sin"]        = np.sin(2 * np.pi * hour / 24)`}
      />
    </div>
  );
}

function QualityStage({ d }: { d: PPData }) {
  const [all, setAll] = useState<'core' | 'all'>('core');
  const rows = d.quality.filter((q) => all === 'all' || q.core);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-black/25 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="pp-hud">Quality report · after cleaning, daylight hours only</div>
          <Seg
            label="Variables shown"
            value={all}
            onChange={setAll}
            options={[
              { value: 'core', label: 'Model table' },
              { value: 'all', label: `All ${d.quality.length} variables` },
            ]}
          />
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="pp-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th className="text-end">Min</th>
                <th className="text-end">Mean</th>
                <th className="text-end">Max</th>
                <th>Missing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q, i) => (
                <tr key={q.variable} className="pp-rise" style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}>
                  <td className="pp-num font-semibold text-white">{q.variable}</td>
                  <td className="pp-num text-end">{fmt(q.min, 2)}</td>
                  <td className="pp-num text-end">{fmt(q.mean, 2)}</td>
                  <td className="pp-num text-end">{fmt(q.max, 2)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full" style={{ width: `${q.nan_pct}%`, background: q.nan_pct > 0 ? '#ff5c7a' : '#30d5c8' }} />
                      </div>
                      <span className={`pp-num text-[11.5px] ${q.nan_pct > 0 ? 'text-[#ff9db0]' : 'text-[#7ef2e8]'}`}>{q.nan_pct.toFixed(2)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          Only two variables have blanks, and both are expected. <b className="text-white">clear_sky_index</b> is left empty when the sun is too low for the ratio to be stable.{' '}
          <b className="text-white">cbh</b> (cloud base height) has no value when there is no cloud, which over Egypt is most of the time; the blank is itself information.
        </Note>
      </div>
      <Why
        what={
          <p>
            Computes the minimum, mean, maximum and share of missing values for every column, prints them as one table, and writes the cleaned cube to <code>preprocessed/clean.nc</code> with
            compression.
          </p>
        }
        why={
          <p>
            This table is the evidence that the data is fit to train on. Every range is physically plausible for Egypt (air temperature {fmt(d.quality.find((q) => q.variable === 't2m')?.min, 1)} to{' '}
            {fmt(d.quality.find((q) => q.variable === 't2m')?.max, 1)} °C, radiation never negative), and the model team gets one file instead of {d.report.load.files}.
          </p>
        }
        code={`for v, da in ds.data_vars.items():
    rows.append({"variable": v, "min": da.min(), "mean": da.mean(),
                 "max": da.max(), "NaN %": 100 * da.isnull().mean()})
ds.to_netcdf("preprocessed/clean.nc", encoding=zlib_level_4)`}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- tab */
export function PipelineTab({ d }: { d: PPData }) {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setStage((s) => (s + 1) % STAGES.length), STAGE_MS);
    return () => clearTimeout(id);
  }, [playing, stage]);

  const body = [MergeStage, TimeStage, UnitsStage, LocalStage, FeaturesStage, QualityStage][stage];
  const Body = body;

  return (
    <div className="space-y-4">
      <Panel
        hud="Pipeline"
        title="Six steps from raw downloads to a model-ready table"
        right={
          <button type="button" onClick={() => setPlaying((p) => !p)} className="pp-tab" aria-label={playing ? 'Pause the walkthrough' : 'Play the walkthrough'}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? 'Pause' : 'Play'}
          </button>
        }
      >
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((s, i) => {
            const state = i === stage ? 'active' : i < stage ? 'done' : 'todo';
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setStage(i);
                    setPlaying(false);
                  }}
                  aria-current={state === 'active' ? 'step' : undefined}
                  className={`relative w-full cursor-pointer overflow-hidden rounded-lg border px-3 py-2.5 text-start transition ${
                    state === 'active'
                      ? 'border-[#30d5c8] bg-[#30d5c8]/[0.12] shadow-[0_0_22px_-6px_rgba(48,213,200,0.7)]'
                      : state === 'done'
                        ? 'border-[#30d5c8]/30 bg-white/[0.03]'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                        state === 'todo' ? 'bg-white/10 text-[#8e93a8]' : 'bg-[#30d5c8] text-[#04121f]'
                      } ${state === 'active' ? 'pp-pulse' : ''}`}
                    >
                      {i + 1}
                    </span>
                    <span className={`text-[12.5px] font-semibold leading-tight ${state === 'todo' ? 'text-[#b4b8cb]' : 'text-white'}`}>{s.name}</span>
                  </div>
                  {state === 'active' && playing && (
                    <span key={stage} className="pp-progress absolute bottom-0 left-0 h-[2px] w-full bg-[#30d5c8]" style={{ animationDuration: `${STAGE_MS}ms` }} />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel hud={`Step ${stage + 1} of ${STAGES.length}`} title={STAGES[stage].name}>
        <div key={stage}>
          <Body d={d} />
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- dataset tab */
const COLUMNS: { key: string; group: 'Index' | 'Measured' | 'Derived'; raw: string; clean: string; what: string; why: string }[] = [
  { key: 'time', group: 'Index', raw: 'UTC', clean: 'UTC', what: 'The hour the row belongs to. Radiation is the average over the hour ending at this time.', why: 'Orders the rows. Every lag, forecast horizon and train/test split is built on it.' },
  { key: 'latitude · longitude', group: 'Index', raw: 'degrees', clean: 'degrees', what: 'Centre of the ERA5 grid cell, 0.25° apart (about 28 km).', why: 'Says where the row is, so one model can serve every cell and the platform can map a clicked site to its nearest cell.' },
  { key: 'local_hour', group: 'Index', raw: 'none', clean: '6 to 19', what: 'Hour on the Egyptian clock, daylight saving included.', why: 'The sun and electricity demand follow local time. The daylight filter uses it.' },
  { key: 'ssrd', group: 'Measured', raw: 'J/m² per hour', clean: 'W/m²', what: 'All sunlight reaching a flat surface: direct plus scattered.', why: 'The main driver of PV power. Output is close to proportional to it.' },
  { key: 'fdir', group: 'Measured', raw: 'J/m² per hour', clean: 'W/m²', what: 'The part of ssrd that comes straight from the sun.', why: 'Direct light is what a tilted or tracking panel gains most from, and what a shadow blocks.' },
  { key: 'ssrdc', group: 'Measured', raw: 'J/m² per hour', clean: 'W/m²', what: 'What ssrd would be under a cloud-free sky.', why: 'The reference that separates "the sun is low" from "a cloud is in the way".' },
  { key: 't2m', group: 'Measured', raw: 'K', clean: '°C', what: 'Air temperature 2 m above the ground.', why: 'Hot cells lose power: roughly 0.3 to 0.45 % per °C, depending on the panel technology.' },
  { key: 'u10 · v10', group: 'Measured', raw: 'm/s', clean: 'm/s', what: 'Wind 10 m above ground, split into its eastward (u) and northward (v) parts.', why: 'Wind cools panels. Two components keep the direction, which a single speed would lose.' },
  { key: 'sp', group: 'Measured', raw: 'Pa', clean: 'hPa', what: 'Air pressure at ground level.', why: 'Lower pressure means higher ground and thinner air. It stands in for altitude, which this ERA5 product does not include.' },
  { key: 'diffuse', group: 'Derived', raw: 'none', clean: 'W/m²', what: 'ssrd minus fdir: light scattered by sky, haze, dust and cloud.', why: 'A high diffuse share marks haze or cloud, and panel technologies respond differently to diffuse light.' },
  { key: 'wind_speed', group: 'Derived', raw: 'none', clean: 'm/s', what: 'Length of the (u10, v10) wind vector.', why: 'The single number that drives panel cooling.' },
  { key: 'wind_dir_sin · wind_dir_cos', group: 'Derived', raw: 'none', clean: '−1 to 1', what: 'Direction the wind comes from, as a point on a circle.', why: 'Avoids the false jump between 359° and 1°.' },
  { key: 'clear_sky_index', group: 'Derived', raw: 'none', clean: '0 to about 1', what: 'ssrd divided by ssrdc. 1 means a fully clear sky.', why: 'A cloudiness signal that does not depend on hour or season.' },
  { key: 'hour_sin · hour_cos', group: 'Derived', raw: 'none', clean: '−1 to 1', what: 'Time of day as a point on a circle.', why: 'Keeps 23:00 next to 00:00 so the daily cycle has no break.' },
  { key: 'doy_sin · doy_cos', group: 'Derived', raw: 'none', clean: '−1 to 1', what: 'Day of year as a point on a circle.', why: 'Keeps December next to January so the seasonal cycle has no break.' },
];

const OTHER_VARS: [string, string][] = [
  ['tp', 'total precipitation'],
  ['cdir', 'clear-sky direct radiation'],
  ['tisr', 'sunlight at the top of the atmosphere'],
  ['d2m', 'dewpoint temperature (humidity)'],
  ['skt', 'ground skin temperature'],
  ['cbh', 'cloud base height'],
  ['tcc', 'total cloud cover'],
  ['tciw', 'cloud ice water'],
  ['tclw', 'cloud liquid water'],
  ['blh', 'boundary layer height'],
  ['fal', 'surface albedo'],
  ['tcwv', 'total column water vapour'],
];

const GROUP_COLOR = { Index: '#8e93a8', Measured: '#ffd60a', Derived: '#30d5c8' } as const;

export function DatasetTab({ d }: { d: PPData }) {
  const [mode, setMode] = useState<'clean' | 'raw'>('clean');
  const F = d.report.features;
  const L = d.report.load;
  const cols = ['ssrd', 'fdir', 'diffuse', 't2m', 'u10', 'v10', 'wind_speed', 'sp', 'clear_sky_index'];
  const rows = d.samples.filter((s) => s.clean);

  return (
    <div className="space-y-4">
      <Panel hud="Shape" title="What one row is">
        <div className="grid items-center gap-5 lg:grid-cols-[auto_1fr]">
          <svg viewBox="0 0 250 190" className="mx-auto w-[250px]" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <rect
                key={k}
                x={20 + k * 12}
                y={70 - k * 10}
                width={130}
                height={100}
                fill={k === 5 ? 'rgba(255,214,10,0.14)' : 'rgba(48,213,200,0.05)'}
                stroke={k === 5 ? '#ffd60a' : 'rgba(48,213,200,0.55)'}
                className="pp-rise"
                style={{ animationDelay: `${k * 110}ms` }}
              />
            ))}
            {[1, 2, 3, 4].map((g) => (
              <g key={g} stroke="rgba(255,214,10,0.3)">
                <line x1={80 + g * 26} x2={80 + g * 26} y1={20} y2={120} />
                <line x1={80} x2={210} y1={20 + g * 20} y2={20 + g * 20} />
              </g>
            ))}
            <rect x={132} y={60} width={26} height={20} fill="#ffd60a" className="pp-pulse" />
            <text x={85} y={186} textAnchor="middle" className="pp-axis">longitude × {L.n_lon}</text>
            <text x={12} y={120} textAnchor="middle" className="pp-axis" transform="rotate(-90 12 120)">latitude × {L.n_lat}</text>
            <text x={205} y={150} textAnchor="middle" className="pp-axis">time × {fmt(F.steps, 0)}</text>
          </svg>
          <div className="space-y-3">
            <p className="text-[14px] leading-relaxed text-[#dfe7f5]">
              The data is a cube: a stack of maps, one per hour. Flattened into a table, <b className="text-white">each row is one hour at one grid cell</b> (the lit square), and each column is one
              measurement taken there and then.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div className="pp-num text-[18px] font-semibold text-white"><CountUp value={F.steps} /></div>
                <div className="pp-hud mt-1 !text-[9.5px] !text-[#8e93a8]">daylight hours</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div className="pp-num text-[18px] font-semibold text-white">× <CountUp value={L.cells} /></div>
                <div className="pp-hud mt-1 !text-[9.5px] !text-[#8e93a8]">grid cells</div>
              </div>
              <div className="rounded-lg border border-[#ffd60a]/35 bg-[#ffd60a]/[0.07] px-3 py-2.5">
                <div className="pp-num text-[18px] font-semibold text-[#ffd60a]">= <CountUp value={F.rows} /></div>
                <div className="pp-hud pp-hud-amber mt-1 !text-[9.5px]">rows</div>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-[#b4b8cb]">
              Rows matter because the model learns from examples, and each row is one example: this place, this hour, this weather. More rows across more seasons and more locations means the model has
              seen winter haze on the coast and summer heat in Aswan before it is asked to predict them.
            </p>
          </div>
        </div>
      </Panel>

      <Panel hud="Columns" title="What each column is and why the model needs it">
        <div className="overflow-x-auto">
          <table className="pp-table min-w-[820px]">
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Raw unit → clean unit</th>
                <th>What it is</th>
                <th>Why it matters for solar prediction</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c, i) => (
                <tr key={c.key} className="pp-rise" style={{ animationDelay: `${i * 40}ms` }}>
                  <td className="pp-num font-semibold text-white">{c.key}</td>
                  <td>
                    <span className="pp-num rounded border px-1.5 py-0.5 text-[10.5px]" style={{ color: GROUP_COLOR[c.group], borderColor: `${GROUP_COLOR[c.group]}55` }}>
                      {c.group}
                    </span>
                  </td>
                  <td className="pp-num text-[11.5px]">
                    {c.raw === c.clean ? c.clean : (
                      <>
                        <span className="text-[#8e93a8]">{c.raw}</span> → <span className="text-white">{c.clean}</span>
                      </>
                    )}
                  </td>
                  <td>{c.what}</td>
                  <td>{c.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          The archive also carries {OTHER_VARS.length} more variables that pass through the same merge, unit conversion and quality report:{' '}
          {OTHER_VARS.map(([k, v], i) => (
            <span key={k}>
              <b className="pp-num text-white">{k}</b> ({v}){i < OTHER_VARS.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </Note>
      </Panel>

      <Panel
        hud="Real rows"
        title={`${rows.length} rows taken from the table`}
        right={
          <Seg
            label="Values shown"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'raw', label: 'Raw download' },
              { value: 'clean', label: 'After preprocessing' },
            ]}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="pp-table min-w-[900px]" key={mode}>
            <thead>
              <tr>
                <th>Cell</th>
                <th>Time (UTC)</th>
                <th>Local hour</th>
                {cols.map((c) => (
                  <th key={c} className="text-end">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={`${s.site}-${s.time}`} className="pp-rise" style={{ animationDelay: `${i * 70}ms` }}>
                  <td>
                    <b className="text-white">{s.site}</b> <span className="pp-num text-[11px] text-[#8e93a8]">{s.lat}°N {s.lon}°E</span>
                  </td>
                  <td className="pp-num">{s.time.replace('T', ' ')}</td>
                  <td className="pp-num">{mode === 'clean' ? `${String(s.local_hour).padStart(2, '0')}:00` : '–'}</td>
                  {cols.map((c) => {
                    const v = mode === 'clean' ? s.clean?.[c] : s.raw[c];
                    return (
                      <td key={c} className={`pp-num text-end ${v == null ? 'text-[#5d6378]' : ''}`}>
                        {v == null ? 'not yet' : fmt(v, mode === 'raw' && v > 5000 ? 0 : c === 'clear_sky_index' ? 3 : 2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          Switch to the raw download to see what the files contain: sunlight in millions of joules, temperature in kelvin, pressure in pascal, and no derived columns. Compare Cairo at 10:00 UTC in
          January and July: the same hour delivers {fmt(rows.find((r) => r.site === 'Cairo' && r.time.startsWith('2025-01'))?.clean?.ssrd)} W/m² in winter and{' '}
          {fmt(rows.find((r) => r.site === 'Cairo' && r.time.startsWith('2025-07-15T10'))?.clean?.ssrd)} W/m² in summer.
        </Note>
      </Panel>
    </div>
  );
}
