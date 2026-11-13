'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Navbar, useLanguage } from '@/components/Navbar';
import { runAssessment } from '@/domain/business';
import { normalizePanelTech } from '@/domain/panels';
import {
  Printer,
  Share2,
  Check,
  Activity,
  Box,
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
  Sun,
} from 'lucide-react';

function BusinessReportContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { isAr } = useLanguage();
  const [copied, setCopied] = useState(false);

  const tech = normalizePanelTech(searchParams.get('tech'));
  const lat = Number(searchParams.get('lat') ?? 30.04);
  const lon = Number(searchParams.get('lon') ?? 31.24);
  const area = Number(searchParams.get('area') ?? 45);
  const budget = Number(searchParams.get('budget') ?? 180000);
  const bill = Number(searchParams.get('bill') ?? 2400);

  const assessment = useMemo(
    () =>
      runAssessment({
        tech,
        lat: Number.isNaN(lat) ? 30.04 : lat,
        lon: Number.isNaN(lon) ? 31.24 : lon,
        usableAreaM2: Number.isNaN(area) ? 45 : area,
        budgetEgp: Number.isNaN(budget) ? 180000 : budget,
        monthlyBillEgp: Number.isNaN(bill) ? 2400 : bill,
      }),
    [tech, lat, lon, area, budget, bill]
  );

  const reportId = (params?.id as string) || assessment.id;

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { chosen, site, regionInfo } = assessment;

  return (
    <div className="min-h-screen bg-[#05070f] pb-20 pt-20 text-slate-100">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Top Action Bar */}
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <Link
            href={`/?tech=${chosen.tech}&lat=${site.cellLat}&lon=${site.cellLon}&area=${assessment.input.usableAreaM2}&budget=${assessment.input.budgetEgp}&bill=${assessment.input.monthlyBillEgp}`}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-amber-300"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{isAr ? 'العودة إلى مسار التخطيط' : 'Back to Plan configurator'}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-slate-200 hover:border-amber-400"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copied ? (isAr ? 'تم النسخ!' : 'Copied URL!') : isAr ? 'مشاركة التقرير' : 'Share Report URL'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-slate-200 hover:border-amber-400"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{isAr ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
            </button>

            <Link
              href={`/twin?tech=${chosen.tech}&lat=${site.cellLat}&lon=${site.cellLon}&count=${chosen.panelCount}`}
              className="flex items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/20 px-4 py-1.5 text-xs font-semibold text-teal-200 hover:bg-teal-500/30"
            >
              <Box className="h-3.5 w-3.5" />
              <span>{isAr ? 'معاينة التوأم الرقمي 3D' : 'View in 3D Digital Twin'}</span>
            </Link>

            <Link
              href={`/app/sites/benban-1mw?promoted=1&tech=${chosen.tech}&kwp=${chosen.kWp}&lat=${site.cellLat}&lon=${site.cellLon}`}
              className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>{isAr ? 'ترقية إلى موقع تشغيل (Operate)' : 'Promote to Operate Site →'}</span>
            </Link>
          </div>
        </div>

        {/* Report Header Card */}
        <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-[#0c1126] to-[#070a17] p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-400">
                <Sun className="h-4 w-4" />
                <span>SolarSense Egypt · Engineering & Financial Assessment</span>
              </div>
              <h1 className="mt-2 font-serif text-3xl font-semibold text-white sm:text-4xl">
                {site.anchorName ? `${site.anchorName} · ` : ''}
                {isAr ? regionInfo.nameAr : regionInfo.nameEn} ({regionInfo.code})
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                ERA5 Cell <b>{site.cellLat.toFixed(2)}° N, {site.cellLon.toFixed(2)}° E</b> ·{' '}
                {assessment.input.usableAreaM2} m² Roof · Budget EGP{' '}
                {assessment.input.budgetEgp.toLocaleString()} · Monthly Bill EGP{' '}
                {assessment.input.monthlyBillEgp.toLocaleString()}
              </p>
            </div>

            <div className="text-right text-xs text-slate-400">
              <div>
                Report ID: <span className="font-mono text-slate-200">{reportId}</span>
              </div>
              <div>Date: {assessment.assumptions.date}</div>
              <div className="mt-1 inline-block rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                Simulated Estimate · {assessment.predictionSource}
              </div>
            </div>
          </div>

          {/* 5 Primary KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">System Size</div>
              <div className="mt-1 font-serif text-2xl font-semibold text-white">
                {chosen.kWp} kWp
              </div>
              <div className="text-xs text-slate-400">
                {chosen.panelCount} × {chosen.tech} ({chosen.roofAreaUsedM2} m²)
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Turnkey Cost</div>
              <div className="mt-1 font-serif text-2xl font-semibold text-amber-300">
                EGP {chosen.capexEgp.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">
                Limited by <b className="uppercase text-white">{chosen.bindingLimit}</b>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Annual Yield</div>
              <div className="mt-1 font-serif text-2xl font-semibold text-white">
                {chosen.annualKwh.toLocaleString()} kWh
              </div>
              <div className="text-xs text-teal-300">
                {chosen.specificYield} kWh/kWp · {chosen.billCoveragePct}% bill covered
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Year-1 Saving</div>
              <div className="mt-1 font-serif text-2xl font-semibold text-emerald-300">
                EGP {chosen.annualSavingEgp.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">
                {chosen.co2AvoidedKgYear.toLocaleString()} kg CO₂ avoided/yr
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Payback & NPV</div>
              <div className="mt-1 font-serif text-2xl font-semibold text-amber-300">
                {chosen.simplePaybackYears} yrs
              </div>
              <div className="text-xs text-emerald-300">
                25-yr NPV: EGP {chosen.npv25YrEgp.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Itemized CAPEX & Sensitivity Grid */}
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-5">
              <h2 className="font-serif text-lg font-semibold text-white">
                {isAr ? 'تفصيل التكلفة الرأسمالية (CAPEX)' : 'Itemised System Cost Breakdown'}
              </h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <dt className="text-slate-300">
                    Solar Modules ({chosen.panelCount} × {chosen.tech})
                  </dt>
                  <dd className="font-semibold text-white">
                    EGP {chosen.itemizedCost.panelsEgp.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <dt className="text-slate-300">Grid-Tied / Hybrid Inverter ({chosen.kWp} kWp)</dt>
                  <dd className="font-semibold text-white">
                    EGP {chosen.itemizedCost.inverterEgp.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <dt className="text-slate-300">
                    Anodized Aluminum Tilt Structure ({Math.round(site.cellLat * 0.9)}° South)
                  </dt>
                  <dd className="font-semibold text-white">
                    EGP {chosen.itemizedCost.mountingEgp.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <dt className="text-slate-300">Cabling, DC/AC Protection & Commissioning</dt>
                  <dd className="font-semibold text-white">
                    EGP {chosen.itemizedCost.installationEgp.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between pt-1 text-base font-bold text-amber-300">
                  <dt>Total Installed Turnkey Cost</dt>
                  <dd>EGP {chosen.capexEgp.toLocaleString()}</dd>
                </div>
              </dl>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-teal-300">
                  <TrendingUp className="h-4 w-4" />
                  <span>Sensitivity Analysis (What-If)</span>
                </div>
                <div className="mt-2 space-y-1 text-slate-300">
                  <div>
                    • <b>If +20% Budget:</b> {assessment.sensitivity.plus20PctBudget.panelCount}{' '}
                    panels ({assessment.sensitivity.plus20PctBudget.kWp} kWp) →{' '}
                    {assessment.sensitivity.plus20PctBudget.annualKwh.toLocaleString()} kWh/yr (
                    {assessment.sensitivity.plus20PctBudget.paybackYears} yr payback)
                  </div>
                  <div>
                    • <b>If +10 m² Roof Area:</b> {assessment.sensitivity.plus10M2Area.panelCount}{' '}
                    panels ({assessment.sensitivity.plus10M2Area.kWp} kWp) →{' '}
                    {assessment.sensitivity.plus10M2Area.annualKwh.toLocaleString()} kWh/yr (
                    {assessment.sensitivity.plus10M2Area.paybackYears} yr payback)
                  </div>
                </div>
              </div>
            </div>

            {/* Side-by-Side 3-Technology Comparison */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-7">
              <h2 className="font-serif text-lg font-semibold text-white">
                {isAr
                  ? 'مقارنة التقنيات الثلاث على نفس الموقع'
                  : 'Side-by-Side Comparison of All Three Technologies'}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {isAr ? regionInfo.recommendedReasonAr : regionInfo.recommendedReasonEn}
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/15 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-2 pr-2">Technology</th>
                      <th className="py-2 px-2 text-right">Panels</th>
                      <th className="py-2 px-2 text-right">kWp</th>
                      <th className="py-2 px-2 text-right">CAPEX (EGP)</th>
                      <th className="py-2 px-2 text-right">kWh / yr</th>
                      <th className="py-2 px-2 text-right">Specific Yield</th>
                      <th className="py-2 px-2 text-right">Payback</th>
                      <th className="py-2 pl-2 text-right">25-yr NPV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.allTechnologies.map((r) => {
                      const active = r.tech === chosen.tech;
                      return (
                        <tr
                          key={r.tech}
                          className={`border-b border-white/10 ${
                            active ? 'bg-amber-500/20 font-semibold text-white' : 'text-slate-300'
                          }`}
                        >
                          <td className="py-3 pr-2">
                            {r.nameEn}
                            {r.isRecommendedForRegion && (
                              <span className="ml-1.5 rounded-full bg-teal-500/25 px-2 py-0.5 text-[10px] text-teal-300">
                                Best Fit
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right">{r.panelCount}</td>
                          <td className="py-3 px-2 text-right">{r.kWp.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right">{r.capexEgp.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">{r.annualKwh.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">{r.specificYield} kWh/kWp</td>
                          <td className="py-3 px-2 text-right">{r.simplePaybackYears} yr</td>
                          <td className="py-3 pl-2 text-right text-emerald-300">
                            EGP {r.npv25YrEgp.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 25-year Cumulative Net Cashflow Trajectory */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">
                    25-Year Cumulative Net Cashflow (incl. module degradation & tariff growth)
                  </span>
                  <span className="text-emerald-300">
                    Year 25 Net: +EGP{' '}
                    {assessment.cashflow25Years[24]?.cumulativeNetEgp.toLocaleString()}
                  </span>
                </div>
                <div className="mt-3 flex h-28 items-end gap-1 border-b border-white/15 pb-1">
                  {assessment.cashflow25Years.map((pt) => {
                    const maxNet = Math.max(
                      1,
                      ...assessment.cashflow25Years.map((c) => Math.abs(c.cumulativeNetEgp))
                    );
                    const hPct = Math.max(
                      8,
                      Math.min(100, Math.round((Math.abs(pt.cumulativeNetEgp) / maxNet) * 100))
                    );
                    const positive = pt.cumulativeNetEgp >= 0;
                    return (
                      <div
                        key={pt.year}
                        className="flex-1"
                        title={`Year ${pt.year}: EGP ${pt.cumulativeNetEgp.toLocaleString()}`}
                      >
                        <div
                          className={`w-full rounded-t ${
                            positive ? 'bg-emerald-400/80' : 'bg-rose-400/60'
                          }`}
                          style={{ height: `${hPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>Yr 1 (−CAPEX)</span>
                  <span>Payback (~Yr {chosen.simplePaybackYears})</span>
                  <span>Yr 15</span>
                  <span>Yr 25</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended System Enhancers */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-serif text-lg font-semibold text-white">
              {isAr ? 'التحسينات والمعززات الموصى بها لنظامك' : 'Tailored System Enhancers'}
            </h2>
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {assessment.enhancers.map((enh) => (
                <div
                  key={enh.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      {enh.badgeEn}
                    </span>
                    <span className="font-semibold text-teal-300">{enh.impactMetric}</span>
                  </div>
                  <div className="mt-2 font-serif text-base font-semibold text-white">
                    {enh.titleEn}
                  </div>
                  <p className="mt-1 text-slate-300">{enh.reasonEn}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Honesty & Assumptions Disclosure Footer (Platform Context §10) */}
          <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-500/5 p-4 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <ShieldCheck className="h-4 w-4" />
              <span>Honesty & Assumptions Disclosure ({assessment.assumptions.version})</span>
            </div>
            <p className="mt-1.5 leading-relaxed">
              1. <b>Simulated Estimate:</b> Yield figures are computed from the SolarSense regional
              climatological atlas (ERA5 2020–2026 reanalysis → pvlib physics chain) and
              technology-specific thermal coefficients (γ).
              <br />
              2. <b>Financial Assumptions ({assessment.assumptions.date}):</b> Effective tariff EGP{' '}
              {assessment.assumptions.effectiveTariffEgpPerKwh}/kWh ({assessment.assumptions.tariffSource}
              ), packing factor {assessment.assumptions.packingFactor}, system losses{' '}
              {assessment.assumptions.systemLossesPct}%, discount rate{' '}
              {assessment.assumptions.discountRatePct}%, grid emission factor{' '}
              {assessment.assumptions.gridEmissionFactorKgCo2PerKwh} kg CO₂/kWh. This report is an
              engineering estimate, not a binding commercial quote.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessReportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05070f] p-12 text-slate-300">Loading Engineering Report...</div>}>
      <BusinessReportContent />
    </Suspense>
  );
}
