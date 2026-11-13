'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { Navbar, useLanguage } from '@/components/Navbar';
import { PanelThreeViewer } from '@/components/SolarThreeViewers';
import { PANEL_TECHNOLOGIES, PANEL_TECH_LIST } from '@/domain/panels';
import { simulatePvPowerStep } from '@/domain/physics';
import { REGIONS } from '@/domain/regions';
import { PanelTech, SkyCondition } from '@/domain/types';
import { Thermometer, ArrowRight } from 'lucide-react';

export default function PanelsTechnologyLabPage() {
  const { isAr } = useLanguage();
  const [selectedTech, setSelectedTech] = useState<PanelTech>('a-Si:H/sc-Si');
  const [ambientTempC, setAmbientTempC] = useState<number>(38);
  const [poaIrradianceWm2, setPoaIrradianceWm2] = useState<number>(950);
  const [windSpeedMs, setWindSpeedMs] = useState<number>(3.5);
  const [skyCondition, setSkyCondition] = useState<SkyCondition>('clear');
  const barsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!barsRef.current) return;
    const fills = barsRef.current.querySelectorAll('[data-bar-fill]');
    fills.forEach((el) => {
      const targetW = (el as HTMLElement).dataset.targetWidth || '50%';
      gsap.to(el, { width: targetW, duration: 0.55, ease: 'power3.out', overwrite: 'auto' });
    });
  }, [ambientTempC, poaIrradianceWm2, windSpeedMs, skyCondition, selectedTech]);

  return (
    <div className="cinematic-page pb-20 pt-8">
      <Navbar clockLabel="09:30 · 3D Module Lab" />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">
              {isAr ? 'مختبر تقنيات الألواح الشمسية ثلاثي الأبعاد' : 'Mid-morning · 3D Module Physics Lab'}
            </div>
            <h1 className="cinematic-h2 mt-2.5">
              {isAr
                ? 'لماذا يعتمد اختيار اللوح الأمثل على مكانك في مصر؟'
                : 'Why the best panel depends on where you are in Egypt'}
            </h1>
            <p className="cinematic-lede mt-2">
              {isAr
                ? 'في حرارة أسوان والواحات، المعامل الحراري المنخفض (γ) يوفر طاقة حقيقية؛ وعلى أسطح الإسكندرية والقاهرة المحدودة، الكفاءة لكل متر مربع هي العامل الحاسم.'
                : 'In Aswan and Western Desert heat, a low temperature coefficient |γ| preserves real energy; on compact Alexandria and Cairo rooftops, efficiency per m² is decisive.'}
            </p>
          </div>
          <Link href={`/?tech=${selectedTech}`} className="btn-pill-primary">
            <span>{isAr ? 'خطط سطحك بهذا اللوح' : `Plan with ${activeInfo.nameEn}`}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Interactive 3D Module Inspector + Thermal Simulator */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="glass flex flex-col justify-between lg:col-span-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="tag-pill">{activeInfo.key}</span>
                <h2 className="mt-1.5 font-serif text-2xl font-semibold text-white">
                  {isAr ? activeInfo.nameAr : activeInfo.nameEn}
                </h2>
              </div>
              <span className="font-mono text-xs text-[#b9bdcf]">
                {activeInfo.panelWp} Wp · {activeInfo.panelAreaM2} m²
              </span>
            </div>
            <PanelThreeViewer tech={selectedTech} isAr={isAr} heightClass="h-[410px]" />
          </div>

          <div className="glass flex flex-col justify-between lg:col-span-7">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-[#9fe9e9]">
                <Thermometer className="h-4 w-4 text-[#3fc1c1]" />
                <span>
                  {isAr
                    ? 'محاكي الفقد الحراري الفيزيائي (10 كيلوواط مرجعي)'
                    : 'Live Cell-Temperature Derating Simulator (10 kWp Array)'}
                </span>
              </div>
              <h3 className="mt-1.5 font-serif text-2xl font-semibold text-white">
                {isAr
                  ? 'اختبر أداء التقنيات الثلاث تحت ظروف جوية مصرية قاسية'
                  : 'Test all three technologies under Egyptian heat & dust'}
              </h3>

              <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#b9bdcf]">Ambient Air Temp (t2m)</span>
                    <b className="font-mono text-[#ffd166]">{ambientTempC} °C</b>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={48}
                    step={1}
                    value={ambientTempC}
                    onChange={(e) => setAmbientTempC(Number(e.target.value))}
                    className="mt-2 w-full"
                  />
                  <div className="mt-1 flex justify-between font-mono text-[10px] text-[#b9bdcf]">
                    <span>15°C Coast</span>
                    <span>32°C Cairo</span>
                    <span>46°C Aswan</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-3.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#b9bdcf]">Plane-of-Array Irradiance (POA)</span>
                    <b className="font-mono text-[#ffd166]">{poaIrradianceWm2} W/m²</b>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={1100}
                    step={25}
                    value={poaIrradianceWm2}
                    onChange={(e) => setPoaIrradianceWm2(Number(e.target.value))}
                    className="mt-2 w-full"
                  />
                  <div className="mt-1 flex justify-between font-mono text-[10px] text-[#b9bdcf]">
                    <span>200 W/m² Haze</span>
                    <span>650 W/m²</span>
                    <span>1050 W/m² Noon</span>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="apple-segmented flex-wrap" role="group" aria-label="Sky Condition">
                  {(['clear', 'dust', 'cloud', 'heatwave'] as SkyCondition[]).map((sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => setSkyCondition(sk)}
                      className={`apple-segment-btn text-xs capitalize ${
                        skyCondition === sk ? 'active' : ''
                      }`}
                    >
                      {sk === 'dust' ? 'Khamaseen Dust' : sk}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-[#b9bdcf]">
                  <span>Wind: {windSpeedMs} m/s</span>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={windSpeedMs}
                    onChange={(e) => setWindSpeedMs(Number(e.target.value))}
                    className="w-24"
                  />
                </div>
              </div>

              {/* Live Output Bars for the 3 Technologies */}
              <div ref={barsRef} className="mt-5 space-y-3">
                {comparison.map(({ info, sim, thermalLossPct }) => {
                  const isSel = info.key === selectedTech;
                  const pctWidth = `${Math.min(100, (sim.pAcKw / 10) * 100)}%`;
                  return (
                    <div
                      key={info.key}
                      onClick={() => setSelectedTech(info.key)}
                      className={`glass-interactive cursor-pointer p-4 ${
                        isSel ? 'glass-selected' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-serif text-lg font-semibold text-white">
                            {isAr ? info.nameAr : info.nameEn}
                          </span>
                          <span className="ml-2 font-mono text-xs text-[#b9bdcf]">
                            (γ = {info.tempCoeffPctPerC}%/°C)
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-mono text-[#ffd166]">
                            Cell: <b>{sim.tCellC}°C</b> (−{thermalLossPct}% heat loss)
                          </span>
                          <span className="tag-pill font-serif text-sm font-semibold">
                            {sim.pAcKw.toFixed(2)} kW AC
                          </span>
                        </div>
                      </div>
                      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          data-bar-fill
                          data-target-width={pctWidth}
                          className="h-full rounded-full bg-gradient-to-r from-[#f5a524] to-[#3fc1c1]"
                          style={{ width: pctWidth }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 border-t border-white/[0.14] pt-3 font-mono text-xs text-[#b9bdcf]">
              Formula: P_dc = P_dc0 · (POA / 1000) · [1 + γ · (T_cell - 25)], with Faiman cell temperature T_cell = T_amb + POA / (U0 + U1 · WS_10).
            </div>
          </div>
        </div>

        {/* Regional Technology Matrix */}
        <div className="glass mt-6">
          <div className="eyebrow">Regional Fit Matrix</div>
          <h2 className="mt-1.5 font-serif text-2xl font-semibold text-white">
            {isAr
              ? 'اللوح الموصى به لكل إقليم مناخي في مصر'
              : 'Recommended Technology by Egyptian Climate Region'}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.values(REGIONS).map((reg) => (
              <div
                key={reg.id}
                className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="tag-pill live">{reg.code}</span>
                  <span className="font-mono text-xs font-semibold text-[#ffd166]">
                    {reg.recommendedTech}
                  </span>
                </div>
                <h3 className="mt-2.5 font-serif text-lg font-semibold text-white">
                  {isAr ? reg.nameAr : reg.nameEn}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#b9bdcf]">
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
