'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar, useLanguage } from '@/components/Navbar';
import { PanelThreeViewer } from '@/components/SolarThreeViewers';
import { PANEL_TECHNOLOGIES, PANEL_TECH_LIST } from '@/domain/panels';
import { simulatePvPowerStep } from '@/domain/physics';
import { REGIONS } from '@/domain/regions';
import { PanelTech, SkyCondition } from '@/domain/types';
import { Thermometer, Sun, Zap, ArrowRight } from 'lucide-react';

export default function PanelsTechnologyLabPage() {
  const { isAr } = useLanguage();
  const [selectedTech, setSelectedTech] = useState<PanelTech>('a-Si:H/sc-Si');
  const [ambientTempC, setAmbientTempC] = useState<number>(38);
  const [poaIrradianceWm2, setPoaIrradianceWm2] = useState<number>(950);
  const [windSpeedMs, setWindSpeedMs] = useState<number>(3.5);
  const [skyCondition, setSkyCondition] = useState<SkyCondition>('clear');

  // Compare instantaneous 10 kWp output across all 3 technologies under the user's thermal/irradiance sliders
  const comparison = PANEL_TECH_LIST.map((info) => {
    const sim = simulatePvPowerStep({
      tech: info.key,
      kWp: 10,
      poaWm2: poaIrradianceWm2,
      poaClearWm2: 1000,
      tAmbC: ambientTempC,
      windSpeedMs,
      skyCondition,
    });
    return {
      info,
      sim,
      thermalLossPct: Math.round((1 - sim.tempDerateFactor) * 1000) / 10,
    };
  });

  const activeInfo = PANEL_TECHNOLOGIES[selectedTech];

  return (
    <div className="min-h-screen bg-[#05070f] pb-20 pt-20 text-slate-100">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
              {isAr ? 'مختبر تقنيات الألواح الشمسية ثلاثي الأبعاد' : 'SolarSense 3D Module Physics Lab'}
            </div>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-white sm:text-5xl">
              {isAr
                ? 'لماذا يعتمد اختيار اللوح الأمثل على مكانك في مصر؟'
                : 'Why the best panel depends on where you are in Egypt'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              {isAr
                ? 'في حرارة أسوان والواحات، المعامل الحراري المنخفض (γ) يوفر طاقة حقيقية؛ وعلى أسطح الإسكندرية والقاهرة المحدودة، الكفاءة لكل متر مربع هي العامل الحاسم.'
                : 'In Aswan and Western Desert heat, a low temperature coefficient |γ| preserves real energy; on compact Alexandria and Cairo rooftops, efficiency per m² is decisive.'}
            </p>
          </div>
          <Link
            href={`/?tech=${selectedTech}`}
            className="flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            <span>{isAr ? 'خطط سطحك بهذا اللوح' : `Plan with ${activeInfo.nameEn}`}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Interactive 3D Module Inspector + Selector */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-3xl border border-white/15 bg-[#0a0d1c]/90 p-5 lg:col-span-6">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  {activeInfo.key}
                </span>
                <h2 className="font-serif text-2xl font-semibold text-white">
                  {isAr ? activeInfo.nameAr : activeInfo.nameEn}
                </h2>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {activeInfo.panelWp} Wp · {activeInfo.panelAreaM2} m²
              </span>
            </div>
            <PanelThreeViewer tech={selectedTech} isAr={isAr} heightClass="h-[430px]" />
          </div>

          {/* Interactive Thermal & Irradiance Simulator */}
          <div className="flex flex-col justify-between rounded-3xl border border-white/15 bg-[#0a0d1c]/90 p-6 lg:col-span-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-300">
                <Thermometer className="h-4 w-4" />
                <span>
                  {isAr
                    ? 'محاكي الفقد الحراري الفيزيائي (10 كيلوواط مرجعي)'
                    : 'Live Cell-Temperature Derating Simulator (10 kWp Array)'}
                </span>
              </div>
              <h3 className="mt-1 font-serif text-xl font-semibold text-white">
                {isAr
                  ? 'اختبر أداء التقنيات الثلاث تحت ظروف جوية مصرية قاسية'
                  : 'Test all three technologies under Egyptian heat & dust'}
              </h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Ambient Air Temp (t2m)</span>
                    <b className="text-amber-300">{ambientTempC} °C</b>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={48}
                    step={1}
                    value={ambientTempC}
                    onChange={(e) => setAmbientTempC(Number(e.target.value))}
                    className="mt-2 w-full accent-amber-500"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                    <span>15°C Winter Coast</span>
                    <span>32°C Cairo</span>
                    <span>46°C Aswan Peak</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Plane-of-Array Irradiance (POA)</span>
                    <b className="text-amber-300">{poaIrradianceWm2} W/m²</b>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={1100}
                    step={25}
                    value={poaIrradianceWm2}
                    onChange={(e) => setPoaIrradianceWm2(Number(e.target.value))}
                    className="mt-2 w-full accent-amber-500"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                    <span>200 W/m² Haze</span>
                    <span>650 W/m²</span>
                    <span>1050 W/m² Desert Noon</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5 text-xs">
                  {(['clear', 'dust', 'cloud', 'heatwave'] as SkyCondition[]).map((sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => setSkyCondition(sk)}
                      className={`rounded-full px-3 py-1 capitalize transition ${
                        skyCondition === sk
                          ? 'bg-teal-500 font-semibold text-slate-950'
                          : 'border border-white/15 bg-white/5 text-slate-300'
                      }`}
                    >
                      {sk === 'dust' ? 'Khamaseen Dust' : sk}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Wind: {windSpeedMs} m/s</span>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={windSpeedMs}
                    onChange={(e) => setWindSpeedMs(Number(e.target.value))}
                    className="w-24 accent-teal-400"
                  />
                </div>
              </div>

              {/* Live Output Bars for the 3 Technologies */}
              <div className="mt-5 space-y-3">
                {comparison.map(({ info, sim, thermalLossPct }) => {
                  const isSel = info.key === selectedTech;
                  return (
                    <div
                      key={info.key}
                      onClick={() => setSelectedTech(info.key)}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        isSel
                          ? 'border-amber-400 bg-amber-500/15'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-serif text-lg font-semibold text-white">
                            {isAr ? info.nameAr : info.nameEn}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">
                            (γ = {info.tempCoeffPctPerC}%/°C)
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-rose-300">
                            Cell: <b>{sim.tCellC}°C</b> (−{thermalLossPct}% heat loss)
                          </span>
                          <span className="rounded-full bg-amber-500/25 px-3 py-1 font-serif text-base font-bold text-amber-300">
                            {sim.pAcKw.toFixed(2)} kW AC
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-teal-400 transition-all"
                          style={{ width: `${Math.min(100, (sim.pAcKw / 10) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-3 font-mono text-xs text-slate-400">
              Formula: P_dc = P_dc0 · (POA / 1000) · [1 + γ · (T_cell - 25)], with Faiman cell temperature T_cell = T_amb + POA / (U0 + U1 · WS_10).
            </div>
          </div>
        </div>

        {/* Regional Technology Matrix */}
        <div className="mt-8 rounded-3xl border border-white/15 bg-[#0a0d1c]/90 p-6">
          <h2 className="font-serif text-2xl font-semibold text-white">
            {isAr
              ? 'اللوح الموصى به لكل إقليم مناخي في مصر'
              : 'Recommended Technology by Egyptian Climate Region'}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.values(REGIONS).map((reg) => (
              <div
                key={reg.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-xs font-bold text-teal-300">
                    {reg.code}
                  </span>
                  <span className="text-xs text-amber-300 font-semibold">
                    Winner: {reg.recommendedTech}
                  </span>
                </div>
                <h3 className="mt-2 font-serif text-lg font-semibold text-white">
                  {isAr ? reg.nameAr : reg.nameEn}
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  {isAr ? reg.recommendedReasonAr : reg.recommendedReasonEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
