// SolarSense Domain: 23-Feature Open-Meteo Weather Provider (Forecast, Recent & Archive)
// Implements Section 5, Section 6.3, and Section 9 of PLAN_doc_representation_modifications.md

import {
  FEATURE_KEYS_23,
  REGIONAL_SIX_DEFAULTS_FORM,
  formVectorToDatasetVector,
  getDatasetAverageFormVector,
  getDayOfYearFromDateStr,
  windSpeedDirToUV,
} from '../features';
import { calculateClearSky } from '../physics';
import { SAVED_REGIONS } from '../regions.config';
import {
  FeatureKey,
  FeatureProvenanceMap,
  RegionId,
  WeatherContractResponse,
  WeatherEndpointKind,
} from '../types';

const FORECAST_HOURLY_VARS = [
  'temperature_2m',
  'dew_point_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'surface_pressure',
  'total_column_integrated_water_vapour',
  'shortwave_radiation',
  'direct_radiation',
  'precipitation',
  'boundary_layer_height',
  'terrestrial_radiation',
].join(',');

const ARCHIVE_CORE_HOURLY_VARS = [
  'temperature_2m',
  'dew_point_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'surface_pressure',
  'shortwave_radiation',
  'direct_radiation',
  'precipitation',
  'terrestrial_radiation',
].join(',');

export function classifyWeatherDateEndpoint(dateStr: string): {
  valid: boolean;
  reason?: string;
  endpoint: WeatherEndpointKind;
  endpointLabelEn: string;
  endpointLabelAr: string;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return {
      valid: false,
      reason: "Field 'date' must be formatted as YYYY-MM-DD.",
      endpoint: 'forecast',
      endpointLabelEn: 'Forecast weather',
      endpointLabelAr: 'طقس متوقع',
    };
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const chosenUtcMs = Date.UTC(y, m - 1, d);
  if (Number.isNaN(chosenUtcMs)) {
    return {
      valid: false,
      reason: "Field 'date' is not a valid calendar date.",
      endpoint: 'forecast',
      endpointLabelEn: 'Forecast weather',
      endpointLabelAr: 'طقس متوقع',
    };
  }

  const minUtcMs = Date.UTC(2020, 0, 1);
  const now = new Date();
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const maxUtcMs = todayUtcMs + 15 * 86400000;

  if (chosenUtcMs < minUtcMs || chosenUtcMs > maxUtcMs) {
    const maxDateStr = new Date(maxUtcMs).toISOString().slice(0, 10);
    return {
      valid: false,
      reason: `Field 'date' (${dateStr}) must be between 2020-01-01 and ${maxDateStr} (today + 15 days).`,
      endpoint: 'forecast',
      endpointLabelEn: 'Forecast weather',
      endpointLabelAr: 'طقس متوقع',
    };
  }

  const diffDays = Math.round((chosenUtcMs - todayUtcMs) / 86400000);
  if (diffDays >= 0) {
    return {
      valid: true,
      endpoint: 'forecast',
      endpointLabelEn: 'Forecast weather',
      endpointLabelAr: 'طقس متوقع (Forecast)',
    };
  }
  if (diffDays >= -90) {
    return {
      valid: true,
      endpoint: 'recent',
      endpointLabelEn: 'Recent weather',
      endpointLabelAr: 'طقس حديث (Recent)',
    };
  }
  return {
    valid: true,
    endpoint: 'archive',
    endpointLabelEn: 'Historical weather (reanalysis)',
    endpointLabelAr: 'طقس تاريخي (إعادة تحليل ERA5)',
  };
}

export async function fetch23WeatherFeatures(params: {
  region: RegionId;
  date: string;
  hourUtc: number;
}): Promise<WeatherContractResponse> {
  const { region, date, hourUtc } = params;
  const regionInfo = SAVED_REGIONS[region];
  const { lat, lon, labelEn } = regionInfo.representativePoint;

  const dateMeta = classifyWeatherDateEndpoint(date);
  if (!dateMeta.valid) {
    throw new Error(dateMeta.reason || 'Invalid date');
  }

  const baseUrl =
    dateMeta.endpoint === 'archive'
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

  const primaryUrl = `${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&timezone=GMT&wind_speed_unit=ms&hourly=${FORECAST_HOURLY_VARS}`;

  let res = await fetch(primaryUrl, { cache: 'no-store' });
  if (!res.ok && dateMeta.endpoint === 'archive') {
    const fallbackArchiveUrl = `${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&timezone=GMT&wind_speed_unit=ms&hourly=${ARCHIVE_CORE_HOURLY_VARS}`;
    res = await fetch(fallbackArchiveUrl, { cache: 'no-store' });
  }

  if (!res.ok) {
    throw new Error(`Open-Meteo ${dateMeta.endpoint} endpoint returned HTTP ${res.status}.`);
  }

  const data = await res.json();
  const hourly = data?.hourly;
  if (!hourly || !Array.isArray(hourly.time)) {
    throw new Error('Open-Meteo response did not include an hourly time series.');
  }

  const targetIsoPrefix = `${date}T${String(hourUtc).padStart(2, '0')}:00`;
  let hourIdx = hourly.time.findIndex((t: string) => t.startsWith(targetIsoPrefix));
  if (hourIdx < 0 && hourUtc < hourly.time.length) {
    hourIdx = hourUtc;
  }
  if (hourIdx < 0) {
    throw new Error(`Requested hour ${targetIsoPrefix}Z was not found in Open-Meteo response.`);
  }

  const readHourlyNumber = (field: string): number | null => {
    const arr = hourly[field];
    if (!Array.isArray(arr)) return null;
    const v = arr[hourIdx];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  // Baseline dataset averages for the 6 non-live fields (and any null archive fields)
  const baseline = getDatasetAverageFormVector(region, date, hourUtc);
  const form: Record<FeatureKey, number> = { ...baseline.form };
  const provenance: FeatureProvenanceMap = { ...baseline.provenance };
  const missing: FeatureKey[] = [];

  // 1. Calculated feature #13: ssrdc from clear-sky physics model
  const doy = getDayOfYearFromDateStr(date);
  const clearSky = calculateClearSky(lat, lon, doy, hourUtc + 2);
  form.ssrdc = Math.round(clearSky.ghiClearWm2);
  provenance.ssrdc = 'calculated';

  // 2. Direct 1-to-1 API fields
  const apiMapping: { key: FeatureKey; omField: string }[] = [
    { key: 't2m', omField: 'temperature_2m' },
    { key: 'd2m', omField: 'dew_point_2m' },
    { key: 'tcc', omField: 'cloud_cover' },
    { key: 'lcc', omField: 'cloud_cover_low' },
    { key: 'mcc', omField: 'cloud_cover_mid' },
    { key: 'hcc', omField: 'cloud_cover_high' },
    { key: 'sp', omField: 'surface_pressure' },
    { key: 'tcwv', omField: 'total_column_integrated_water_vapour' },
    { key: 'ssrd', omField: 'shortwave_radiation' },
    { key: 'fdir', omField: 'direct_radiation' },
    { key: 'tp', omField: 'precipitation' },
    { key: 'blh', omField: 'boundary_layer_height' },
    { key: 'i10fg', omField: 'wind_gusts_10m' },
    { key: 'tisr', omField: 'terrestrial_radiation' },
  ];

  for (const item of apiMapping) {
    const val = readHourlyNumber(item.omField);
    if (val !== null) {
      form[item.key] = val;
      provenance[item.key] = 'api';
    } else if (item.key === 'tisr') {
      form.tisr = Math.round(clearSky.extraterrestrialWm2);
      provenance.tisr = 'calculated';
    } else {
      missing.push(item.key);
      provenance[item.key] = 'default';
    }
  }

  // 3. Wind speed & direction -> u10, v10
  const ws = readHourlyNumber('wind_speed_10m');
  const wd = readHourlyNumber('wind_direction_10m');
  if (ws !== null && wd !== null) {
    const { u10, v10 } = windSpeedDirToUV(ws, wd);
    form.u10 = u10;
    form.v10 = v10;
    provenance.u10 = 'api';
    provenance.v10 = 'api';
  } else {
    missing.push('u10', 'v10');
    provenance.u10 = 'default';
    provenance.v10 = 'default';
  }

  // 4. Six features without a live Open-Meteo source (strd, ssr, str, tco3, tciw, tclw)
  const six = REGIONAL_SIX_DEFAULTS_FORM[region];
  form.strd = six.strd;
  form.ssr = Math.round(form.ssrd * (1 - regionInfo.albedo));
  form.str = six.str;
  form.tco3 = six.tco3;
  form.tciw = six.tciw;
  form.tclw = six.tclw;

  for (const k of ['strd', 'ssr', 'str', 'tco3', 'tciw', 'tclw'] as FeatureKey[]) {
    provenance[k] = 'default';
  }

  // Convert all 23 form values into dataset units (K, Pa, J/m², m, 0-1, kg/m²)
  const features = formVectorToDatasetVector(form);

  // Ensure every key in FEATURE_KEYS_23 has a provenance tag
  for (const k of FEATURE_KEYS_23) {
    if (!provenance[k]) provenance[k] = 'default';
  }

  return {
    region,
    regionNumber: regionInfo.regionNumber,
    representativePoint: {
      lat,
      lon,
      labelEn,
    },
    datetimeUtc: `${date}T${String(hourUtc).padStart(2, '0')}:00:00Z`,
    endpoint: dateMeta.endpoint,
    endpointLabelEn: dateMeta.endpointLabelEn,
    endpointLabelAr: dateMeta.endpointLabelAr,
    features,
    provenance,
    missing,
  };
}
