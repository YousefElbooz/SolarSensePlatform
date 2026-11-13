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
} from 'lucide-react';

function BusinessReportContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { isAr } = useLanguage();
  const [copied, setCopied] = useState(false);

  const tech = normalizePanelTech(searchParams.get('tech'));
  const lat = Number(searchParams.get('lat') ?? 30.04);
  const lon = Number(searchParams.get('lon') ?? 31.24);
  const area = Number(searchParams.get('area') ?? 40);
  const panels = Number(searchParams.get('panels') ?? 0);
  const panelPrice = Number(searchParams.get('panelPrice') ?? 0);
  const budget = Number(searchParams.get('budget') ?? 180000);
  const bill = Number(searchParams.get('bill') ?? 2400);

  const assessment = useMemo(
    () =>
      runAssessment({
        tech,
        lat: Number.isNaN(lat) ? 30.04 : lat,
        lon: Number.isNaN(lon) ? 31.24 : lon,
        usableAreaM2: Number.isNaN(area) ? 40 : area,
        panelCount: !Number.isNaN(panels) && panels > 0 ? panels : undefined,
        panelUnitPriceEgp: !Number.isNaN(panelPrice) && panelPrice > 0 ? panelPrice : undefined,
        budgetEgp: Number.isNaN(budget) ? 180000 : budget,
        monthlyBillEgp: Number.isNaN(bill) ? 2400 : bill,
      }),
    [tech, lat, lon, area, panels, panelPrice, budget, bill]
  );

  const reportId = (params?.id as string) || assessment.id;

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { chosen, site, regionInfo } = assessment;

  return (
    <div className="cinematic-page pb-20 pt-8">
      <Navbar clockLabel="17:00 · Financial Report" />

      <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
        {/* Top Action Bar */}
        <div className="no-print glass mb-6 flex flex-wrap items-center justify-between gap-3 py-3 px-4">
          <Link
            href={`/?tech=${chosen.tech}&lat=${site.cellLat}&lon=${site.cellLon}&area=${assessment.input.usableAreaM2}&budget=${assessment.input.budgetEgp}&bill=${assessment.input.monthlyBillEgp}`}
            className="flex items-center gap-1.5 text-xs font-medium text-[#b9bdcf] hover:text-[#ffd166]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{isAr ? 'العودة إلى مسار الشمس' : 'Back to Day Arc planner'}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={handleCopy} className="btn-pill py-1.5 px-3.5 text-xs">
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[#3fc1c1]" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              <span>
                {copied
                  ? isAr
                    ? 'تم النسخ!'
                    : 'Copied URL!'
                  : isAr
                    ? 'مشاركة التقرير'
                    : 'Share Report URL'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="btn-pill py-1.5 px-3.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{isAr ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
            </button>

            <Link
              href={`/twin?tech=${chosen.tech}&lat=${site.cellLat}&lon=${site.cellLon}&count=${chosen.panelCount}`}
              className="btn-pill py-1.5 px-3.5 text-xs"
            >
              <Box className="h-3.5 w-3.5 text-[#3fc1c1]" />
              <span>{isAr ? 'معاينة التوأم الرقمي 3D' : 'View in 3D Digital Twin'}</span>
            </Link>

            <Link
              href={`/app/sites/benban-1mw?promoted=1&tech=${chosen.tech}&kwp=${chosen.kWp}&lat=${site.cellLat}&lon=${site.cellLon}`}
              className="btn-pill-primary py-1.5 px-4 text-xs"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>{isAr ? 'ترقية إلى موقع تشغيل (Operate)' : 'Promote to Operate Site →'}</span>
            </Link>
          </div>
        </div>

        {/* Report Header Card */}
        <div className="glass p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.14] pb-6">
            <div>
              <div className="eyebrow">
                SolarSense Egypt · Engineering &amp; Financial Assessment
              </div>
              <h1 className="cinematic-h2 mt-2">
                {site.anchorName ? `${site.anchorName} · ` : ''}
                {isAr ? regionInfo.nameAr : regionInfo.nameEn} ({regionInfo.code})
              </h1>
              <p className="mt-1.5 text-sm text-[#b9bdcf]">
                ERA5 Cell <b>{site.cellLat.toFixed(2)}° N, {site.cellLon.toFixed(2)}° E</b> ·{' '}
                {assessment.input.usableAreaM2} m² Roof · Budget EGP{' '}
                {assessment.input.budgetEgp.toLocaleString('en-US')}
              </p>
            </div>

            <div className="text-right font-mono text-xs text-[#b9bdcf]">
              <div>
                Report ID: <span className="text-white">{reportId}</span>
              </div>
              <div>Date: {assessment.assumptions.date}</div>
              <div className="mt-1.5">
                <span className="tag-pill">Simulated Estimate · {assessment.predictionSource}</span>
              </div>
            </div>
          </div>

          {/* 5 Primary KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-5">
            <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                System Size
              </div>
              <div className="mt-1 font-serif text-2xl font-semibold text-white">
                {chosen.kWp.toFixed(2)} kWp
              </div>
              <div className="text-xs text-[#b9bdcf]">
                {chosen.panelCount} × {chosen.tech} ({chosen.roofAreaUsedM2} m²)
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                Turnkey Cost
              </div>
              <div className="mt-1 font-serif text-2xl font-semibold text-[#ffd166]">
                EGP {chosen.capexEgp.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-[#b9bdcf]">
                Limited by <b className="uppercase text-white">{chosen.bindingLimit}</b>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                Annual Yield
              </div>
              <div className="mt-1 font-serif text-2xl font-semibold text-white">
                {chosen.annualKwh.toLocaleString('en-US')} kWh
              </div>
              <div className="text-xs text-[#9fe9e9]">
                {chosen.specificYield} kWh/kWp · {chosen.billCoveragePct}% bill covered
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                Year-1 Saving
              </div>
              <div className="mt-1 font-serif text-2xl font-semibold text-[#9fe9e9]">
                EGP {chosen.annualSavingEgp.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-[#b9bdcf]">
                {chosen.co2AvoidedKgYear.toLocaleString('en-US')} kg CO₂ avoided/yr
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                Payback &amp; NPV
              </div>
              <div className="mt-1 font-serif text-2xl font-semibold text-[#ffd166]">
                {chosen.simplePaybackYears} yrs
              </div>
              <div className="text-xs text-[#9fe9e9]">
                25-yr NPV: EGP {chosen.npv25YrEgp.toLocaleString('en-US')}
              </div>
            </div>
          </div>

          {/* Itemized CAPEX & Side-by-Side Comparison */}
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-5 lg:col-span-5">
              <h2 className="font-serif text-lg font-semibold text-white">
                {isAr ? 'تفصيل التكلفة الرأسمالية (CAPEX)' : 'Itemised System Cost Breakdown'}
              </h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between border-b border-white/[0.1] pb-2">
                  <dt className="text-[#b9bdcf]">
                    Solar Modules ({chosen.panelCount} × {chosen.tech})
                  </dt>
                  <dd className="font-mono font-semibold text-white">
                    EGP {chosen.itemizedCost.panelsEgp.toLocaleString('en-US')}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-white/[0.1] pb-2">
                  <dt className="text-[#b9bdcf]">Grid-Tied / Hybrid Inverter ({chosen.kWp} kWp)</dt>
                  <dd className="font-mono font-semibold text-white">
                    EGP {chosen.itemizedCost.inverterEgp.toLocaleString('en-US')}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-white/[0.1] pb-2">
                  <dt className="text-[#b9bdcf]">
                    Anodized Aluminum Tilt Structure ({Math.round(site.cellLat * 0.9)}° South)
                  </dt>
                  <dd className="font-mono font-semibold text-white">
                    EGP {chosen.itemizedCost.mountingEgp.toLocaleString('en-US')}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-white/[0.1] pb-2">
                  <dt className="text-[#b9bdcf]">Cabling, DC/AC Protection &amp; Commissioning</dt>
                  <dd className="font-mono font-semibold text-white">
                    EGP {chosen.itemizedCost.installationEgp.toLocaleString('en-US')}
                  </dd>
                </div>
                <div className="flex justify-between pt-1 text-base font-bold text-[#ffd166]">
                  <dt>Total Installed Turnkey Cost</dt>
                  <dd className="font-mono">EGP {chosen.capexEgp.toLocaleString('en-US')}</dd>
                </div>
              </dl>

              <div className="mt-5 rounded-xl border border-white/[0.12] bg-white/[0.04] p-3.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-[#9fe9e9]">
                  <TrendingUp className="h-4 w-4" />
                  <span>Sensitivity Analysis (What-If)</span>
                </div>
                <div className="mt-2 space-y-1 text-[#b9bdcf]">
                  <div>
                    • <b className="text-white">If +20% Budget:</b>{' '}
                    {assessment.sensitivity.plus20PctBudget.panelCount} panels (
                    {assessment.sensitivity.plus20PctBudget.kWp} kWp) →{' '}
                    {assessment.sensitivity.plus20PctBudget.annualKwh.toLocaleString('en-US')}{' '}
                    kWh/yr ({assessment.sensitivity.plus20PctBudget.paybackYears} yr payback)
                  </div>
                  <div>
                    • <b className="text-white">If +10 m² Roof Area:</b>{' '}
                    {assessment.sensitivity.plus10M2Area.panelCount} panels (
                    {assessment.sensitivity.plus10M2Area.kWp} kWp) →{' '}
                    {assessment.sensitivity.plus10M2Area.annualKwh.toLocaleString('en-US')} kWh/yr (
                    {assessment.sensitivity.plus10M2Area.paybackYears} yr payback)
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.14] bg-white/[0.03] p-5 lg:col-span-7">
              <h2 className="font-serif text-lg font-semibold text-white">
                {isAr
                  ? 'مقارنة التقنيات الثلاث على نفس الموقع'
                  : 'Side-by-Side Comparison of All Three Technologies'}
              </h2>
              <p className="mt-1 text-xs text-[#b9bdcf]">
                {isAr ? regionInfo.recommendedReasonAr : regionInfo.recommendedReasonEn}
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.16] font-mono text-[11px] uppercase tracking-wider text-[#b9bdcf]">
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
                          className={`border-b border-white/[0.1] ${
                            active
                              ? 'bg-[#f5a524]/20 font-semibold text-white'
                              : 'text-[#b9bdcf]'
                          }`}
                        >
                          <td className="py-3 pr-2">
                            {r.nameEn}
                            {r.isRecommendedForRegion && (
                              <span className="ml-1.5 tag-pill live">Best Fit</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-mono">{r.panelCount}</td>
                          <td className="py-3 px-2 text-right font-mono">{r.kWp.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right font-mono">
                            {r.capexEgp.toLocaleString('en-US')}
                          </td>
                          <td className="py-3 px-2 text-right font-mono">
                            {r.annualKwh.toLocaleString('en-US')}
                          </td>
                          <td className="py-3 px-2 text-right font-mono">
                            {r.specificYield} kWh/kWp
                          </td>
                          <td className="py-3 px-2 text-right font-mono">
                            {r.simplePaybackYears} yr
                          </td>
                          <td className="py-3 pl-2 text-right font-mono text-[#9fe9e9]">
                            EGP {r.npv25YrEgp.toLocaleString('en-US')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 25-year Cumulative Net Cashflow Trajectory */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-[#b9bdcf]">
                  <span className="font-semibold text-white">
                    25-Year Cumulative Net Cashflow (incl. module degradation &amp; tariff growth)
                  </span>
                  <span className="font-mono text-[#9fe9e9]">
                    Year 25 Net: +EGP{' '}
                    {assessment.cashflow25Years[24]?.cumulativeNetEgp.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="mt-3 flex h-28 items-end gap-1 border-b border-white/[0.14] pb-1">
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
                        title={`Year ${pt.year}: EGP ${pt.cumulativeNetEgp.toLocaleString('en-US')}`}
                      >
                        <div
                          className={`w-full rounded-t ${
                            positive ? 'bg-[#3fc1c1]/85' : 'bg-[#f5a524]/55'
                          }`}
                          style={{ height: `${hPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-[#b9bdcf]">
                  <span>Yr 1 (−CAPEX)</span>
                  <span>Payback (~Yr {chosen.simplePaybackYears})</span>
                  <span>Yr 15</span>
                  <span>Yr 25</span>
                </div>
              </div>
            </div>
          </div>

          {/* Honesty & Assumptions Disclosure Footer */}
          <div className="mt-6 rounded-2xl border border-[#ffd166]/25 bg-[#f5a524]/[0.06] p-4 text-xs text-[#b9bdcf]">
            <div className="flex items-center gap-2 font-semibold text-[#ffd166]">
              <ShieldCheck className="h-4 w-4" />
              <span>Honesty &amp; Assumptions Disclosure ({assessment.assumptions.version})</span>
            </div>
            <p className="mt-1.5 leading-relaxed">
              1. <b className="text-white">Simulated Estimate:</b> Yield figures are computed from
              the SolarSense regional climatological atlas (ERA5 2020–2026 reanalysis → pvlib
              physics chain) and technology-specific thermal coefficients (γ).
              <br />
              2. <b className="text-white">Financial Assumptions ({assessment.assumptions.date}):</b>{' '}
              Effective tariff EGP {assessment.assumptions.effectiveTariffEgpPerKwh}/kWh (
              {assessment.assumptions.tariffSource}), packing factor{' '}
              {assessment.assumptions.packingFactor}, system losses{' '}
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
    <Suspense
      fallback={
        <div className="cinematic-page p-12 text-[#b9bdcf]">Loading Engineering Report...</div>
      }
    >
      <BusinessReportContent />
    </Suspense>
  );
}
