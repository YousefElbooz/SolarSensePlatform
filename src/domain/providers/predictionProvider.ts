// SolarSense Domain: PredictionProvider Interface (Forecast + Yield Atlas)
// Platform Context §5.4: Two different numbers, two different sources:
// 1. Short-term forecast (1h / 6h / 24h with P10-P90 band)
// 2. Long-term climatological yield atlas (monthly kWh/kWp per region × technology)

import { PANEL_TECHNOLOGIES } from '../panels';
import { computeSolarPosition, simulateIrradianceAndPoa, simulatePvPowerStep } from '../physics';
import {
  ForecastPoint,
  ForecastResult,
  PanelTech,
  RegionId,
  SitePoint,
  SkyCondition,
  SystemSpec,
  YieldResult,
} from '../types';

export interface PredictionProvider {
  forecast(params: {
    site: SitePoint;
    system: SystemSpec;
    horizonH?: 1 | 6 | 24;
    mode?: 'replay' | 'live';
    skyCondition?: SkyCondition;
    dayOfYear?: number;
  }): ForecastResult;

  yield(site: SitePoint, system: SystemSpec): YieldResult;
}

// Baseline monthly specific yield (kWh / kWp) per region before technology thermal adjustment
const REGIONAL_MONTHLY_BASE_YIELD: Record<RegionId, number[]> = {
  'north-coast-delta': [112, 124, 156, 174, 192, 198, 195, 186, 164, 142, 118, 106], // ~1,867 kWh/kWp
  'western-desert': [144, 156, 184, 198, 212, 216, 214, 206, 188, 168, 148, 138], // ~2,172 kWh/kWp
  'sinai-red-sea': [136, 148, 176, 190, 204, 208, 205, 198, 180, 160, 140, 130], // ~2,075 kWh/kWp
  'nile-valley-upper-egypt': [142, 154, 182, 196, 208, 212, 210, 204, 186, 166, 146, 136], // ~2,142 kWh/kWp
};

// Average daytime ambient temperatures (°C) by month per region
const REGIONAL_MONTHLY_TEMP_C: Record<RegionId, number[]> = {
  'north-coast-delta': [17, 18, 20, 24, 27, 30, 31, 31, 29, 26, 22, 18],
  'western-desert': [20, 23, 27, 33, 38, 41, 42, 42, 38, 33, 26, 21],
  'sinai-red-sea': [21, 22, 25, 29, 33, 36, 37, 37, 34, 30, 26, 22],
  'nile-valley-upper-egypt': [21, 24, 28, 34, 39, 42, 43, 43, 39, 34, 27, 22],
};

export class PhysicsAtlasPredictionProvider implements PredictionProvider {
  forecast(params: {
    site: SitePoint;
    system: SystemSpec;
    horizonH?: 1 | 6 | 24;
    mode?: 'replay' | 'live';
    skyCondition?: SkyCondition;
    dayOfYear?: number;
  }): ForecastResult {
    const {
      site,
      system,
      horizonH = 1,
      mode = 'replay',
      skyCondition = 'clear',
      dayOfYear = 135,
    } = params;

    const points: ForecastPoint[] = [];
    const monthlyTemps = REGIONAL_MONTHLY_TEMP_C[site.region];
    const peakAmbTemp = monthlyTemps[4]; // May typical

    // Generate 16 daytime hours matching the ERA5 archive (04:00 to 19:00 local Cairo time)
    for (let hourLocal = 5; hourLocal <= 19; hourLocal++) {
      // Compute sun position at mid-hour (t - 0.5h) per Handover §5.2
      const solar = computeSolarPosition(site.cellLat, site.cellLon, hourLocal - 0.5, dayOfYear);
      const irr = simulateIrradianceAndPoa({
        solar,
        tiltDeg: system.tiltDeg || Math.round(site.cellLat),
        panelAzimuthDeg: system.azimuthDeg || 180,
        skyCondition,
      });

      const diurnalSwing = Math.sin(((hourLocal - 6) / 14) * Math.PI);
      const tAmbC = Math.round((peakAmbTemp - 9 + diurnalSwing * 10) * 10) / 10;
      const windSpeedMs = site.region === 'sinai-red-sea' ? 5.8 : 3.6;

      const pv = simulatePvPowerStep({
        tech: system.tech,
        kWp: system.kWp,
        poaWm2: irr.poaWm2,
        poaClearWm2: irr.poaClearWm2,
        tAmbC,
        windSpeedMs,
        skyCondition,
      });

      // Uncertainty band widens with horizonH and sky variability (dust/cloud)
      const baseSpread =
        skyCondition === 'dust' ? 0.19 : skyCondition === 'cloud' ? 0.22 : 0.08;
      const horizonFactor = horizonH === 1 ? 1.0 : horizonH === 6 ? 1.35 : 1.65;
      const spread = baseSpread * horizonFactor;

      const p10Kw = Math.max(0, Math.round(pv.pAcKw * (1 - spread) * 100) / 100);
      // PGNN constraint: p90 never exceeds clear-sky headroom (1.05 * P_clear)
      const p90Kw = Math.min(
        Math.round(pv.pClearKw * 1.05 * 100) / 100,
        Math.round(pv.pAcKw * (1 + spread * 0.85) * 100) / 100
      );

      points.push({
        targetTime: `2026-05-15T${String(hourLocal).padStart(2, '0')}:00:00+02:00`,
        hourLocal,
        solarElevationDeg: Math.round(solar.elevationDeg * 10) / 10,
        ghiWm2: Math.round(irr.ghiWm2),
        tAmbC,
        tCellC: pv.tCellC,
        kc: Math.round(irr.kc * 100) / 100,
        pKw: pv.pAcKw,
        p10Kw,
        p90Kw: Math.max(pv.pAcKw, p90Kw),
        pClearKw: pv.pClearKw,
      });
    }

    return {
      issueTime: '2026-05-15T05:00:00+02:00',
      horizonH,
      mode,
      points,
      source: 'mock',
      modelName: 'XGBoost + PGNN Constrained Ensemble',
      modelVersion: 'v1.4-era5-egypt',
    };
  }

  yield(site: SitePoint, system: SystemSpec): YieldResult {
    const baseMonthly = REGIONAL_MONTHLY_BASE_YIELD[site.region];
    const tempsMonthly = REGIONAL_MONTHLY_TEMP_C[site.region];
    const spec = PANEL_TECHNOLOGIES[system.tech];

    // Latitude factor inside region (southern cells have slightly higher insolation)
    const latBonus = 1 + (28.0 - site.cellLat) * 0.008;

    // Tilt orientation factor (optimal tilt in Egypt is ~26° facing South 180°)
    const tiltDiff = Math.abs((system.tiltDeg || 26) - site.cellLat * 0.9);
    const tiltFactor = Math.max(0.86, 1 - tiltDiff * 0.0022);

    const monthlySpecificKwhPerKwp: number[] = [];
    const monthlyKwh: number[] = [];

    for (let m = 0; m < 12; m++) {
      const tAmb = tempsMonthly[m];
      const tCellAvg = tAmb + 22; // average daytime operating cell temperature rise
      // Reference baseline assumes gamma = -0.38%/°C; adjust by chosen technology's gamma
      const gammaDelta = (spec.tempCoeffPctPerC - -0.38) / 100;
      const thermalMultiplier = 1 + gammaDelta * Math.max(0, tCellAvg - 25);

      // Regional spectral bonus: CIGS excels in coastal/Sinai haze; HJT excels in desert/Upper Egypt
      const regionalTechMultiplier =
        system.tech === 'a-Si:H/sc-Si'
          ? 1.032
          : system.tech === 'CIGS' &&
              (site.region === 'north-coast-delta' || site.region === 'sinai-red-sea')
            ? 1.028
            : system.tech === 'CIGS'
              ? 1.01
              : 0.985;

      const specificM =
        baseMonthly[m] * latBonus * tiltFactor * thermalMultiplier * regionalTechMultiplier;
      const roundedSpecific = Math.round(specificM * 10) / 10;
      monthlySpecificKwhPerKwp.push(roundedSpecific);
      monthlyKwh.push(Math.round(roundedSpecific * system.kWp));
    }

    const specificYield = Math.round(
      monthlySpecificKwhPerKwp.reduce((acc, v) => acc + v, 0)
    );
    const annualKwh = Math.round(monthlyKwh.reduce((acc, v) => acc + v, 0));

    // Performance Ratio reflects thermal and system losses
    const basePr =
      system.tech === 'a-Si:H/sc-Si' ? 0.835 : system.tech === 'CIGS' ? 0.812 : 0.782;
    const regionHeatPenalty =
      site.region === 'nile-valley-upper-egypt' || site.region === 'western-desert'
        ? (spec.tempCoeffPctPerC * -0.04)
        : 0;
    const performanceRatio = Math.round((basePr - regionHeatPenalty) * 1000) / 1000;

    return {
      annualKwh,
      monthlyKwh,
      monthlySpecificKwhPerKwp,
      specificYield,
      performanceRatio,
      clearSkyAnnualKwh: Math.round(annualKwh * 1.11),
      source: 'mock',
    };
  }
}

export const predictionProvider = new PhysicsAtlasPredictionProvider();

