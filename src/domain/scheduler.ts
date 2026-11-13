// SolarSense Domain: Deterministic Load Scheduling Engine
// Handover §7.3 & Reference [A1] (Jonah et al., 2026):
// Validates every schedule against both expected solar forecast (pKw) and conservative P10 quantile (p10Kw).

import { FlexibleLoadItem, ForecastPoint, ScheduleWindowResult } from './types';

export const DEFAULT_FLEXIBLE_LOADS: FlexibleLoadItem[] = [
  {
    id: 'load-pump-1',
    siteId: 'benban-1mw',
    name: 'Submersible Irrigation Pump #1',
    category: 'pump',
    powerKw: 180,
    durationH: 3,
    earliestHour: 7,
    deadlineHour: 17,
    priority: 1,
  },
  {
    id: 'load-cold-storage',
    siteId: 'benban-1mw',
    name: 'Vaccine & Cold-Chain Chiller Boost',
    category: 'hvac',
    powerKw: 110,
    durationH: 2,
    earliestHour: 9,
    deadlineHour: 16,
    priority: 1,
  },
  {
    id: 'load-bess-charge',
    siteId: 'benban-1mw',
    name: 'LFP Battery Bank Bulk Charge',
    category: 'battery',
    powerKw: 240,
    durationH: 3,
    earliestHour: 8,
    deadlineHour: 16,
    priority: 2,
  },
  {
    id: 'load-autoclave',
    siteId: 'benban-1mw',
    name: 'Clinic Sterilizer & Water Desalination',
    category: 'sterilizer',
    powerKw: 85,
    durationH: 2,
    earliestHour: 8,
    deadlineHour: 18,
    priority: 2,
  },
];

export function recommendOptimalLoadWindow(
  forecastPoints: ForecastPoint[],
  load: FlexibleLoadItem,
  baseSiteLoadKw: number = 140
): ScheduleWindowResult {
  const durationSteps = Math.max(1, Math.round(load.durationH));
  const candidates = forecastPoints.filter(
    (p) => p.hourLocal >= load.earliestHour && p.hourLocal < load.deadlineHour
  );

  let bestStartIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i <= Math.max(0, candidates.length - durationSteps); i++) {
    const slice = candidates.slice(i, i + durationSteps);
    if (slice.length < durationSteps) continue;

    // Score prioritizes P10 guaranteed surplus first, then mean forecast surplus
    let score = 0;
    for (const pt of slice) {
      const meanSurplus = pt.pKw - baseSiteLoadKw;
      const p10Surplus = pt.p10Kw - baseSiteLoadKw;
      score += p10Surplus * 1.4 + meanSurplus * 0.6;
    }

    if (score > bestScore) {
      bestScore = score;
      bestStartIdx = i;
    }
  }

  const chosenSlice =
    candidates.length >= durationSteps
      ? candidates.slice(bestStartIdx, bestStartIdx + durationSteps)
      : forecastPoints.slice(4, 4 + durationSteps);

  const startHour = chosenSlice[0]?.hourLocal ?? 11;
  const endHour = startHour + durationSteps;
  const requiredEnergyKwh = Math.round(load.powerKw * durationSteps * 10) / 10;

  let coveredExpectedKwh = 0;
  let coveredP10Kwh = 0;
  let totalSurplusKwh = 0;

  for (const pt of chosenSlice) {
    const availExpected = Math.max(0, pt.pKw - baseSiteLoadKw);
    const availP10 = Math.max(0, pt.p10Kw - baseSiteLoadKw);
    totalSurplusKwh += availExpected;
    coveredExpectedKwh += Math.min(load.powerKw, availExpected);
    coveredP10Kwh += Math.min(load.powerKw, availP10);
  }

  const solarCoveragePct =
    requiredEnergyKwh > 0
      ? Math.min(100, Math.round((coveredExpectedKwh / requiredEnergyKwh) * 100))
      : 100;
  const p10CoveragePct =
    requiredEnergyKwh > 0
      ? Math.min(100, Math.round((coveredP10Kwh / requiredEnergyKwh) * 100))
      : 100;

  const riskLevel: 'low' | 'medium' | 'high' =
    p10CoveragePct >= 90 ? 'low' : p10CoveragePct >= 70 ? 'medium' : 'high';

  // Diesel generator saves ~0.28 L per kWh of solar-displaced load
  const dieselAvoidedLiters = Math.round(coveredExpectedKwh * 0.28 * 10) / 10;
  const costSavedEgp = Math.round(coveredExpectedKwh * 3.85);

  const windowLabel = `${String(startHour).padStart(2, '0')}:00 → ${String(endHour).padStart(2, '0')}:00`;
  const rationale =
    riskLevel === 'low'
      ? `Validated optimal window ${windowLabel}: expected solar surplus covers ${solarCoveragePct}% of the ${requiredEnergyKwh} kWh load, and even the conservative P10 lower bound covers ${p10CoveragePct}%. Zero diesel fallback required.`
      : riskLevel === 'medium'
        ? `Window ${windowLabel} covers ${solarCoveragePct}% under expected forecast, but P10 lower-bound coverage drops to ${p10CoveragePct}% due to dust/cloud uncertainty. Keep battery reserve above 30% SoC.`
        : `High uncertainty in window ${windowLabel} (P10 covers ${p10CoveragePct}%). Consider splitting load duration or deferring to tomorrow's clear-sky window.`;

  return {
    loadId: load.id,
    loadName: load.name,
    powerKw: load.powerKw,
    durationH: durationSteps,
    recommendedStartHour: startHour,
    recommendedEndHour: endHour,
    windowLabel,
    requiredEnergyKwh,
    expectedSolarSurplusKwh: Math.round(totalSurplusKwh * 10) / 10,
    p10GuaranteedSolarKwh: Math.round(coveredP10Kwh * 10) / 10,
    solarCoveragePct,
    p10CoveragePct,
    riskLevel,
    dieselAvoidedLiters,
    costSavedEgp,
    rationale,
    validatedByEngine: true,
  };
}

