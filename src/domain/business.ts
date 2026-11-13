// SolarSense Domain: Business Analysis, Sizing & Rule-Based Enhancers
// Implements Platform Context §5.5 and §5.6

import { PANEL_TECHNOLOGIES, PANEL_TECH_LIST } from './panels';
import { predictionProvider } from './providers/predictionProvider';
import { REGIONS, snapToGridCell } from './regions';
import {
  AssessmentInput,
  AssessmentResult,
  BindingLimit,
  EnhancerRecommendation,
  PanelTech,
  SitePoint,
  TechComparisonRow,
} from './types';

export const ECONOMIC_ASSUMPTIONS = {
  version: 'v2026.11-EG-verified',
  date: '2026-11-14',
  tariffSource: 'EgyptERA / EETC 2025–2026 Tiered Tariff Schedule (Tiers 5–7 Residential & Commercial)',
  residentialEffectiveTariffEgp: 2.35, // EgyptERA Tier 6 (651–1,000 kWh) = 2.35 EGP/kWh; Tier 7 (>1,000 kWh) = 2.74–2.89 EGP/kWh
  commercialEffectiveTariffEgp: 2.80, // EgyptERA Commercial LV top bracket (2.74–2.89 EGP/kWh)
  netMeteringExportFactor: 0.85, // EETC net-metering credit ratio
  inverterCostPerKwpEgp: 5200, // String/Hybrid inverter (Huawei / Growatt / GoodWe ~15–18% of turnkey CAPEX)
  mountingCostPerPanelEgp: 1250, // Hot-dip galvanized & anodized Al rooftop racking (~10–12% of turnkey CAPEX)
  fixedInstallationEgp: 14000, // DC/AC protection, SPD, cabling, engineering & net-metering commissioning
  batteryCostPerKwhEgp: 11500, // LiFePO4 rack storage (EGP/kWh)
  gridEmissionFactorKgCo2PerKwh: 0.455, // Egypt NREA / UNFCCC grid emission factor (kg CO2 / kWh)
  discountRatePct: 12.0,
  annualTariffEscalationPct: 10.0,
  packingFactor: 0.72, // Row-to-row inter-row shading & maintenance walkway factor
  systemLossesPct: 12.0, // Soiling, wiring, mismatch & inverter clipping
} as const;

function computeSingleTechRow(params: {
  tech: PanelTech;
  site: SitePoint;
  usableAreaM2: number;
  budgetEgp: number;
  panelCountOverride?: number;
  panelUnitPriceEgpOverride?: number;
  annualDemandKwh: number;
  daytimeSharePct: number;
  effectiveTariffEgp: number;
}): TechComparisonRow {
  const {
    tech,
    site,
    usableAreaM2,
    budgetEgp,
    panelCountOverride,
    panelUnitPriceEgpOverride,
    annualDemandKwh,
    daytimeSharePct,
    effectiveTariffEgp,
  } = params;

  const spec = PANEL_TECHNOLOGIES[tech];
  const regionInfo = REGIONS[site.region];

  // Cost per panel (user's provider price override or market reference price)
  const panelUnitHardwareEgp =
    typeof panelUnitPriceEgpOverride === 'number' && panelUnitPriceEgpOverride > 0
      ? Math.round(panelUnitPriceEgpOverride)
      : Math.round(spec.panelWp * spec.pricePerWpEgp);
  const inverterPerPanelEgp = (spec.panelWp / 1000) * ECONOMIC_ASSUMPTIONS.inverterCostPerKwpEgp;
  const installedVariablePerPanelEgp =
    panelUnitHardwareEgp + inverterPerPanelEgp + ECONOMIC_ASSUMPTIONS.mountingCostPerPanelEgp;

  const panelsByArea = Math.max(
    1,
    Math.floor((usableAreaM2 * ECONOMIC_ASSUMPTIONS.packingFactor) / spec.panelAreaM2)
  );
  const availableVariableBudget = Math.max(0, budgetEgp - ECONOMIC_ASSUMPTIONS.fixedInstallationEgp);
  const panelsByBudget = Math.max(
    0,
    Math.floor(availableVariableBudget / installedVariablePerPanelEgp)
  );

  // Estimate specific yield for 1 kWp to determine panels needed to cover 110% of annual bill
  const unitYield = predictionProvider.yield(site, {
    tech,
    panelCount: 1,
    kWp: 1,
    tiltDeg: Math.round(site.cellLat * 0.9),
    azimuthDeg: 180,
  });
  const kwhPerPanelYear = unitYield.specificYield * (spec.panelWp / 1000);
  const panelsByDemand = Math.max(
    2,
    Math.ceil((annualDemandKwh * 1.1) / Math.max(100, kwhPerPanelYear))
  );

  let panelCount: number;
  let bindingLimit: BindingLimit = 'area';

  if (typeof panelCountOverride === 'number' && panelCountOverride > 0) {
    panelCount = Math.max(1, Math.min(panelsByArea, Math.round(panelCountOverride)));
    if (panelCount >= panelsByArea) {
      bindingLimit = 'area';
    } else if (panelCount >= panelsByDemand) {
      bindingLimit = 'demand';
    } else {
      bindingLimit = 'budget';
    }
  } else {
    panelCount = Math.max(0, Math.min(panelsByArea, panelsByBudget, panelsByDemand));
    if (panelsByBudget < panelsByArea && panelsByBudget <= panelsByDemand) {
      bindingLimit = 'budget';
    } else if (panelsByDemand < panelsByArea && panelsByDemand < panelsByBudget) {
      bindingLimit = 'demand';
    }
  }

  const kWp = Math.round(panelCount * (spec.panelWp / 1000) * 100) / 100;
  const roofAreaUsedM2 = Math.round(panelCount * spec.panelAreaM2 * 10) / 10;

  const panelsEgp = Math.round(panelCount * panelUnitHardwareEgp);
  const inverterEgp = Math.round(kWp * ECONOMIC_ASSUMPTIONS.inverterCostPerKwpEgp);
  const mountingEgp = Math.round(panelCount * ECONOMIC_ASSUMPTIONS.mountingCostPerPanelEgp);
  const installationEgp = panelCount > 0 ? ECONOMIC_ASSUMPTIONS.fixedInstallationEgp : 0;
  const capexEgp = panelsEgp + inverterEgp + mountingEgp + installationEgp;

  const yieldRes = predictionProvider.yield(site, {
    tech,
    panelCount,
    kWp,
    tiltDeg: Math.round(site.cellLat * 0.9),
    azimuthDeg: 180,
  });

  // Self-consumed daytime solar saves full retail tariff; exported surplus earns net-metering rate
  const selfConsumedRatio = Math.min(0.92, Math.max(0.35, daytimeSharePct / 100 + 0.15));
  const blendedRateEgp =
    effectiveTariffEgp * selfConsumedRatio +
    effectiveTariffEgp * ECONOMIC_ASSUMPTIONS.netMeteringExportFactor * (1 - selfConsumedRatio);

  const annualSavingEgp = Math.round(yieldRes.annualKwh * blendedRateEgp);
  const billCoveragePct =
    annualDemandKwh > 0
      ? Math.min(100, Math.round((yieldRes.annualKwh / annualDemandKwh) * 100))
      : 0;
  const simplePaybackYears =
    annualSavingEgp > 0 ? Math.round((capexEgp / annualSavingEgp) * 10) / 10 : 0;

  // 25-year NPV with module degradation & tariff escalation
  let npv = -capexEgp;
  const r = ECONOMIC_ASSUMPTIONS.discountRatePct / 100;
  const g = ECONOMIC_ASSUMPTIONS.annualTariffEscalationPct / 100;
  const d = spec.degradationPctPerYear / 100;

  for (let yr = 1; yr <= 25; yr++) {
    const degradedKwh = yieldRes.annualKwh * Math.pow(1 - d, yr - 1);
    const escalatedRate = blendedRateEgp * Math.pow(1 + g, yr - 1);
    const cashflowYr = degradedKwh * escalatedRate;
    npv += cashflowYr / Math.pow(1 + r, yr);
  }

  const co2AvoidedKgYear = Math.round(
    yieldRes.annualKwh * ECONOMIC_ASSUMPTIONS.gridEmissionFactorKgCo2PerKwh
  );

  return {
    tech,
    nameEn: spec.nameEn,
    nameAr: spec.nameAr,
    panelCount,
    panelUnitPriceEgp: panelUnitHardwareEgp,
    kWp,
    roofAreaUsedM2,
    capexEgp,
    itemizedCost: {
      panelsEgp,
      inverterEgp,
      mountingEgp,
      installationEgp,
    },
    annualKwh: yieldRes.annualKwh,
    monthlyKwh: yieldRes.monthlyKwh,
    specificYield: yieldRes.specificYield,
    performanceRatio: yieldRes.performanceRatio,
    annualSavingEgp,
    billCoveragePct,
    simplePaybackYears,
    npv25YrEgp: Math.round(npv),
    co2AvoidedKgYear,
    bindingLimit,
    isRecommendedForRegion: regionInfo.recommendedTech === tech,
  };
}

export function buildEnhancers(
  site: SitePoint,
  input: AssessmentInput,
  chosen: TechComparisonRow
): EnhancerRecommendation[] {
  const isEveningHeavy = input.daytimeSharePct < 55;
  const isDustRegion =
    site.region === 'western-desert' || site.region === 'nile-valley-upper-egypt';
  const battKwh = Math.max(5, Math.round(chosen.kWp * 1.4));
  const battCost = battKwh * ECONOMIC_ASSUMPTIONS.batteryCostPerKwhEgp;

  return [
    {
      id: 'battery-storage',
      titleEn: `Lithium Battery Storage (${battKwh} kWh LFP)`,
      titleAr: `بطارية تخزين ليثيوم (${battKwh} ك.و.س)`,
      recommended: isEveningHeavy,
      priority: isEveningHeavy ? 'high' : 'medium',
      badgeEn: isEveningHeavy ? 'Recommended · Evening Load' : 'Optional Backup',
      badgeAr: isEveningHeavy ? 'موصى به · أحمال مسائية' : 'احتياطي اختياري',
      reasonEn: `Your daytime use share is ${input.daytimeSharePct}%. A ${battKwh} kWh battery shifts midday solar surplus into peak evening hours (18:00–23:00), boosting self-consumption from ${input.daytimeSharePct}% to ~88%.`,
      reasonAr: `نسبة استهلاكك النهاري ${input.daytimeSharePct}%. بطارية بسعة ${battKwh} ك.و.س تخزن فائض الظهيرة لتغطية ذروة المساء وترفع الاستهلاك الذاتي إلى ~88%.`,
      impactMetric: `+${Math.round(battKwh * 310)} kWh/yr shifted to night`,
      estimatedCostEgp: battCost,
    },
    {
      id: 'load-planner',
      titleEn: 'Forecast-Driven Load Planner (Operate Engine)',
      titleAr: 'مجدول الأحمال الذكي المرتبط بالتنبؤ',
      recommended: true,
      priority: 'high',
      badgeEn: 'Zero Hardware Cost · High ROI',
      badgeAr: 'بدون تكلفة أجهزة · عائد مرتفع',
      reasonEn:
        'Uses SolarSense 1h/6h/24h forecasts to schedule water heaters, agricultural pumps, and AC pre-cooling inside your 10:30–14:30 solar peak window.',
      reasonAr:
        'يستخدم تنبؤات SolarSense لجدولة السخانات والمضخات والتبريد المسبق خلال ذروة التوليد الشمسي (10:30–14:30).',
      impactMetric: '+14–22% direct solar utilization',
      estimatedCostEgp: 0,
    },
    {
      id: 'cleaning-soiling-planner',
      titleEn: 'Khamaseen Dust & Soiling Alert Planner',
      titleAr: 'منبه تنظيف الألواح وموجات الخماسين',
      recommended: isDustRegion,
      priority: isDustRegion ? 'high' : 'medium',
      badgeEn: isDustRegion ? 'Essential for Region' : 'Seasonal Maintenance',
      badgeAr: isDustRegion ? 'ضروري لمنطقتك المناخية' : 'صيانة موسمية',
      reasonEn: isDustRegion
        ? `In ${REGIONS[site.region].nameEn}, spring Khamaseen dust and dry summers cause 6–13% GHI attenuation. Triggers a wash alert only when cumulative dust loss exceeds water/labor cost.`
        : 'Tracks rain resets and aerosol optical depth (AOD) to recommend optimal panel washing intervals.',
      reasonAr:
        'يتتبع تراكم الغبار ورياح الخماسين والأمطار لتنبيهك بموعد الغسيل الأمثل اقتصادياً.',
      impactMetric: `Recovers ~${Math.round(chosen.annualKwh * 0.075)} kWh/yr lost to dust`,
      estimatedCostEgp: 1200,
    },
    {
      id: 'hybrid-inverter',
      titleEn: 'Hybrid Battery-Ready Inverter Upgrade',
      titleAr: 'إنفرتر هجين جاهز للبطاريات مستقبلاً',
      recommended: true,
      priority: 'medium',
      badgeEn: 'Future-Proof',
      badgeAr: 'جاهز للتوسع',
      reasonEn:
        'Allows adding LFP storage later without replacing the inverter, and provides daytime backup power during grid outages.',
      reasonAr: 'يتيح إضافة بطاريات لاحقاً دون تغيير الإنفرتر ويوفر تغذية نهارية عند انقطاع الشبكة.',
      impactMetric: 'Saves ~EGP 22,000 on future storage retrofit',
      estimatedCostEgp: 8500,
    },
    {
      id: 'tilt-advisor',
      titleEn: `Latitude-Tuned Tilt (${Math.round(site.cellLat * 0.9)}° South)`,
      titleAr: `زاوية ميل محسّنة للموقع (${Math.round(site.cellLat * 0.9)}° جنوباً)`,
      recommended: true,
      priority: 'high',
      badgeEn: 'Included in Design',
      badgeAr: 'مضمن في التصميم',
      reasonEn: `At ${site.cellLat.toFixed(2)}° N, a fixed ${Math.round(site.cellLat * 0.9)}° South tilt maximizes annual plane-of-array (POA) irradiance while leaving a 2.4 m north service strip.`,
      reasonAr: `عند خط عرض ${site.cellLat.toFixed(2)}° شمالاً، زاوية ${Math.round(site.cellLat * 0.9)}° جنوباً تعظم الإشعاع السنوي الساقط على المصفوفة.`,
      impactMetric: '+8.4% annual kWh vs flat (5°) mounting',
      estimatedCostEgp: 0,
    },
    {
      id: 'smart-meter-flywheel',
      titleEn: 'Smart Meter & Operate Live Bridge (Data Flywheel)',
      titleAr: 'عداد ذكي وربط مباشر بمنصة التشغيل Operate',
      recommended: true,
      priority: 'high',
      badgeEn: 'Unlocks Pro Forecasting',
      badgeAr: 'يفتح التنبؤ اللحظي',
      reasonEn:
        'Promotes this Plan report into a live Operate site, calibrating our ML models to your real inverter telemetry while contributing to Egypt’s open solar benchmark.',
      reasonAr:
        'يحول هذا التقرير إلى موقع حي في لوحة التحكم لمعايرة نماذج الذكاء الاصطناعي على بيانات إنتاجك الفعلي.',
      impactMetric: 'Cuts site forecast RMSE by ~25% after 30 days',
      estimatedCostEgp: 4500,
    },
  ];
}

export function runAssessment(rawInput: Partial<AssessmentInput>): AssessmentResult {
  const input: AssessmentInput = {
    tech: rawInput.tech || 'pc-Si',
    lat: typeof rawInput.lat === 'number' ? rawInput.lat : 30.04,
    lon: typeof rawInput.lon === 'number' ? rawInput.lon : 31.24,
    usableAreaM2:
      typeof rawInput.usableAreaM2 === 'number'
        ? Math.max(10, Math.min(2000, rawInput.usableAreaM2))
        : 45,
    budgetEgp:
      typeof rawInput.budgetEgp === 'number'
        ? Math.max(40000, Math.min(10000000, rawInput.budgetEgp))
        : 180000,
    panelCount:
      typeof rawInput.panelCount === 'number' && rawInput.panelCount > 0
        ? Math.round(rawInput.panelCount)
        : undefined,
    panelUnitPriceEgp:
      typeof rawInput.panelUnitPriceEgp === 'number' && rawInput.panelUnitPriceEgp > 0
        ? Math.round(rawInput.panelUnitPriceEgp)
        : undefined,
    monthlyBillEgp:
      typeof rawInput.monthlyBillEgp === 'number'
        ? Math.max(300, Math.min(500000, rawInput.monthlyBillEgp))
        : 2400,
    daytimeSharePct:
      typeof rawInput.daytimeSharePct === 'number'
        ? Math.max(15, Math.min(95, rawInput.daytimeSharePct))
        : 45,
    sector: rawInput.sector === 'commercial' ? 'commercial' : 'residential',
  };

  const site = snapToGridCell(input.lat, input.lon);
  const regionInfo = REGIONS[site.region];
  const effectiveTariffEgp =
    input.sector === 'commercial'
      ? ECONOMIC_ASSUMPTIONS.commercialEffectiveTariffEgp
      : ECONOMIC_ASSUMPTIONS.residentialEffectiveTariffEgp;

  const monthlyDemandKwh = Math.round(input.monthlyBillEgp / effectiveTariffEgp);
  const annualDemandKwh = monthlyDemandKwh * 12;

  const allTechnologies = PANEL_TECH_LIST.map((t) =>
    computeSingleTechRow({
      tech: t.key,
      site,
      usableAreaM2: input.usableAreaM2,
      budgetEgp: input.budgetEgp,
      panelCountOverride: input.panelCount,
      panelUnitPriceEgpOverride: t.key === input.tech ? input.panelUnitPriceEgp : undefined,
      annualDemandKwh,
      daytimeSharePct: input.daytimeSharePct,
      effectiveTariffEgp,
    })
  );

  const chosen =
    allTechnologies.find((r) => r.tech === input.tech) || allTechnologies[0];

  // Sensitivity checks (+20% budget, +10 m² area)
  const plusBudgetRow = computeSingleTechRow({
    tech: input.tech,
    site,
    usableAreaM2: input.usableAreaM2,
    budgetEgp: Math.round(input.budgetEgp * 1.2),
    annualDemandKwh,
    daytimeSharePct: input.daytimeSharePct,
    effectiveTariffEgp,
  });

  const plusAreaRow = computeSingleTechRow({
    tech: input.tech,
    site,
    usableAreaM2: input.usableAreaM2 + 10,
    budgetEgp: input.budgetEgp,
    annualDemandKwh,
    daytimeSharePct: input.daytimeSharePct,
    effectiveTariffEgp,
  });

  // 25-year cumulative net cashflow series
  const spec = PANEL_TECHNOLOGIES[chosen.tech];
  const cashflow25Years: { year: number; cumulativeNetEgp: number; annualSavingEgp: number }[] = [];
  let cumulative = -chosen.capexEgp;
  const g = ECONOMIC_ASSUMPTIONS.annualTariffEscalationPct / 100;
  const d = spec.degradationPctPerYear / 100;

  for (let yr = 1; yr <= 25; yr++) {
    const annualSaving = Math.round(
      chosen.annualSavingEgp * Math.pow(1 - d, yr - 1) * Math.pow(1 + g * 0.5, yr - 1)
    );
    cumulative += annualSaving;
    cashflow25Years.push({
      year: yr,
      cumulativeNetEgp: Math.round(cumulative),
      annualSavingEgp: annualSaving,
    });
  }

  const enhancers = buildEnhancers(site, input, chosen);

  // Deterministic report ID encoding key parameters
  const id = `eg-${site.cellId.replace('.', '')}-${chosen.tech.replace(/[^a-zA-Z]/g, '')}-${input.usableAreaM2}m2`;

  return {
    id,
    createdAt: new Date().toISOString(),
    site,
    regionInfo,
    input,
    monthlyDemandKwh,
    chosen,
    allTechnologies,
    sensitivity: {
      plus20PctBudget: {
        panelCount: plusBudgetRow.panelCount,
        kWp: plusBudgetRow.kWp,
        annualKwh: plusBudgetRow.annualKwh,
        paybackYears: plusBudgetRow.simplePaybackYears,
      },
      plus10M2Area: {
        panelCount: plusAreaRow.panelCount,
        kWp: plusAreaRow.kWp,
        annualKwh: plusAreaRow.annualKwh,
        paybackYears: plusAreaRow.simplePaybackYears,
      },
    },
    cashflow25Years,
    enhancers,
    assumptions: {
      version: ECONOMIC_ASSUMPTIONS.version,
      date: ECONOMIC_ASSUMPTIONS.date,
      tariffSource: ECONOMIC_ASSUMPTIONS.tariffSource,
      effectiveTariffEgpPerKwh: effectiveTariffEgp,
      gridEmissionFactorKgCo2PerKwh: ECONOMIC_ASSUMPTIONS.gridEmissionFactorKgCo2PerKwh,
      discountRatePct: ECONOMIC_ASSUMPTIONS.discountRatePct,
      annualTariffEscalationPct: ECONOMIC_ASSUMPTIONS.annualTariffEscalationPct,
      packingFactor: ECONOMIC_ASSUMPTIONS.packingFactor,
      systemLossesPct: ECONOMIC_ASSUMPTIONS.systemLossesPct,
    },
    predictionSource: 'mock-physics-atlas',
  };
}

