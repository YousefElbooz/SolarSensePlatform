// SolarSense Domain: Point Prediction Provider & Physics Stand-In
// Implements Section 9 & Section 12 of PLAN_doc_representation_modifications.md
// Rule 12.3: A stand-in never carries a model name or version.

import {
  checkCrossFieldWarnings,
  datasetVectorToFormVector,
  getDayOfYearFromDateStr,
} from '../features';
import { computeSolarPosition, simulatePvPowerStep } from '../physics';
import { SAVED_REGIONS } from '../regions.config';
import { PointPredictionRequest, PointPredictionResponse } from '../types';

const REFERENCE_SYSTEM_KWP = 10.0;

export function computePhysicsReferenceFrom23Features(req: PointPredictionRequest): {
  pClearKw: number;
  pPhysicsKw: number;
  gPoaWm2: number;
  tCellC: number;
  solarElevationDeg: number;
  warnings: string[];
} {
  const regionInfo = SAVED_REGIONS[req.region];
  const { lat, lon } = regionInfo.representativePoint;

  const datePart = req.datetimeUtc.slice(0, 10);
  const hourUtc = Number(req.datetimeUtc.slice(11, 13)) || 10;
  const doy = getDayOfYearFromDateStr(datePart);
  const hourLocal = hourUtc + 2;

  const form = datasetVectorToFormVector(req.features);
  const warnings = checkCrossFieldWarnings(form);

  // Mid-hour solar geometry (hourLocal - 0.5) matching ERA5 preceding-hour radiation accumulation
  const solar = computeSolarPosition(lat, lon, hourLocal - 0.5, doy);

  const ghiWm2 = Math.max(0, form.ssrd);
  const fdirWm2 = Math.max(0, Math.min(ghiWm2, form.fdir));
  const dhiWm2 = Math.max(0, ghiWm2 - fdirWm2);
  const ghiClearWm2 = Math.max(ghiWm2, form.ssrdc);

  const DEG2RAD = Math.PI / 180;
  const tiltDeg = Math.round(lat * 0.9);
  const panelAzimuthDeg = 180;

  let poaWm2 = 0;
  let poaClearWm2 = 0;

  if (solar.elevationDeg > 0 && ghiWm2 > 0) {
    const sinElev = Math.max(0.08, Math.sin(solar.elevationDeg * DEG2RAD));
    const dniWm2 = fdirWm2 / sinElev;
    const zenithRad = solar.zenithDeg * DEG2RAD;
    const tiltRad = tiltDeg * DEG2RAD;
    const azDiffRad = (solar.azimuthDeg - panelAzimuthDeg) * DEG2RAD;

    const cosAoi =
      Math.cos(zenithRad) * Math.cos(tiltRad) +
      Math.sin(zenithRad) * Math.sin(tiltRad) * Math.cos(azDiffRad);

    const beamPoa = dniWm2 * Math.max(0, cosAoi);
    const skyViewFactor = (1 + Math.cos(tiltRad)) / 2;
    const groundViewFactor = (1 - Math.cos(tiltRad)) / 2;
    const diffusePoa = dhiWm2 * skyViewFactor;
    const groundReflectedPoa = ghiWm2 * regionInfo.albedo * groundViewFactor;

    poaWm2 = Math.max(0, beamPoa + diffusePoa + groundReflectedPoa);
    const clearRatio = ghiWm2 > 5 ? ghiClearWm2 / ghiWm2 : 1;
    poaClearWm2 = Math.max(poaWm2, poaWm2 * clearRatio);
  }

  const windSpeedMs = Math.hypot(form.u10, form.v10);
  const skyCondition =
    form.tcc > 50 ? 'cloud' : form.i10fg > 11 ? 'dust' : form.t2m > 40 ? 'heatwave' : 'clear';

  const pv = simulatePvPowerStep({
    tech: req.panelTech,
    kWp: REFERENCE_SYSTEM_KWP,
    poaWm2,
    poaClearWm2,
    tAmbC: form.t2m,
    windSpeedMs,
    skyCondition,
  });

  return {
    pClearKw: pv.pClearKw,
    pPhysicsKw: pv.pAcKw,
    gPoaWm2: Math.round(poaWm2),
    tCellC: pv.tCellC,
    solarElevationDeg: Math.round(solar.elevationDeg * 10) / 10,
    warnings,
  };
}

export async function evaluatePointPrediction(
  req: PointPredictionRequest
): Promise<PointPredictionResponse> {
  const phys = computePhysicsReferenceFrom23Features(req);
  const regionInfo = SAVED_REGIONS[req.region];
  const baseUrl = process.env.PYTHON_ML_SERVICE_URL?.replace(/\/+$/, '');

  if (baseUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (process.env.PYTHON_ML_API_KEY) {
        headers['Authorization'] = `Bearer ${process.env.PYTHON_ML_API_KEY}`;
      }

      const res = await fetch(`${baseUrl}/v1/predict`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          region: req.region,
          regionNumber: regionInfo.regionNumber,
          datetimeUtc: req.datetimeUtc,
          panelTech: req.panelTech,
          features: req.features,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Python ML service returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const val =
        typeof data?.prediction?.value === 'number'
          ? data.prediction.value
          : typeof data?.value === 'number'
            ? data.value
            : phys.pPhysicsKw;
      const unit =
        typeof data?.prediction?.unit === 'string'
          ? data.prediction.unit
          : 'kW (10 kWp reference array)';
      const modelVersion =
        typeof data?.modelVersion === 'string' && data.modelVersion.trim().length > 0
          ? data.modelVersion.trim()
          : 'python-ml-v1';

      const serviceWarnings = Array.isArray(data?.warnings) ? data.warnings : [];

      return {
        prediction: {
          value: Math.round(val * 1000) / 1000,
          unit,
          specificKwPerKwp: Math.round((val / REFERENCE_SYSTEM_KWP) * 1000) / 1000,
          referenceSystemKwp: REFERENCE_SYSTEM_KWP,
        },
        source: 'model',
        modelVersion,
        physicsReference: {
          pClearKw: phys.pClearKw,
          pPhysicsKw: phys.pPhysicsKw,
          gPoaWm2: phys.gPoaWm2,
          tCellC: phys.tCellC,
          solarElevationDeg: phys.solarElevationDeg,
        },
        warnings: [...phys.warnings, ...serviceWarnings],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Service unreachable';
      return {
        prediction: {
          value: phys.pPhysicsKw,
          unit: 'kW (10 kWp reference array)',
          specificKwPerKwp: Math.round((phys.pPhysicsKw / REFERENCE_SYSTEM_KWP) * 1000) / 1000,
          referenceSystemKwp: REFERENCE_SYSTEM_KWP,
        },
        source: 'stand-in',
        physicsReference: {
          pClearKw: phys.pClearKw,
          pPhysicsKw: phys.pPhysicsKw,
          gPoaWm2: phys.gPoaWm2,
          tCellC: phys.tCellC,
          solarElevationDeg: phys.solarElevationDeg,
        },
        warnings: [
          ...phys.warnings,
          `Python ML service (${baseUrl}) unreachable (${msg}); showing physics stand-in calculation.`,
        ],
      };
    }
  }

  return {
    prediction: {
      value: phys.pPhysicsKw,
      unit: 'kW (10 kWp reference array)',
      specificKwPerKwp: Math.round((phys.pPhysicsKw / REFERENCE_SYSTEM_KWP) * 1000) / 1000,
      referenceSystemKwp: REFERENCE_SYSTEM_KWP,
    },
    source: 'stand-in',
    physicsReference: {
      pClearKw: phys.pClearKw,
      pPhysicsKw: phys.pPhysicsKw,
      gPoaWm2: phys.gPoaWm2,
      tCellC: phys.tCellC,
      solarElevationDeg: phys.solarElevationDeg,
    },
    warnings: [
      ...phys.warnings,
      'Python ML service (PYTHON_ML_SERVICE_URL) is not connected; showing PVWatts/Faiman physics stand-in calculation.',
    ],
  };
}
