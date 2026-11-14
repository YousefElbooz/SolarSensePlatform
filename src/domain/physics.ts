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
  pressurePa: number;
}

export interface SolarPositionOptions {
  /** Surface pressure in Pascals (Pa), e.g. ERA5 `sp`. Defaults to 101325 Pa. */
  pressurePa?: number;
  /** Ambient 2m air temperature in °C (`t2m - 273.15`). Defaults to 25 °C. */
  tempC?: number;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Derives Direct Normal Irradiance (DNI, W/m²) from ERA5 `fdir` and solar zenith angle:
 * Formula: DNI = (fdir / 3600) / cos(zenith)
 */
export function deriveDniFromFdir(
  fdirValue: number,
  zenithDeg: number,
  isAccumulatedJm2: boolean = true
): number {
  const fdirWm2 = Math.max(0, isAccumulatedJm2 ? fdirValue / 3600 : fdirValue);
  if (zenithDeg >= 89.5 || fdirWm2 <= 0) return 0;
  // Clamp cos(zenith) near the horizon (zenith > 85°) to prevent grazing-angle blow-up
  const cosZenith = Math.max(0.08715, Math.cos(zenithDeg * DEG2RAD));
  return Math.min(1361, Math.max(0, fdirWm2 / cosZenith));
}

/**
 * Computes Relative Humidity (%) from 2m air temperature (°C) and 2m dewpoint temperature (°C)
 * using the August–Roche–Magnus approximation.
 */
export function computeRelativeHumidity(t2mC: number, d2mC: number): number {
  const clampedDew = Math.min(t2mC, d2mC);
  const num = Math.exp((17.625 * clampedDew) / (243.04 + clampedDew));
  const den = Math.exp((17.625 * t2mC) / (243.04 + t2mC));
  return Math.max(0, Math.min(100, Math.round((num / Math.max(1e-6, den)) * 1000) / 10));
}

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
 * Supports surface pressure `sp` (Pa) and 2m temperature `t2m` (°C) for atmospheric refraction
 * matching `pvlib.solarposition.get_solarposition(..., pressure=sp, temperature=t2m)`.
 * Note: For ERA5 hour-ending accumulations, pass (hour - 0.5) per Handover §5.2.
 */
export function computeSolarPosition(
  latDeg: number,
  lonDeg: number,
  localHour: number,
  dayOfYear: number = 150,
  options?: SolarPositionOptions
): SolarPosition {
  const pressurePa = options?.pressurePa ?? 101325;
  const tempC = options?.tempC ?? 25;

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
  const trueElevationDeg = elevationRad * RAD2DEG;

  // Atmospheric refraction correction (Bennett / NREL SPA) scaled by sp (Pa) and t2m (°C)
  let refractionDeg = 0;
  if (trueElevationDeg > -1.0 && trueElevationDeg < 85.0) {
    const tanArg = (trueElevationDeg + 10.3 / (trueElevationDeg + 5.11)) * DEG2RAD;
    const baseRefrArcMin = 1.02 / Math.max(0.01, Math.tan(tanArg));
    const pressureRatio = pressurePa / 101000;
    const tempRatio = 283 / Math.max(200, 273.15 + tempC);
    refractionDeg = (baseRefrArcMin * pressureRatio * tempRatio) / 60;
  }

  const elevationDeg = Math.min(90, trueElevationDeg + refractionDeg);
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
    elevationDeg > 0 ? 1361 * eccentricityFactor * Math.max(0, Math.sin(elevationDeg * DEG2RAD)) : 0;

  return {
    elevationDeg,
    zenithDeg,
    azimuthDeg,
    extraterrestrialWm2,
    pressurePa,
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

export function calculateClearSky(
  latDeg: number,
  lonDeg: number,
  dayOfYear: number,
  localHour: number,
  pressurePa: number = 101325
): {
  elevationDeg: number;
  azimuthDeg: number;
  extraterrestrialWm2: number;
  ghiClearWm2: number;
} {
  // Use mid-hour (localHour - 0.5) to match ERA5 preceding-hour accumulation
  const solar = computeSolarPosition(latDeg, lonDeg, localHour - 0.5, dayOfYear, { pressurePa });
  const irr = simulateIrradianceAndPoa({
    solar,
    tiltDeg: Math.round(latDeg * 0.9),
    panelAzimuthDeg: 180,
    skyCondition: 'clear',
    pressurePa,
  });
  return {
    elevationDeg: solar.elevationDeg,
    azimuthDeg: solar.azimuthDeg,
    extraterrestrialWm2: solar.extraterrestrialWm2,
    ghiClearWm2: irr.ghiClearWm2,
  };
}

export function simulateIrradianceAndPoa(params: {
  solar: SolarPosition;
  tiltDeg: number;
  panelAzimuthDeg: number;
  skyCondition: SkyCondition;
  turbidityFactor?: number;
  /** Forecast albedo `fal` (0–1 fraction) fed into `get_total_irradiance(..., albedo=fal)`. */
  albedo?: number;
  /** Surface pressure `sp` in Pascals (Pa) for pressure-corrected airmass `AM_a`. */
  pressurePa?: number;
}): IrradianceComponents {
  const {
    solar,
    tiltDeg,
    panelAzimuthDeg,
    skyCondition,
    turbidityFactor = 2.8,
    albedo = 0.24,
    pressurePa = solar.pressurePa ?? 101325,
  } = params;
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
  // Kasten-Young relative air mass + pressure-corrected absolute air mass (AM_a = AM_r * sp / 101325)
  const relativeAirMass =
    1 /
    (sinElev + 0.50572 * Math.pow(Math.max(0.5, solar.elevationDeg + 6.07995), -1.6364));
  const airMass = relativeAirMass * (pressurePa / 101325);

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
  const fdirWm2 = Math.max(0, ghiWm2 - dhiWm2);
  // Derive DNI from direct horizontal irradiance: DNI = (fdir / 3600) / cos(zenith)
  const dniWm2 = deriveDniFromFdir(fdirWm2, solar.zenithDeg, false);

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
  const clampedAlbedo = Math.max(0, Math.min(1, albedo));
  const diffusePoa = dhiWm2 * skyViewFactor;
  const groundReflectedPoa = ghiWm2 * clampedAlbedo * groundViewFactor;

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
 * Simulates instantaneous AC power using Faiman/NOCT cell temperature + PVWatts thermal model
 * plus spectral water-vapour (`tcwv`), boundary layer dust mixing (`blh`), and cloud condensate (`tciw, tclw`).
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
  /** Total column water vapour `tcwv` (kg/m²) affecting spectral absorption. */
  tcwvKgM2?: number;
  /** Relative humidity (%) derived from `t2m` and `d2m`. */
  relativeHumidityPct?: number;
  /** Boundary layer height `blh` (m) correlating with dust/aerosol vertical mixing. */
  blhM?: number;
  /** Cloud ice + liquid water (`tciw + tclw`, kg/m²). */
  cloudWaterKgM2?: number;
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
    tcwvKgM2,
    blhM,
    cloudWaterKgM2,
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
  // Faiman model with wind cooling (Wind = sqrt(u10^2 + v10^2)) & NOCT baseline
  const u0 = 25.0;
  const u1 = 6.84;
  const tCellC = tAmbC + poaWm2 / (u0 + u1 * Math.max(0.5, windSpeedMs));

  const gammaPerC = spec.tempCoeffPctPerC / 100; // e.g., -0.0042 for pc-Si, -0.0026 for HJT
  const tempDerateFactor = Math.max(0.65, 1 + gammaPerC * (tCellC - 25));

  // Base spectral modifier + precipitable water vapour (tcwv) spectral shift
  let spectralModifier =
    tech === 'CIGS' && (skyCondition === 'dust' || skyCondition === 'cloud')
      ? 1.035
      : tech === 'a-Si:H/sc-Si'
        ? 1.015
        : 1.0;

  if (typeof tcwvKgM2 === 'number' && Number.isFinite(tcwvKgM2)) {
    // Higher tcwv absorbs near-IR, slightly favoring wide-bandgap a-Si:H/sc-Si and CIGS over pc-Si
    const deltaTcwv = (tcwvKgM2 - 15) / 40;
    if (tech === 'a-Si:H/sc-Si' || tech === 'CIGS') {
      spectralModifier *= Math.max(0.98, Math.min(1.025, 1 + 0.012 * deltaTcwv));
    } else {
      spectralModifier *= Math.max(0.975, Math.min(1.01, 1 - 0.008 * deltaTcwv));
    }
  }

  if (typeof blhM === 'number' && Number.isFinite(blhM) && blhM < 400) {
    // Shallow boundary layer traps near-surface dust/aerosols slightly reducing transmittance
    spectralModifier *= 0.992;
  }

  if (typeof cloudWaterKgM2 === 'number' && Number.isFinite(cloudWaterKgM2) && cloudWaterKgM2 > 0.25) {
    spectralModifier *= Math.max(0.96, 1 - 0.02 * Math.min(1.5, cloudWaterKgM2));
  }

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

