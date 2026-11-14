'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { ColorBar, HeatMap, Histogram, Legend, LineChart, VAR, fmt, type Band, type Series } from './charts';
import { Explain, LayoutGuide, Note, Panel, Seg } from './ui';
import type { PPData } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function range(arrs: number[][]): [number, number] {
  let a = Infinity;
  let b = -Infinity;
  for (const arr of arrs) for (const v of arr) {
    if (v < a) a = v;
    if (v > b) b = v;
  }
  return [a, b];
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function ser(key: string, values: (number | null)[]): Series {
  return { key, label: key, color: VAR[key].color, values };
}

const GROUPS: { id: string; name: string; unit: string; vars: string[]; yMin?: number; zero?: boolean }[] = [
  { id: 'rad', name: 'Radiation', unit: 'W/m²', vars: ['ssrd', 'fdir', 'diffuse'], yMin: 0 },
  { id: 'temp', name: 'Temperature', unit: '°C', vars: ['t2m'] },
  { id: 'wind', name: 'Wind', unit: 'm/s', vars: ['wind_speed', 'u10', 'v10'], zero: true },
  { id: 'sp', name: 'Pressure', unit: 'hPa', vars: ['sp'] },
];

/* ================================================================== */
/* Maps                                                                */
/* ================================================================== */
const MAP_VARS = ['ssrd', 'fdir', 't2m', 'sp', 'wind_speed'] as const;
const MAP_CMAP: Record<string, string> = { ssrd: 'solar', fdir: 'solar', t2m: 'thermal', sp: 'ice', wind_speed: 'wind' };

export function MapsTab({ d }: { d: PPData }) {
  const [v, setV] = useState<(typeof MAP_VARS)[number]>('ssrd');
  const [mode, setMode] = useState<'month' | 'hour' | 'mean'>('month');
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  const frames = mode === 'month' ? d.maps.by_month[v] : mode === 'hour' ? d.maps.by_hour[v] : [d.maps.mean[v]];
  const labels = mode === 'month' ? d.maps.months.map((m) => MONTHS[m - 1]) : mode === 'hour' ? d.maps.hours.map((h) => `${String(h).padStart(2, '0')}:00`) : ['All'];
  const f = Math.min(frame, frames.length - 1);
  const [vmin, vmax] = useMemo(() => range(frames), [frames]);
  const meanRange = useMemo(() => range([d.maps.mean[v]]), [d, v]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setInterval(() => setFrame((x) => (x + 1) % frames.length), 1150);
    return () => clearInterval(id);
  }, [playing, frames.length]);

  const wind =
    v === 'wind_speed'
      ? mode === 'month'
        ? { u: d.maps.by_month.u10[f], v: d.maps.by_month.v10[f] }
        : mode === 'hour'
          ? { u: d.maps.by_hour.u10[f], v: d.maps.by_hour.v10[f] }
          : { u: d.maps.mean.u10, v: d.maps.mean.v10 }
      : null;

  const cur = frames[f];
  const [cmin, cmax] = range([cur]);
  const unit = VAR[v].unit;
  const mr = `${fmt(meanRange[0])} to ${fmt(meanRange[1])} ${unit}`;

  const info: Record<string, { read: string; why: string; finding: string }> = {
    ssrd: {
      read: `Each pixel is one ERA5 cell. Bright yellow is more sunlight on a flat surface, dark purple is less. Averaged over all daylight hours the cells span ${mr}.`,
      why: 'This is the fuel map. PV output is close to proportional to ssrd, so the gradient you see is, to a first approximation, the gradient in energy a panel would produce.',
      finding: 'Sunlight grows steadily from the Mediterranean coast in the north to Upper Egypt in the south. Play the months: the whole map brightens toward June and the north-south contrast is widest in winter.',
    },
    fdir: {
      read: `Same colours as ssrd, but only the beam that comes straight from the sun. The all-year cell averages span ${mr}.`,
      why: 'Direct light is what tilt and sun-tracking can capture, and what dust and haze remove first. A site with high ssrd but lower fdir has a hazier sky.',
      finding: 'The pattern follows ssrd, with a sharper drop along the coast and the Delta, where humidity and cloud scatter more of the beam.',
    },
    t2m: {
      read: `Blue is cooler, red is hotter. Daylight-hour averages span ${mr}.`,
      why: 'Heat costs power. Two sites with the same sunlight do not produce the same energy if one runs its panels 8 °C hotter. This map is the correction to the sunlight map.',
      finding: 'The hottest air sits in the Nile valley of Upper Egypt and along the Red Sea coast; the coolest over the Sinai highlands and the Mediterranean shore. The sunniest region is also the hottest, which is exactly why panel technology choice depends on region.',
    },
    sp: {
      read: `Bright is high pressure (low ground or sea), dark is low pressure (high ground). The averages span ${mr}.`,
      why: 'Pressure falls with height, so this is in effect a terrain map. ERA5 single levels carry no altitude field; pressure is how the dataset tells the model that a cell is on a mountain.',
      finding: 'The dark patch in south Sinai is the St Catherine mountains. The darker band east of the Nile is the Red Sea hills. Month to month this map barely moves, because terrain does not change.',
    },
    wind_speed: {
      read: `Colour is the average wind speed (${mr}); the moving streaks trace the average wind direction and are longer where the wind is stronger.`,
      why: 'Wind cools panels and raises their efficiency on hot days. It also carries dust, which soils them. Direction matters for both.',
      finding: 'The flow is from the north almost everywhere. The bright corridor is the Gulf of Suez and the Red Sea coast, the windiest part of Egypt, where the country builds its wind farms.',
    },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {MAP_VARS.map((k) => {
          const [a, b] = range([d.maps.mean[k]]);
          return (
            <button
              key={k}
              type="button"
              onClick={() => setV(k)}
              aria-pressed={k === v}
              className={`cursor-pointer rounded-lg border p-1.5 text-start transition ${
                k === v ? 'border-[#30d5c8] bg-[#30d5c8]/[0.1] shadow-[0_0_20px_-6px_rgba(48,213,200,0.7)]' : 'border-white/10 bg-white/[0.02] hover:border-white/30'
              }`}
            >
              <div className="pointer-events-none mx-auto max-w-[110px]">
                <HeatMap lat={d.grid.lat} lon={d.grid.lon} field={d.maps.mean[k]} vmin={a} vmax={b} cmap={MAP_CMAP[k]} unit="" compact maxHeight={100} />
              </div>
              <div className="pp-num mt-1.5 truncate text-center text-[11px] font-semibold text-white">{k}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <Panel
          hud={`Map · ${v}`}
          title={`${VAR[v].name} (${unit})`}
          right={
            <Seg
              label="Animate over"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setFrame(0);
              }}
              options={[
                { value: 'month', label: 'Months' },
                { value: 'hour', label: 'Hours of the day' },
                { value: 'mean', label: 'All-time mean' },
              ]}
            />
          }
        >
          <HeatMap lat={d.grid.lat} lon={d.grid.lon} field={cur} vmin={vmin} vmax={vmax} cmap={MAP_CMAP[v]} unit={unit} wind={wind} />
          <div className="mt-3">
            <ColorBar cmap={MAP_CMAP[v]} vmin={vmin} vmax={vmax} unit={unit} />
          </div>
          {frames.length > 1 && (
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className="pp-tab" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={f}
                onChange={(e) => {
                  setFrame(Number(e.target.value));
                  setPlaying(false);
                }}
                className="flex-1"
                aria-label={mode === 'month' ? 'Month' : 'Local hour'}
              />
              <span className="pp-num w-[92px] text-end text-[13px] font-semibold text-[#ffd60a]">
                {labels[f]}
                {mode === 'hour' ? ' local' : ''}
              </span>
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ['Lowest cell', cmin],
              ['Grid mean', mean(cur)],
              ['Highest cell', cmax],
            ].map(([l, val]) => (
              <div key={l as string} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="pp-num text-[15px] font-semibold text-white">
                  {fmt(val as number)} <span className="text-[11px] font-medium text-[#8e93a8]">{unit}</span>
                </div>
                <div className="pp-hud mt-0.5 !text-[9.5px] !text-[#8e93a8]">{l}</div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel hud="Reading the map" title={VAR[v].name}>
            <div key={v} className="pp-rise">
              <Explain read={info[v].read} why={info[v].why} finding={info[v].finding} />
            </div>
          </Panel>
          <LayoutGuide
            rows={[
              { name: 'Latitude (vertical axis)', text: 'South at the bottom (Aswan, 24°N), north at the top (the Mediterranean, 31.75°N). Moving up a row of pixels moves about 28 km north.' },
              { name: 'One pixel', text: 'One 0.25° ERA5 cell. Its colour is the average of that variable over the chosen period, daylight hours only.' },
            ]}
            cols={[
              { name: 'Longitude (horizontal axis)', text: 'West at the left (the Western Desert, 27.75°E), east at the right (Sinai and the Red Sea, 35°E).' },
              { name: 'The five maps', text: 'Two sunlight maps, then the three things that modify what a panel does with that sunlight: temperature, terrain (pressure) and wind.' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Time series                                                         */
/* ================================================================== */
export function TimeSeriesTab({ d }: { d: PPData }) {
  const [wi, setWi] = useState(0);
  const W = d.timeseries.weeks[wi];
  const t0 = new Date(`${W.start}T00:00Z`).getTime();
  const wx = W.time.map((t) => (new Date(`${t}Z`).getTime() - t0) / 3600000);
  const wTicks = Array.from({ length: 7 }, (_, i) => ({
    x: i * 24 + 12,
    label: new Date(t0 + i * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
  })).filter((t) => t.x >= wx[0] && t.x <= wx[wx.length - 1]);

  const dates = d.timeseries.dates;
  const dx = dates.map((_, i) => i);
  const dTicks = dates.map((s, i) => ({ s, i })).filter((o) => o.s.endsWith('-01-01')).map((o) => ({ x: o.i, label: o.s.slice(0, 4) }));

  const rowText: Record<string, string> = {
    rad: 'The energy source. ssrd is the total, fdir the direct beam, diffuse the scattered remainder. The gap between ssrd and fdir is the haze and cloud signal.',
    temp: 'The efficiency penalty. It peaks later in the day than the sun and later in the year than the longest day.',
    wind: 'The cooling. Speed is always positive; u10 and v10 show direction. v10 below zero means wind from the north.',
    sp: 'The slow background. It changes little within a day and marks the passage of weather systems across weeks.',
  };

  return (
    <div className="space-y-4">
      <LayoutGuide
        rows={GROUPS.map((g) => ({ name: g.name, text: rowText[g.id] }))}
        cols={[
          { name: 'One week, hour by hour', text: 'Shows the daily rhythm the model must reproduce. The line is the average over all 990 cells; the shaded band holds the middle 80 % of cells, so its width is how much Egypt differs from place to place at that hour. Night hours are absent, so the line breaks.' },
          { name: 'The whole record, day by day', text: `Each point is one day's average over the daylight hours, ${dates[0].slice(0, 4)} to ${dates[dates.length - 1].slice(0, 4)}. Shows the seasonal cycle and whether it repeats from year to year, which is what makes the data learnable.` },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="pp-hud">Example week</span>
        <Seg
          label="Example week"
          value={wi}
          onChange={setWi}
          options={d.timeseries.weeks.map((w, i) => ({
            value: i,
            label: new Date(`${w.start}T00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
          }))}
        />
      </div>

      {GROUPS.map((g) => {
        const bandVar = g.vars[0];
        const b = W.band[bandVar];
        const bands: Band[] = b ? [{ color: VAR[bandVar].color, lo: b.lo, hi: b.hi }] : [];
        return (
          <div key={g.id} className="grid gap-4 lg:grid-cols-2">
            <Panel hud={`${g.name} · one week`} right={<Legend items={g.vars.map((k) => ({ label: k, color: VAR[k].color }))} />}>
              <LineChart
                x={wx}
                series={g.vars.map((k) => ser(k, W.series[k]))}
                bands={bands}
                xTicks={wTicks}
                fmtX={(i) => `${W.time[i].replace('T', ' ')} UTC`}
                unit={g.unit}
                gapBreak={1.5}
                yMin={g.yMin}
                zeroLine={g.zero}
                animKey={`${wi}`}
              />
            </Panel>
            <Panel hud={`${g.name} · whole record`} right={<span className="pp-num text-[11px] text-[#8e93a8]">{g.unit}, daily mean</span>}>
              <LineChart
                x={dx}
                series={g.vars.map((k) => ser(k, d.timeseries.daily[k]))}
                xTicks={dTicks}
                fmtX={(i) => dates[i]}
                unit={g.unit}
                yMin={g.yMin}
                zeroLine={g.zero}
              />
            </Panel>
          </div>
        );
      })}

      <Panel hud="What the figure says">
        <Explain
          read="Hover any chart to read exact values. On the left, each hump is one day: it rises after sunrise, peaks near local noon and falls to zero. On the right, the hump is one year. Sharp downward spikes on the right are cloudy or dusty days averaged over the whole country."
          why="A forecasting model is only as good as the regularity of what it learns. These two columns show the two regularities it can rely on, the day and the year, and the size of the irregular part it has to predict from weather."
          finding={`Radiation repeats almost perfectly from year to year, with summer days near ${fmt(Math.max(...(d.timeseries.daily.ssrd.filter((x) => x != null) as number[])), 0)} W/m² and winter days near half of that. Spikes cluster in winter and spring, the season of cloud and dust storms; summers are smooth. The last point drops to zero because the final day in the archive holds only its first hours.`}
        />
      </Panel>
    </div>
  );
}

/* ================================================================== */
/* Daily cycle                                                         */
/* ================================================================== */
export function DailyCycleTab({ d }: { d: PPData }) {
  const hours = d.diurnal.hours;
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setCur((c) => (c + 1) % hours.length), 750);
    return () => clearInterval(id);
  }, [playing, hours.length]);

  const M = d.diurnal.mean;
  const S = d.diurnal.std;
  const groups = [
    { ...GROUPS[0] },
    { ...GROUPS[1] },
    { id: 'wind', name: 'Wind speed', unit: 'm/s', vars: ['wind_speed'] },
    { ...GROUPS[3] },
  ];
  const peak = (k: string) => hours[M[k].indexOf(Math.max(...M[k]))];
  const trough = (k: string) => hours[M[k].indexOf(Math.min(...M[k]))];
  const frac = cur / (hours.length - 1);

  const notes: Record<string, string> = {
    rad: `Sunlight peaks at ${peak('ssrd')}:00. The wide band is the season: the same hour is far brighter in June than in December.`,
    temp: `Air temperature peaks at ${peak('t2m')}:00, about ${peak('t2m') - peak('ssrd')} hours after the sun. Panels are therefore hottest after their brightest hour.`,
    wind: `Wind is weakest at ${trough('wind_speed')}:00 and strongest at ${peak('wind_speed')}:00, so the cooling breeze arrives in the hot afternoon.`,
    sp: `Pressure swings by about ${fmt(Math.max(...M.sp) - Math.min(...M.sp), 1)} hPa, high mid-morning and low late afternoon. This is the atmospheric tide: real, regular, and small.`,
  };

  return (
    <div className="space-y-4">
      <Panel
        hud="Average day"
        title="The 14 daylight hours, averaged over every day and every cell"
        right={
          <button type="button" className="pp-tab" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? 'Pause' : 'Play'}
          </button>
        }
      >
        <div className="grid items-center gap-4 md:grid-cols-[260px_1fr]">
          <svg viewBox="0 0 260 120" className="w-full max-w-[260px]" aria-hidden="true">
            <path d="M15 105 A115 100 0 0 1 245 105" fill="none" stroke="rgba(255,214,10,0.3)" strokeDasharray="3 5" />
            <line x1="5" x2="255" y1="105" y2="105" stroke="rgba(120,220,255,0.35)" />
            <g transform={`translate(${130 - 115 * Math.cos(Math.PI * frac)},${105 - 100 * Math.sin(Math.PI * frac)})`} style={{ transition: 'transform 0.7s linear' }}>
              <circle r="15" fill="rgba(255,214,10,0.18)" />
              <circle r="8" fill="#ffd60a" style={{ filter: 'drop-shadow(0 0 8px #ffd60a)' }} />
            </g>
            <text x="15" y="117" textAnchor="middle" className="pp-axis">06:00</text>
            <text x="245" y="117" textAnchor="middle" className="pp-axis">19:00</text>
          </svg>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-lg border border-[#ffd60a]/35 bg-[#ffd60a]/[0.07] px-3 py-2">
              <div className="pp-num text-[17px] font-semibold text-[#ffd60a]">{String(hours[cur]).padStart(2, '0')}:00</div>
              <div className="pp-hud pp-hud-amber mt-0.5 !text-[9.5px]">local hour</div>
            </div>
            {['ssrd', 't2m', 'wind_speed', 'sp'].map((k) => (
              <div key={k} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="pp-num text-[17px] font-semibold" style={{ color: VAR[k].color }}>
                  {fmt(M[k][cur])} <span className="text-[10.5px] font-medium text-[#8e93a8]">{VAR[k].unit}</span>
                </div>
                <div className="pp-hud mt-0.5 !text-[9.5px] !text-[#8e93a8]">{k}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Panel key={g.id} hud={`${g.name} · ${g.unit}`} right={<Legend items={g.vars.map((k) => ({ label: k, color: VAR[k].color }))} />}>
            <LineChart
              x={hours}
              series={g.vars.map((k) => ser(k, M[k]))}
              bands={g.vars.map((k) => ({ color: VAR[k].color, lo: M[k].map((m, i) => m - S[k][i]), hi: M[k].map((m, i) => m + S[k][i]) }))}
              xTicks={hours.filter((h) => h % 2 === 0).map((h) => ({ x: h, label: `${String(h).padStart(2, '0')}` }))}
              fmtX={(i) => `${String(hours[i]).padStart(2, '0')}:00 local`}
              unit={g.unit}
              cursor={cur}
              markers
              height={230}
            />
            <Note>{notes[g.id]}</Note>
          </Panel>
        ))}
      </div>

      <LayoutGuide
        rows={[
          { name: 'The line', text: 'The typical value at that local hour: the mean over all 990 cells and all days in the record.' },
          { name: 'The shaded band', text: 'One standard deviation either side, measured across days. A wide band means that hour changes a lot between seasons and weather; a narrow one means it is dependable.' },
        ]}
        cols={[
          { name: 'Radiation', text: 'The shape PV output will follow. Diffuse light stays low and flat while direct light carries the peak.' },
          { name: 'Temperature, wind, pressure', text: 'The three modifiers, on the same clock, so their timing against the sun can be read by eye: heat lags, wind lags further, pressure runs opposite.' },
        ]}
      />

      <Panel hud="What the figure says">
        <Explain
          read="The horizontal axis is the Egyptian clock from 06:00 to 19:00. The moving marker reads the same hour on all four panels, so you can compare them at one instant."
          why="The order of the peaks is the physics a forecast must respect: sun first, heat two hours later, wind later still. A model given only the current hour's radiation would miss that the afternoon is hotter than the morning at the same brightness, and would over-predict afternoon power."
        />
      </Panel>
    </div>
  );
}

/* ================================================================== */
/* Profiles                                                            */
/* ================================================================== */
export function ProfilesTab({ d }: { d: PPData }) {
  const P = d.profiles;
  const lonTicks = [28, 29, 30, 31, 32, 33, 34, 35].map((x) => ({ x, label: `${x}°E` }));
  const latTicks = [24, 25, 26, 27, 28, 29, 30, 31].map((x) => ({ x, label: `${x}°N` }));
  const first = (k: string) => P.by_lat[k][0];
  const last = (k: string) => P.by_lat[k][P.lat.length - 1];
  const spread = (arr: number[]) => Math.max(...arr) - Math.min(...arr);

  return (
    <div className="space-y-4">
      <LayoutGuide
        rows={[
          { name: 'Against longitude (west to east)', text: 'Each point is one column of the map averaged over all its latitudes and all time. Answers: does it matter how far east a site is?' },
          { name: 'Against latitude (south to north)', text: 'Each point is one row of the map averaged over all its longitudes and all time. Answers: does it matter how far north a site is?' },
        ]}
        cols={[
          { name: 'Radiation', text: 'Whether the energy resource itself changes with position.' },
          { name: 'Temperature', text: 'Whether the heat penalty changes with position.' },
          { name: 'Wind', text: 'Speed and the two direction components. The dashed line marks zero.' },
          { name: 'Pressure', text: 'Mostly the average height of the ground along that slice.' },
        ]}
      />

      {(
        [
          ['lon', 'West → east', P.lon, P.by_lon, lonTicks, (i: number) => `${P.lon[i].toFixed(2)}°E`],
          ['lat', 'South → north', P.lat, P.by_lat, latTicks, (i: number) => `${P.lat[i].toFixed(2)}°N`],
        ] as const
      ).map(([id, name, xs, data, ticks, f]) => (
        <div key={id}>
          <div className="pp-hud mb-2">{name}</div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {GROUPS.map((g) => (
              <Panel key={g.id} hud={`${g.name} · ${g.unit}`} right={<Legend items={g.vars.map((k) => ({ label: k, color: VAR[k].color }))} />}>
                <LineChart
                  x={xs as number[]}
                  series={g.vars.map((k) => ser(k, data[k]))}
                  xTicks={(ticks as { x: number; label: string }[]).filter((_, i) => i % 2 === 0)}
                  fmtX={f}
                  unit={g.unit}
                  zeroLine={g.zero}
                  height={200}
                />
              </Panel>
            ))}
          </div>
        </div>
      ))}

      <Panel hud="What the figure says">
        <Explain
          read="Compare the top row with the bottom row for the same variable. A flat line means position along that direction makes no difference; a slope means it does. Mind the vertical scales: each panel zooms to its own range."
          why="This tells the team which coordinate carries information. It justifies dividing Egypt into regions by latitude, and it is the evidence behind recommending different panel technologies for the north and the south."
          finding={`Going north, ssrd falls from ${fmt(first('ssrd'), 0)} to ${fmt(last('ssrd'), 0)} W/m² and temperature from ${fmt(first('t2m'), 1)} to ${fmt(last('t2m'), 1)} °C. Going east, ssrd changes by only ${fmt(spread(P.by_lon.ssrd), 0)} W/m². Latitude is the coordinate that matters for sunlight. Pressure is the exception: it swings with longitude because the Red Sea hills and Sinai are in the east, and it jumps at the north end where the cells sit on the sea.`}
        />
      </Panel>
    </div>
  );
}

/* ================================================================== */
/* Distributions                                                       */
/* ================================================================== */
export function DistributionsTab({ d }: { d: PPData }) {
  const H = d.distributions.hist;
  const order = ['ssrd', 'fdir', 'diffuse', 't2m', 'u10', 'v10', 'wind_speed', 'sp'];
  const notes: Record<string, string> = {
    ssrd: `Tall first bar: ${fmt(100 * H.ssrd.zero_share, 1)} % of values are zero, the hours at the edges of the day. The rest is spread almost evenly up to ${fmt(H.ssrd.max, 0)} W/m², so the model sees every light level equally often.`,
    fdir: 'Same shape as ssrd, shifted lower. The even spread is the sun climbing and descending through every height each day.',
    diffuse: `Bunched near ${fmt(H.diffuse.median, 0)} W/m² with a thin tail. The tail is the cloudy and dusty hours; they are rare, which makes them the hard cases.`,
    t2m: `A wide single hump from ${fmt(H.t2m.p05, 0)} to ${fmt(H.t2m.p95, 0)} °C for 90 % of values. No impossible readings at either end.`,
    u10: 'Centred slightly above zero: a small average drift toward the east.',
    v10: `Centred at ${fmt(H.v10.mean, 1)} m/s, clearly below zero: the wind comes from the north most of the time.`,
    wind_speed: `Skewed, as wind always is: usually ${fmt(H.wind_speed.p05, 1)} to ${fmt(H.wind_speed.p95, 1)} m/s with a long tail of windy hours.`,
    sp: 'Two bumps and a long left tail. The bumps are low desert and sea-level cells; the tail is the mountain cells. This is terrain, not weather.',
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {order.map((k) => (
          <Panel key={k} hud={`${k} · ${VAR[k].unit}`} title={VAR[k].name}>
            <Histogram counts={H[k].counts} min={H[k].min} max={H[k].max} mean={H[k].mean} color={VAR[k].color} unit={VAR[k].unit} />
            <div className="pp-num mt-1 flex justify-between text-[10.5px] text-[#8e93a8]">
              <span>mean {fmt(H[k].mean)}</span>
              <span>median {fmt(H[k].median)}</span>
              <span>sd {fmt(H[k].std)}</span>
            </div>
            <Note>{notes[k]}</Note>
          </Panel>
        ))}
      </div>

      <LayoutGuide
        rows={[
          { name: 'Top row: ssrd, fdir, diffuse, t2m', text: 'The energy variables and the heat penalty. Their shapes show whether the model will see enough examples of each condition.' },
          { name: 'Bottom row: u10, v10, wind_speed, sp', text: 'The wind and terrain variables. Symmetric bell shapes for the wind components, a skewed one for speed.' },
        ]}
        cols={[
          { name: 'Horizontal axis', text: 'The value of the variable, split into 60 equal bins. Hover a bar for its range.' },
          { name: 'Bar height', text: `How many of the ${fmt(d.distributions.sample, 0)} randomly sampled values fall in that bin. The dashed white line is the mean.` },
        ]}
      />

      <Panel hud="What the figure says">
        <Explain
          read="A histogram answers one question: which values are common and which are rare? Look for three things: where the bulk sits, how long the tails are, and whether any bar sits somewhere physically impossible."
          why="Distributions decide how inputs are scaled before training and reveal where the model will be weak. A variable with a long tail needs different scaling from a bell-shaped one, and conditions that are rare in the data are the ones the model will predict worst."
          finding="Nothing sits outside a physically possible range, so no outlier removal is needed. The one structural feature is the spike at zero in the radiation variables, which is real (low sun), not an error."
        />
      </Panel>
    </div>
  );
}

/* ================================================================== */
/* Correlation                                                         */
/* ================================================================== */
const PAIR_NOTES: Record<string, string> = {
  'fdir|ssrd': 'Almost the same signal. Under a mostly clear sky the direct beam is a near-fixed share of total sunlight. Feeding both raw to a model adds little; their difference, diffuse, is where the extra information lives.',
  'diffuse|ssrd': 'Both rise and fall with the height of the sun, so they move together even though diffuse is the smaller part.',
  'diffuse|fdir': 'Linked through the height of the sun, but weaker than with ssrd: on a hazy hour diffuse goes up exactly when direct goes down.',
  'ssrd|t2m': 'The sun heats the air, but with a delay of about two hours and a strong seasonal part, so the link is moderate. For PV this is the central trade-off: the brightest hours are also warm ones.',
  'fdir|t2m': 'Same story as ssrd and temperature: sunlight warms the air, with a lag.',
  'diffuse|t2m': 'Moderate, and mostly because both are higher in the middle of the day and in summer.',
  'v10|wind_speed': 'Negative because the prevailing wind blows from the north. v10 is below zero most of the time, and the stronger the wind, the further below zero it goes.',
  'u10|wind_speed': 'Weakly positive: the wind has a smaller west-to-east part that grows with speed.',
  'sp|t2m': 'Weakly negative. In time, hot summer air comes with lower pressure. Across the map, high ground is both low-pressure and cooler, which pulls the other way. The two effects partly cancel.',
  'ssrd|wind_speed': 'Weakly positive: the wind picks up in the afternoon as the ground heats.',
  't2m|v10': 'Weakly negative: the northerly wind is strongest in the hot season and the hot part of the day.',
};

function corrColor(r: number): string {
  const a = Math.min(1, Math.abs(r));
  const [cr, cg, cb] = r >= 0 ? [255, 176, 32] : [70, 160, 255];
  const base = [14, 19, 34];
  const mix = (b: number, c: number) => Math.round(b + (c - b) * Math.pow(a, 0.8));
  return `rgb(${mix(base[0], cr)},${mix(base[1], cg)},${mix(base[2], cb)})`;
}

export function CorrelationTab({ d }: { d: PPData }) {
  const vars = d.correlation.vars;
  const Mx = d.correlation.matrix;
  const [sel, setSel] = useState<[number, number]>([0, 1]);
  const [i, j] = sel;
  const r = Mx[i][j];
  const key = [vars[i], vars[j]].sort().join('|');
  const strength = Math.abs(r) >= 0.8 ? 'very strong' : Math.abs(r) >= 0.5 ? 'strong' : Math.abs(r) >= 0.3 ? 'moderate' : Math.abs(r) >= 0.1 ? 'weak' : 'negligible';
  const generic =
    i === j
      ? 'Every variable is perfectly correlated with itself. The diagonal is always 1 and carries no information.'
      : Math.abs(r) < 0.1
        ? 'These two vary independently. Each brings information the other does not, which is what a model wants from its inputs.'
        : `A ${strength} ${r > 0 ? 'positive' : 'negative'} link: when ${vars[i]} is high, ${vars[j]} tends to be ${r > 0 ? 'high' : 'low'} as well.`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel hud="Correlation matrix" title="How the eight variables move together">
          <div className="overflow-x-auto">
            <div className="grid min-w-[520px] gap-1" style={{ gridTemplateColumns: `86px repeat(${vars.length}, minmax(0,1fr))` }}>
              <div />
              {vars.map((v, c) => (
                <div key={v} className={`pp-num pb-1 text-center text-[10.5px] ${c === j ? 'font-semibold text-[#ffd60a]' : 'text-[#8e93a8]'}`}>
                  {v}
                </div>
              ))}
              {vars.map((rowV, a) => (
                <React.Fragment key={rowV}>
                  <div className={`pp-num flex items-center justify-end pe-2 text-[11px] ${a === i ? 'font-semibold text-[#ffd60a]' : 'text-[#8e93a8]'}`}>{rowV}</div>
                  {vars.map((colV, b) => {
                    const val = Mx[a][b];
                    const on = a === i && b === j;
                    return (
                      <button
                        key={colV}
                        type="button"
                        onClick={() => setSel([a, b])}
                        onMouseEnter={() => setSel([a, b])}
                        aria-label={`${rowV} and ${colV}: ${val.toFixed(2)}`}
                        className={`pp-pop pp-num flex aspect-square cursor-pointer items-center justify-center rounded-[5px] text-[11px] font-semibold transition-[outline,transform] ${
                          on ? 'z-[1] scale-[1.06] outline outline-2 outline-white' : ''
                        }`}
                        style={{
                          background: corrColor(val),
                          color: Math.abs(val) > 0.55 ? '#0b0d14' : '#e8edf7',
                          animationDelay: `${(a + b) * 45}ms`,
                          boxShadow: Math.abs(val) > 0.5 ? `0 0 12px -2px ${corrColor(val)}` : 'none',
                        }}
                      >
                        {val.toFixed(2)}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-[#c9d3e6]">
            <span>−1 opposite</span>
            <div className="h-2.5 flex-1 rounded-full border border-white/15" style={{ background: `linear-gradient(90deg, ${corrColor(-1)}, ${corrColor(-0.5)}, ${corrColor(0)}, ${corrColor(0.5)}, ${corrColor(1)})` }} />
            <span>+1 together</span>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel hud="Selected pair" title={`${vars[i]} × ${vars[j]}`}>
            <div key={key + i + j} className="pp-rise">
              <div className="flex items-baseline gap-3">
                <span className="pp-num text-[38px] font-semibold leading-none" style={{ color: r >= 0 ? '#ffb020' : '#5ab0ff' }}>
                  {r > 0 && i !== j ? '+' : ''}
                  {r.toFixed(2)}
                </span>
                <span className="pp-hud">{i === j ? 'identity' : `${strength} ${r >= 0 ? 'positive' : 'negative'}`}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${Math.abs(r) * 100}%`, background: r >= 0 ? '#ffb020' : '#5ab0ff', transition: 'width 0.4s ease' }} />
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-[#dfe7f5]">{i === j ? generic : (PAIR_NOTES[key] ?? generic)}</p>
              <p className="mt-2 text-[12px] text-[#8e93a8]">
                {VAR[vars[i]].name} · {VAR[vars[j]].name}. Hover or click any cell.
              </p>
            </div>
          </Panel>
          <LayoutGuide
            rows={[
              { name: 'Each row is one variable', text: 'Read across a row to see how that variable relates to every other. The ssrd row shows what moves with sunlight.' },
              { name: 'The diagonal', text: 'A variable against itself, always 1. The table is a mirror image either side of it.' },
            ]}
            cols={[
              { name: 'Each column is the same list', text: 'The cell where a row and column meet is the Pearson correlation of that pair, from −1 (move opposite) through 0 (unrelated) to +1 (move together).' },
              { name: 'Colour', text: 'Amber for positive, blue for negative, dark for none. Brighter means stronger.' },
            ]}
          />
        </div>
      </div>

      <Panel hud="What the figure says">
        <Explain
          read="Look for the bright cells away from the diagonal. A bright block means a group of variables that carry nearly the same information; a dark row means a variable that is independent of the rest."
          why="Correlation guides feature selection. Inputs that duplicate each other add training cost without adding knowledge and can make a model unstable; inputs that are independent of the others are worth keeping even if their own effect is small."
          finding={`The three radiation variables form one tight block (ssrd and fdir at ${Mx[0][1].toFixed(2)}). Temperature is moderately tied to them (${Mx[0][3].toFixed(2)}). Wind and pressure are close to independent of everything else, which makes them cheap, non-redundant inputs. Correlation measures straight-line links only; it understates relationships that have a time lag, like sun and temperature.`}
        />
      </Panel>
    </div>
  );
}
