'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/* Variable catalogue: one colour per variable, used on every chart    */
/* ------------------------------------------------------------------ */
export const VAR: Record<string, { name: string; unit: string; color: string }> = {
  ssrd: { name: 'Surface solar radiation', unit: 'W/m²', color: '#ffd60a' },
  fdir: { name: 'Direct solar radiation', unit: 'W/m²', color: '#ff8a3d' },
  diffuse: { name: 'Diffuse radiation', unit: 'W/m²', color: '#30d5c8' },
  t2m: { name: '2 m temperature', unit: '°C', color: '#ff5c7a' },
  wind_speed: { name: '10 m wind speed', unit: 'm/s', color: '#7cf29a' },
  u10: { name: 'Eastward wind', unit: 'm/s', color: '#5ab0ff' },
  v10: { name: 'Northward wind', unit: 'm/s', color: '#c58cff' },
  sp: { name: 'Surface pressure', unit: 'hPa', color: '#6fd3ff' },
};

export const CMAPS: Record<string, string[]> = {
  solar: ['#0b0620', '#3b0f6f', '#8c2981', '#de4968', '#fe9f6d', '#ffd60a', '#fff7c2'],
  thermal: ['#0a1a4a', '#1565c0', '#30d5c8', '#f2e85c', '#ff8a3d', '#e0314b'],
  ice: ['#04121f', '#0b3a5c', '#1479a8', '#30d5c8', '#c9fff8'],
  wind: ['#12082e', '#3b2a8c', '#2b7fb8', '#30d5c8', '#9ff26b', '#f4ff7a'],
};

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function buildLut(stops: string[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const rgb = stops.map(hexToRgb);
  for (let i = 0; i < 256; i++) {
    const p = (i / 255) * (rgb.length - 1);
    const a = Math.floor(p);
    const b = Math.min(rgb.length - 1, a + 1);
    const f = p - a;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = rgb[a][c] + (rgb[b][c] - rgb[a][c]) * f;
  }
  return lut;
}

export function fmt(v: number | null | undefined, d?: number): string {
  if (v == null || !Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  const dec = d ?? (a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 1 : 2);
  return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  }
  return out;
}

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    setW(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCountUp(target: number, run: unknown = 0, ms = 1200): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

export function CountUp({ value, decimals = 0, run }: { value: number; decimals?: number; run?: unknown }) {
  const v = useCountUp(value, run);
  return <>{fmt(v, decimals)}</>;
}

/* ------------------------------------------------------------------ */
/* Line chart                                                          */
/* ------------------------------------------------------------------ */
export interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

export interface Band {
  color: string;
  lo: (number | null)[];
  hi: (number | null)[];
}

interface LineChartProps {
  x: number[];
  series: Series[];
  bands?: Band[];
  xTicks: { x: number; label: string }[];
  fmtX: (i: number) => string;
  unit?: string;
  height?: number;
  gapBreak?: number;
  yMin?: number;
  zeroLine?: boolean;
  cursor?: number | null;
  animKey?: string | number;
  markers?: boolean;
}

function buildPath(
  xs: number[],
  ys: (number | null)[],
  sx: (v: number) => number,
  sy: (v: number) => number,
  gapBreak?: number,
): string {
  let d = '';
  let pen = false;
  for (let i = 0; i < xs.length; i++) {
    const v = ys[i];
    if (v == null) {
      pen = false;
      continue;
    }
    if (pen && gapBreak && xs[i] - xs[i - 1] > gapBreak) pen = false;
    d += `${pen ? 'L' : 'M'}${sx(xs[i]).toFixed(1)} ${sy(v).toFixed(1)}`;
    pen = true;
  }
  return d;
}

function buildBand(
  xs: number[],
  band: Band,
  sx: (v: number) => number,
  sy: (v: number) => number,
  gapBreak?: number,
): string {
  let d = '';
  let seg: number[] = [];
  const flush = () => {
    if (seg.length > 1) {
      d += seg.map((i, k) => `${k ? 'L' : 'M'}${sx(xs[i]).toFixed(1)} ${sy(band.hi[i] as number).toFixed(1)}`).join('');
      for (let k = seg.length - 1; k >= 0; k--) {
        const i = seg[k];
        d += `L${sx(xs[i]).toFixed(1)} ${sy(band.lo[i] as number).toFixed(1)}`;
      }
      d += 'Z';
    }
    seg = [];
  };
  for (let i = 0; i < xs.length; i++) {
    if (band.lo[i] == null || band.hi[i] == null) {
      flush();
      continue;
    }
    if (seg.length && gapBreak && xs[i] - xs[i - 1] > gapBreak) flush();
    seg.push(i);
  }
  flush();
  return d;
}

export function LineChart({
  x,
  series,
  bands = [],
  xTicks,
  fmtX,
  unit = '',
  height = 220,
  gapBreak,
  yMin,
  zeroLine,
  cursor = null,
  animKey = 0,
  markers = false,
}: LineChartProps) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 46, r: 12, t: 10, b: 24 };
  const pw = Math.max(10, w - m.l - m.r);
  const ph = height - m.t - m.b;

  const [lo, hi] = useMemo(() => {
    let a = Infinity;
    let b = -Infinity;
    const eat = (arr: (number | null)[]) => {
      for (const v of arr) {
        if (v == null) continue;
        if (v < a) a = v;
        if (v > b) b = v;
      }
    };
    series.forEach((s) => eat(s.values));
    bands.forEach((bd) => {
      eat(bd.lo);
      eat(bd.hi);
    });
    if (!Number.isFinite(a)) return [0, 1];
    const pad = (b - a || 1) * 0.07;
    return [yMin ?? a - pad, b + pad];
  }, [series, bands, yMin]);

  const x0 = x[0];
  const x1 = x[x.length - 1];
  const sx = (v: number) => m.l + ((v - x0) / (x1 - x0 || 1)) * pw;
  const sy = (v: number) => m.t + ph - ((v - lo) / (hi - lo || 1)) * ph;
  const ticks = niceTicks(lo, hi, 4);
  const active = hover ?? cursor;
  const dense = x.length > 400;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xv = x0 + ((e.clientX - rect.left) / rect.width) * (x1 - x0);
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < x.length; i++) {
      const dd = Math.abs(x[i] - xv);
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    }
    setHover(best);
  };

  const tipLeft = active != null ? Math.min(Math.max(sx(x[active]) + 12, 4), Math.max(4, w - 178)) : 0;

  return (
    <div ref={ref} className="relative w-full select-none">
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={series.map((s) => s.label).join(', ')}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + pw} y1={sy(t)} y2={sy(t)} stroke="rgba(120,220,255,0.09)" />
              <text x={m.l - 7} y={sy(t) + 3.5} textAnchor="end" className="pp-axis">
                {fmt(t, Math.abs(hi - lo) < 5 ? 1 : 0)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={t.x}>
              <line x1={sx(t.x)} x2={sx(t.x)} y1={m.t} y2={m.t + ph} stroke="rgba(120,220,255,0.06)" />
              <text x={sx(t.x)} y={height - 7} textAnchor="middle" className="pp-axis">
                {t.label}
              </text>
            </g>
          ))}
          {zeroLine && lo < 0 && hi > 0 && (
            <line x1={m.l} x2={m.l + pw} y1={sy(0)} y2={sy(0)} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 4" />
          )}
          <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke="rgba(120,220,255,0.28)" />
          <g key={`${animKey}-${w}`}>
            {bands.map((bd, i) => (
              <path key={i} d={buildBand(x, bd, sx, sy, gapBreak)} fill={bd.color} className="pp-band" />
            ))}
            {series.map((s, i) => (
              <path
                key={s.key}
                d={buildPath(x, s.values, sx, sy, gapBreak)}
                fill="none"
                stroke={s.color}
                strokeWidth={dense ? 1 : 1.7}
                strokeLinejoin="round"
                pathLength={1}
                className="pp-draw"
                style={{ animationDelay: `${i * 0.18}s`, filter: dense ? undefined : `drop-shadow(0 0 5px ${s.color}88)` }}
              />
            ))}
            {markers &&
              series.map((s) =>
                s.values.map((v, i) =>
                  v == null ? null : (
                    <circle key={`${s.key}-${i}`} cx={sx(x[i])} cy={sy(v)} r={2.4} fill="#060810" stroke={s.color} strokeWidth={1.3} className="pp-fade" />
                  ),
                ),
              )}
          </g>
          {active != null && (
            <g pointerEvents="none">
              <line x1={sx(x[active])} x2={sx(x[active])} y1={m.t} y2={m.t + ph} stroke="rgba(255,255,255,0.55)" strokeDasharray="2 3" />
              {series.map((s) =>
                s.values[active] == null ? null : (
                  <circle key={s.key} cx={sx(x[active])} cy={sy(s.values[active] as number)} r={4} fill={s.color} stroke="#060810" strokeWidth={1.5} />
                ),
              )}
            </g>
          )}
          <rect x={m.l} y={m.t} width={pw} height={ph} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      )}
      {active != null && w > 0 && (
        <div className="pp-tip" style={{ left: tipLeft, top: 6 }}>
          <div className="pp-tip-head">{fmtX(active)}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-[3px] w-3 rounded" style={{ background: s.color }} />
                {s.label}
              </span>
              <b>
                {fmt(s.values[active])} {unit}
              </b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; note?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 font-mono text-[11px] text-[#c9d3e6]">
          <i className="inline-block h-[3px] w-4 rounded" style={{ background: it.color, boxShadow: `0 0 6px ${it.color}` }} />
          {it.label}
          {it.note && <span className="text-[#8e93a8]">· {it.note}</span>}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Histogram                                                           */
/* ------------------------------------------------------------------ */
export function Histogram({
  counts,
  min,
  max,
  mean,
  color,
  unit,
  height = 170,
  animKey = 0,
}: {
  counts: number[];
  min: number;
  max: number;
  mean: number;
  color: string;
  unit: string;
  height?: number;
  animKey?: string | number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 8, r: 8, t: 8, b: 22 };
  const pw = Math.max(10, w - m.l - m.r);
  const ph = height - m.t - m.b;
  const top = Math.max(...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const bw = pw / counts.length;
  const step = (max - min) / counts.length;
  const ticks = niceTicks(min, max, 4);
  const sx = (v: number) => m.l + ((v - min) / (max - min)) * pw;

  return (
    <div ref={ref} className="relative w-full">
      {w > 0 && (
        <svg width={w} height={height} onMouseLeave={() => setHover(null)}>
          <g key={`${animKey}-${w}`}>
            {counts.map((c, i) => {
              const h = (c / top) * ph;
              return (
                <rect
                  key={i}
                  x={m.l + i * bw + 0.5}
                  y={m.t + ph - h}
                  width={Math.max(1, bw - 1)}
                  height={h}
                  fill={color}
                  opacity={hover == null || hover === i ? 0.92 : 0.35}
                  className="pp-bar"
                  style={{ animationDelay: `${i * 12}ms` }}
                />
              );
            })}
          </g>
          {counts.map((_, i) => (
            <rect key={i} x={m.l + i * bw} y={m.t} width={bw} height={ph} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
          <line x1={sx(mean)} x2={sx(mean)} y1={m.t} y2={m.t + ph} stroke="#ffffff" strokeDasharray="3 3" opacity={0.7} pointerEvents="none" />
          <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke="rgba(120,220,255,0.28)" />
          {ticks.map((t) => (
            <text key={t} x={sx(t)} y={height - 6} textAnchor="middle" className="pp-axis">
              {fmt(t, 0)}
            </text>
          ))}
        </svg>
      )}
      {hover != null && (
        <div className="pp-tip" style={{ left: Math.min(Math.max(m.l + hover * bw - 60, 4), Math.max(4, w - 170)), top: 4 }}>
          <div className="pp-tip-head">
            {fmt(min + hover * step)} to {fmt(min + (hover + 1) * step)} {unit}
          </div>
          <div>
            <b>{((100 * counts[hover]) / total).toFixed(2)}%</b> of sampled values
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Heat map on the ERA5 grid, with tweened frames and wind particles   */
/* ------------------------------------------------------------------ */
const CITIES = [
  { name: 'Cairo', lat: 30.04, lon: 31.24 },
  { name: 'Alexandria', lat: 31.2, lon: 29.92 },
  { name: 'Aswan', lat: 24.09, lon: 32.9 },
  { name: 'Luxor', lat: 25.69, lon: 32.64 },
  { name: 'Hurghada', lat: 27.26, lon: 33.81 },
  { name: 'Suez', lat: 29.97, lon: 32.53 },
];

interface HeatMapProps {
  lat: number[];
  lon: number[];
  field: number[];
  vmin: number;
  vmax: number;
  cmap: string;
  unit: string;
  wind?: { u: number[]; v: number[] } | null;
  maxHeight?: number;
  compact?: boolean;
}

export function HeatMap({ lat, lon, field, vmin, vmax, cmap, unit, wind = null, maxHeight = 460, compact = false }: HeatMapProps) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const windRef = useRef<HTMLCanvasElement | null>(null);
  const shown = useRef<Float32Array | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; v: number; la: number; lo: number } | null>(null);

  const ny = lat.length;
  const nx = lon.length;
  const aspect = (nx * Math.cos((27.75 * Math.PI) / 180)) / ny;
  const ml = compact ? 0 : 34;
  const mb = compact ? 0 : 22;
  const ph = Math.max(20, Math.min(maxHeight, (w - ml) / aspect));
  const pw = ph * aspect;
  const offX = ml + Math.max(0, (w - ml - pw) / 2);
  const lut = useMemo(() => buildLut(CMAPS[cmap]), [cmap]);

  const lon0 = lon[0] - 0.125;
  const lon1 = lon[nx - 1] + 0.125;
  const lat0 = lat[0] - 0.125;
  const lat1 = lat[ny - 1] + 0.125;
  const px = (lo: number) => ((lo - lon0) / (lon1 - lon0)) * pw;
  const py = (la: number) => ph - ((la - lat0) / (lat1 - lat0)) * ph;

  // tween the displayed field toward the requested one
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || w === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(pw * dpr);
    cv.height = Math.round(ph * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const off = document.createElement('canvas');
    off.width = nx;
    off.height = ny;
    const octx = off.getContext('2d');
    if (!octx) return;
    const img = octx.createImageData(nx, ny);
    const from = shown.current && shown.current.length === field.length ? Float32Array.from(shown.current) : Float32Array.from(field);
    const cur = new Float32Array(field.length);
    const dur = prefersReducedMotion() ? 0 : 650;
    const t0 = performance.now();
    let raf = 0;
    const draw = (t: number) => {
      const p = dur ? Math.min(1, (t - t0) / dur) : 1;
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      for (let r = 0; r < ny; r++) {
        const src = (ny - 1 - r) * nx;
        for (let c = 0; c < nx; c++) {
          const k = src + c;
          const v = from[k] + (field[k] - from[k]) * e;
          cur[k] = v;
          const q = Math.max(0, Math.min(255, Math.round(((v - vmin) / (vmax - vmin || 1)) * 255)));
          const o = (r * nx + c) * 4;
          img.data[o] = lut[q * 3];
          img.data[o + 1] = lut[q * 3 + 1];
          img.data[o + 2] = lut[q * 3 + 2];
          img.data[o + 3] = 255;
        }
      }
      shown.current = cur;
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, 0, 0, cv.width, cv.height);
      if (p < 1) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [field, vmin, vmax, lut, w, pw, ph, nx, ny]);

  // wind particles follow the u/v field
  useEffect(() => {
    const cv = windRef.current;
    if (!cv || !wind || w === 0 || prefersReducedMotion()) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(pw * dpr);
    cv.height = Math.round(ph * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const n = 520;
    const P = Array.from({ length: n }, () => ({
      lo: lon0 + Math.random() * (lon1 - lon0),
      la: lat0 + Math.random() * (lat1 - lat0),
      age: Math.random() * 90,
    }));
    let raf = 0;
    const step = () => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(0, 0, pw, ph);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,255,255,0.78)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const p of P) {
        const c = Math.max(0, Math.min(nx - 1, Math.round((p.lo - lon[0]) / 0.25)));
        const r = Math.max(0, Math.min(ny - 1, Math.round((p.la - lat[0]) / 0.25)));
        const k = r * nx + c;
        const nlo = p.lo + wind.u[k] * 0.006;
        const nla = p.la + wind.v[k] * 0.006;
        ctx.moveTo(px(p.lo), py(p.la));
        ctx.lineTo(px(nlo), py(nla));
        p.lo = nlo;
        p.la = nla;
        p.age += 1;
        if (p.age > 110 || nlo < lon0 || nlo > lon1 || nla < lat0 || nla > lat1) {
          p.lo = lon0 + Math.random() * (lon1 - lon0);
          p.la = lat0 + Math.random() * (lat1 - lat0);
          p.age = 0;
        }
      }
      ctx.stroke();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wind, w, pw, ph]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const c = Math.max(0, Math.min(nx - 1, Math.floor(fx * nx)));
    const r = Math.max(0, Math.min(ny - 1, Math.floor((1 - fy) * ny)));
    const src = shown.current ?? field;
    setTip({ x: fx * pw, y: fy * ph, v: src[r * nx + c], la: lat[r], lo: lon[c] });
  };

  const lonTicks = [28, 29, 30, 31, 32, 33, 34, 35];
  const latTicks = [24, 25, 26, 27, 28, 29, 30, 31];

  return (
    <div ref={ref} className="relative w-full" style={{ height: ph + mb }}>
      {w > 0 && (
        <>
          <div
            className="pp-map absolute overflow-hidden"
            style={{ left: offX, top: 0, width: pw, height: ph }}
            onMouseMove={compact ? undefined : onMove}
            onMouseLeave={() => setTip(null)}
          >
            <canvas ref={canvasRef} style={{ width: pw, height: ph, display: 'block' }} />
            {wind && <canvas ref={windRef} className="absolute inset-0" style={{ width: pw, height: ph }} />}
            {!compact && (
              <svg className="pointer-events-none absolute inset-0" width={pw} height={ph}>
                {lonTicks.map((t) => (
                  <line key={`x${t}`} x1={px(t)} x2={px(t)} y1={0} y2={ph} stroke="rgba(255,255,255,0.09)" />
                ))}
                {latTicks.map((t) => (
                  <line key={`y${t}`} x1={0} x2={pw} y1={py(t)} y2={py(t)} stroke="rgba(255,255,255,0.09)" />
                ))}
                {CITIES.map((c) => (
                  <g key={c.name} transform={`translate(${px(c.lon)},${py(c.lat)})`}>
                    <circle r={3.2} fill="none" stroke="#fff" strokeWidth={1.2} />
                    <circle r={1} fill="#fff" />
                    <text x={6} y={3.5} className="pp-city">
                      {c.name}
                    </text>
                  </g>
                ))}
              </svg>
            )}
            {tip && (
              <div className="pp-tip" style={{ left: Math.min(tip.x + 12, pw - 150), top: Math.max(4, tip.y - 46) }}>
                <div className="pp-tip-head">
                  {tip.la.toFixed(2)}°N · {tip.lo.toFixed(2)}°E
                </div>
                <b>
                  {fmt(tip.v)} {unit}
                </b>
              </div>
            )}
          </div>
          {!compact && (
            <svg className="pointer-events-none absolute left-0 top-0" width={w} height={ph + mb}>
              {lonTicks.map((t) => (
                <text key={t} x={offX + px(t)} y={ph + 15} textAnchor="middle" className="pp-axis">
                  {t}°E
                </text>
              ))}
              {latTicks.map((t) => (
                <text key={t} x={offX - 6} y={py(t) + 3.5} textAnchor="end" className="pp-axis">
                  {t}°N
                </text>
              ))}
            </svg>
          )}
        </>
      )}
    </div>
  );
}

export function ColorBar({ cmap, vmin, vmax, unit }: { cmap: string; vmin: number; vmax: number; unit: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-[#c9d3e6]">
      <span>{fmt(vmin)}</span>
      <div className="h-2.5 flex-1 rounded-full border border-white/15" style={{ background: `linear-gradient(90deg, ${CMAPS[cmap].join(',')})` }} />
      <span>
        {fmt(vmax)} {unit}
      </span>
    </div>
  );
}
