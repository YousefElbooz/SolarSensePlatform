// SolarSense Domain: Solar Astronomy & PVWatts Physics Chain
// Implements mid-hour (t - 30 min) solar geometry, POA transposition, Faiman/NOCT cell temperature,
// and technology-specific temperature derating (gamma) for pc-Si, a-Si:H/sc-Si (HJT), and CIGS.

import { PANEL_TECHNOLOGIES } from './panels';
import { PanelTech, SeasonId, SkyCondition } from './types';

export interface SolarPosition {
  elevationDeg: number;
  zenithDeg: number;
  azimuthDeg: number; // 180 = due south in northern hemisphere
  extraterrestrialWm2: number;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function getDayOfYear(SeasonOrDate: SeasonId | Date | number): number {
  if (typeof SeasonOrDate === 'number') return SeasonOrDate;
  if (SeasonOrDate instanceof Date) {
    const start = new Date(SeasonOrDate.getFullYear(), 0, 0);
    const diff = SeasonOrDate.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  switch (SeasonOrDate) {
    case 'winter':
      return 15; // Jan 15
    case 'spring':
      return 105; // Apr 15 (Khamaseen peak)
    case 'summer':
      return 172; // Jun 21
    case 'autumn':
      return 288; // Oct 15
  }
}

/**
 * Computes solar elevation, zenith, and azimuth for an Egyptian site at local solar hour.
 * Note: For ERA5 hour-ending accumulations, pass (hour - 0.5) per Handover §5.2.
 */
export function computeSolarPosition(
  latDeg: number,
  lonDeg: number,
  localHour: number,
  dayOfYear: number = 150
): SolarPosition {
  const latRad = latDeg * DEG2RAD;
  // Cooper's solar declination equation
  const declDeg = 23.45 * Math.sin(((360 / 365) * (284 + dayOfYear)) * DEG2RAD);
  const declRad = declDeg * DEG2RAD;

  // Solar time offset around standard meridian 30° E (Egypt UTC+2)
  const B = ((360 / 365) * (dayOfYear - 81)) * DEG2RAD;
  const equationOfTimeMin = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const solarTimeOffsetHours = (4 * (lonDeg - 30) + equationOfTimeMin) / 60;
  const solarHour = localHour + solarTimeOffsetHours;

  const hourAngleDeg = (solarHour - 12) * 15;
  const hourAngleRad = hourAngleDeg * DEG2RAD;

  const sinElev =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
  const clampedSin = Math.max(-1, Math.min(1, sinElev));
  const elevationRad = Math.asin(clampedSin);
  const elevationDeg = elevationRad * RAD2DEG;
  const zenithDeg = 90 - elevationDeg;

  // Solar azimuth (0 = North, 90 = East, 180 = South, 270 = West)
  const cosAz =
    (Math.sin(declRad) - Math.sin(elevationRad) * Math.sin(latRad)) /
    Math.max(1e-5, Math.cos(elevationRad) * Math.cos(latRad));
  const clampedCosAz = Math.max(-1, Math.min(1, cosAz));
  const baseAzDeg = Math.acos(clampedCosAz) * RAD2DEG;
  const azimuthDeg = hourAngleDeg <= 0 ? baseAzDeg : 360 - baseAzDeg;

  const eccentricityFactor = 1 + 0.033 * Math.cos(((2 * Math.PI * dayOfYear) / 365));
  const extraterrestrialWm2 =
    elevationDeg > 0 ? 1361 * eccentricityFactor * Math.max(0, sinElev) : 0;

  return {
    elevationDeg,
    zenithDeg,
    azimuthDeg,
    extraterrestrialWm2,
  };
}

export interface IrradianceComponents {
  ghiClearWm2: number;
  ghiWm2: number;
  dniWm2: number;
  dhiWm2: number;
  poaWm2: number;
  poaClearWm2: number;
  kc: number;
}

export function simulateIrradianceAndPoa(params: {
  solar: SolarPosition;
  tiltDeg: number;
  panelAzimuthDeg: number;
  skyCondition: SkyCondition;
  turbidityFactor?: number;
}): IrradianceComponents {
  const { solar, tiltDeg, panelAzimuthDeg, skyCondition, turbidityFactor = 2.8 } = params;
  if (solar.elevationDeg <= 0) {
    return {
      ghiClearWm2: 0,
      ghiWm2: 0,
      dniWm2: 0,
      dhiWm2: 0,
      poaWm2: 0,
      poaClearWm2: 0,
      kc: 0,
    };
  }

  const sinElev = Math.sin(solar.elevationDeg * DEG2RAD);
  // Kasten-Young air mass
  const airMass =
    1 /
    (sinElev + 0.50572 * Math.pow(Math.max(0.5, solar.elevationDeg + 6.07995), -1.6364));

  // Clear-sky GHI (Ineichen-style atmospheric transmittance)
  const ghiClearWm2 = Math.max(
    0,
    solar.extraterrestrialWm2 * Math.exp(-0.09 * airMass * (turbidityFactor / 2.5)) * 0.84
  );

  // Sky condition modifier (clear-sky index k_c and diffuse fraction)
  let kc = 0.96;
  let diffuseFraction = 0.16;
  if (skyCondition === 'dust') {
    // Khamaseen dust storm: cuts GHI by ~28% and DNI by ~52%, shifts energy into diffuse haze
    kc = 0.72;
    diffuseFraction = 0.54;
  } else if (skyCondition === 'cloud') {
    kc = 0.58;
    diffuseFraction = 0.68;
  } else if (skyCondition === 'heatwave') {
    kc = 0.92;
    diffuseFraction = 0.22;
  }

  const ghiWm2 = ghiClearWm2 * kc;
  const dhiWm2 = ghiWm2 * diffuseFraction;
  const dniWm2 = Math.max(0, (ghiWm2 - dhiWm2) / Math.max(0.08, sinElev));

  // Angle of incidence (AOI) on tilted panel
  const zenithRad = solar.zenithDeg * DEG2RAD;
  const tiltRad = tiltDeg * DEG2RAD;
  const azDiffRad = (solar.azimuthDeg - panelAzimuthDeg) * DEG2RAD;

  const cosAoi =
    Math.cos(zenithRad) * Math.cos(tiltRad) +
    Math.sin(zenithRad) * Math.sin(tiltRad) * Math.cos(azDiffRad);
  const beamPoa = dniWm2 * Math.max(0, cosAoi);
  const skyViewFactor = (1 + Math.cos(tiltRad)) / 2;
  const groundViewFactor = (1 - Math.cos(tiltRad)) / 2;
  const albedo = 0.24; // Egyptian desert/concrete screed albedo
  const diffusePoa = dhiWm2 * skyViewFactor;
  const groundReflectedPoa = ghiWm2 * albedo * groundViewFactor;

  const poaWm2 = Math.max(0, beamPoa + diffusePoa + groundReflectedPoa);
  const poaClearWm2 = kc > 0.05 ? poaWm2 / kc : ghiClearWm2;

  return {
    ghiClearWm2,
    ghiWm2,
    dniWm2,
    dhiWm2,
    poaWm2,
    poaClearWm2,
    kc,
  };
}

export interface PvSimulationStep {
  pAcKw: number;
  pClearKw: number;
  tCellC: number;
  tempDerateFactor: number;
  performanceRatio: number;
}

/**
 * Simulates instantaneous AC power using Faiman/NOCT cell temperature + PVWatts thermal model.
 */
export function simulatePvPowerStep(params: {
  tech: PanelTech;
  kWp: number;
  poaWm2: number;
  poaClearWm2: number;
  tAmbC: number;
  windSpeedMs: number;
  skyCondition?: SkyCondition;
  systemLossesPct?: number;
}): PvSimulationStep {
  const {
    tech,
    kWp,
    poaWm2,
    poaClearWm2,
    tAmbC,
    windSpeedMs,
    skyCondition = 'clear',
    systemLossesPct = 12,
  } = params;

  if (poaWm2 <= 1 || kWp <= 0) {
    return {
      pAcKw: 0,
      pClearKw: 0,
      tCellC: tAmbC,
      tempDerateFactor: 1,
      performanceRatio: 0,
    };
  }

  const spec = PANEL_TECHNOLOGIES[tech];
  // Faiman model with wind cooling & NOCT baseline
  const u0 = 25.0;
  const u1 = 6.84;
  const tCellC = tAmbC + poaWm2 / (u0 + u1 * Math.max(0.5, windSpeedMs));

  const gammaPerC = spec.tempCoeffPctPerC / 100; // e.g., -0.0042 for pc-Si, -0.0026 for HJT
  const tempDerateFactor = Math.max(0.65, 1 + gammaPerC * (tCellC - 25));

  // CIGS has a slight spectral/low-light advantage under diffuse dust/cloud skies
  const spectralModifier =
    tech === 'CIGS' && (skyCondition === 'dust' || skyCondition === 'cloud')
      ? 1.035
      : tech === 'a-Si:H/sc-Si'
        ? 1.015
        : 1.0;

  const lossMultiplier = (1 - systemLossesPct / 100) * 0.965; // inverter efficiency 96.5%
  const pDcKw = kWp * (poaWm2 / 1000) * tempDerateFactor * spectralModifier;
  const pAcKw = Math.min(kWp * 0.98, Math.max(0, pDcKw * lossMultiplier));

  const tCellClearC = tAmbC + poaClearWm2 / (u0 + u1 * Math.max(0.5, windSpeedMs));
  const clearDerate = Math.max(0.65, 1 + gammaPerC * (tCellClearC - 25));
  const pClearKw = Math.min(
    kWp * 0.98,
    Math.max(0, kWp * (poaClearWm2 / 1000) * clearDerate * lossMultiplier)
  );

  const idealPower = kWp * (poaWm2 / 1000);
  const performanceRatio = idealPower > 0.01 ? Math.min(0.95, pAcKw / idealPower) : 0;

  return {
    pAcKw: Math.round(pAcKw * 100) / 100,
    pClearKw: Math.round(pClearKw * 100) / 100,
    tCellC: Math.round(tCellC * 10) / 10,
    tempDerateFactor: Math.round(tempDerateFactor * 1000) / 1000,
    performanceRatio: Math.round(performanceRatio * 1000) / 1000,
  };
}

