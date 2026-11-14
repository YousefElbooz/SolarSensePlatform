// SolarSense Domain: 23-Feature ERA5 Weather Contract, Conversions & Validation
// Implements Section 5 & Section 6 of PLAN_doc_representation_modifications.md

import { calculateClearSky } from './physics';
import { SAVED_REGIONS } from './regions.config';
import { FeatureKey, FeatureProvenance, FeatureProvenanceMap, FeatureVector23, RegionId } from './types';

export type FeatureGroupId =
  | 'temp_humidity'
  | 'wind'
  | 'cloud'
  | 'solar_rad'
  | 'thermal_atmo'
  | 'precipitation';

export interface FeatureGroupDef {
  id: FeatureGroupId;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
}

export const FEATURE_GROUPS: FeatureGroupDef[] = [
  {
    id: 'temp_humidity',
    titleEn: '1. Temperature & Humidity',
    titleAr: '1. الحرارة والرطوبة',
    subtitleEn: '2m air temperature, dew point, and total column water vapour',
    subtitleAr: 'حرارة الهواء عند 2م، نقطة الندى، وبخار الماء الكلي في العمود الجوي',
  },
  {
    id: 'wind',
    titleEn: '2. Wind (10m Vector & Gusts)',
    titleAr: '2. الرياح (متجه 10م والهبات)',
    subtitleEn: 'Entered as speed & direction; converted to zonal (u10) and meridional (v10) m/s',
    subtitleAr: 'تُدخل كسرعة واتجاه وتُحول إلى المركبتين u10 و v10 بالمتر/ثانية',
  },
  {
    id: 'cloud',
    titleEn: '3. Cloud Cover & Condensate',
    titleAr: '3. الغطاء السحابي والمحتوى المائي/الجليدي',
    subtitleEn: 'Total, low, medium, and high cloud fractions plus column ice and liquid water',
    subtitleAr: 'نسب السحب الكلية والمنخفضة والمتوسطة والعالية والماء السائل والجليد',
  },
  {
    id: 'solar_rad',
    titleEn: '4. Solar Radiation (Surface & TOA)',
    titleAr: '4. الإشعاع الشمسي (السطحي وأعلى الغلاف الجوي)',
    subtitleEn: 'Displayed in W/m²; converted to hourly accumulated J/m² (× 3,600) for the model',
    subtitleAr: 'تُعرض بـ W/m² وتُحول إلى إشعاع ساعي متراكم J/m² (× 3600) للنموذج',
  },
  {
    id: 'thermal_atmo',
    titleEn: '5. Thermal Radiation & Atmosphere',
    titleAr: '5. الإشعاع الحراري والغلاف الجوي',
    subtitleEn: 'Thermal downward/net flux, surface pressure, boundary layer height, and column ozone',
    subtitleAr: 'الإشعاع الحراري، الضغط السطحي، ارتفاع الطبقة الحدية، والأوزون الكلي',
  },
  {
    id: 'precipitation',
    titleEn: '6. Precipitation',
    titleAr: '6. الهطول المطري',
    subtitleEn: 'Hourly accumulated liquid and frozen precipitation',
    subtitleAr: 'الهطول المطري الساعي المتراكم',
  },
];

export interface FeatureDefinition {
  index: number;
  key: FeatureKey;
  era5Name: string;
  labelEn: string;
  labelAr: string;
  group: FeatureGroupId;
  datasetUnit: string;
  formUnit: string;
  formRange: [number, number];
  datasetRange: [number, number];
  step: number;
  decimalsForm: number;
  sourceStatus: 'api' | 'calculated' | 'default';
  openMeteoParam?: string;
  formToDataset: (formVal: number) => number;
  datasetToForm: (datasetVal: number) => number;
}

const DOBSON_TO_KG_M2 = 2.1415e-5; // 1 DU = 2.1415e-5 kg/m²

export const FEATURES_23: FeatureDefinition[] = [
  {
    index: 1,
    key: 't2m',
    era5Name: '2m_temperature',
    labelEn: '2m Air Temperature',
    labelAr: 'درجة حرارة الهواء (2م)',
    group: 'temp_humidity',
    datasetUnit: 'K',
    formUnit: '°C',
    formRange: [-10, 58],
    datasetRange: [263.15, 331.15],
    step: 0.5,
    decimalsForm: 1,
    sourceStatus: 'api',
    openMeteoParam: 'temperature_2m',
    formToDataset: (c) => c + 273.15,
    datasetToForm: (k) => k - 273.15,
  },
  {
    index: 2,
    key: 'u10',
    era5Name: '10m_u_component_of_wind',
    labelEn: '10m Wind Zonal Component (u10)',
    labelAr: 'مركبة الرياح الشرقية-الغربية (u10)',
    group: 'wind',
    datasetUnit: 'm/s',
    formUnit: 'm/s',
    formRange: [-40, 40],
    datasetRange: [-40, 40],
    step: 0.1,
    decimalsForm: 2,
    sourceStatus: 'api',
    openMeteoParam: 'wind_speed_10m,wind_direction_10m',
    formToDataset: (v) => v,
    datasetToForm: (v) => v,
  },
  {
    index: 3,
    key: 'd2m',
    era5Name: '2m_dewpoint_temperature',
    labelEn: '2m Dewpoint Temperature',
    labelAr: 'درجة حرارة نقطة الندى (2م)',
    group: 'temp_humidity',
    datasetUnit: 'K',
    formUnit: '°C',
    formRange: [-25, 40],
    datasetRange: [248.15, 313.15],
    step: 0.5,
    decimalsForm: 1,
    sourceStatus: 'api',
    openMeteoParam: 'dew_point_2m',
    formToDataset: (c) => c + 273.15,
    datasetToForm: (k) => k - 273.15,
  },
  {
    index: 4,
    key: 'v10',
    era5Name: '10m_v_component_of_wind',
    labelEn: '10m Wind Meridional Component (v10)',
    labelAr: 'مركبة الرياح الشمالية-الجنوبية (v10)',
    group: 'wind',
    datasetUnit: 'm/s',
    formUnit: 'm/s',
    formRange: [-40, 40],
    datasetRange: [-40, 40],
    step: 0.1,
    decimalsForm: 2,
    sourceStatus: 'api',
    openMeteoParam: 'wind_speed_10m,wind_direction_10m',
    formToDataset: (v) => v,
    datasetToForm: (v) => v,
  },
  {
    index: 5,
    key: 'tcc',
    era5Name: 'total_cloud_cover',
    labelEn: 'Total Cloud Cover',
    labelAr: 'الغطاء السحابي الكلي',
    group: 'cloud',
    datasetUnit: '0–1',
    formUnit: '%',
    formRange: [0, 100],
    datasetRange: [0, 1],
    step: 1,
    decimalsForm: 0,
    sourceStatus: 'api',
    openMeteoParam: 'cloud_cover',
    formToDataset: (pct) => pct / 100,
    datasetToForm: (frac) => frac * 100,
  },
  {
    index: 6,
    key: 'lcc',
    era5Name: 'low_cloud_cover',
    labelEn: 'Low Cloud Cover',
    labelAr: 'الغطاء السحابي المنخفض',
    group: 'cloud',
    datasetUnit: '0–1',
    formUnit: '%',
    formRange: [0, 100],
    datasetRange: [0, 1],
    step: 1,
    decimalsForm: 0,
    sourceStatus: 'api',
    openMeteoParam: 'cloud_cover_low',
    formToDataset: (pct) => pct / 100,
    datasetToForm: (frac) => frac * 100,
  },
  {
    index: 7,
    key: 'mcc',
    era5Name: 'medium_cloud_cover',
    labelEn: 'Medium Cloud Cover',
    labelAr: 'الغطاء السحابي المتوسط',
    group: 'cloud',
    datasetUnit: '0–1',
    formUnit: '%',
    formRange: [0, 100],
    datasetRange: [0, 1],
    step: 1,
    decimalsForm: 0,
    sourceStatus: 'api',
    openMeteoParam: 'cloud_cover_mid',
    formToDataset: (pct) => pct / 100,
    datasetToForm: (frac) => frac * 100,
  },
  {
    index: 8,
    key: 'hcc',
    era5Name: 'high_cloud_cover',
    labelEn: 'High Cloud Cover',
    labelAr: 'الغطاء السحابي العالي',
    group: 'cloud',
    datasetUnit: '0–1',
    formUnit: '%',
    formRange: [0, 100],
    datasetRange: [0, 1],
    step: 1,
    decimalsForm: 0,
    sourceStatus: 'api',
    openMeteoParam: 'cloud_cover_high',
    formToDataset: (pct) => pct / 100,
    datasetToForm: (frac) => frac * 100,
  },
  {
    index: 9,
    key: 'sp',
    era5Name: 'surface_pressure',
    labelEn: 'Surface Pressure',
    labelAr: 'الضغط الجوي السطحي',
    group: 'thermal_atmo',
    datasetUnit: 'Pa',
    formUnit: 'hPa',
    formRange: [820, 1060],
    datasetRange: [82000, 106000],
    step: 1,
    decimalsForm: 1,
    sourceStatus: 'api',
    openMeteoParam: 'surface_pressure',
    formToDataset: (hpa) => hpa * 100,
    datasetToForm: (pa) => pa / 100,
  },
  {
    index: 10,
    key: 'tcwv',
    era5Name: 'total_column_water_vapour',
    labelEn: 'Total Column Water Vapour',
    labelAr: 'بخار الماء الكلي في العمود الجوي',
    group: 'temp_humidity',
    datasetUnit: 'kg/m²',
    formUnit: 'kg/m²',
    formRange: [0, 75],
    datasetRange: [0, 75],
    step: 0.5,
    decimalsForm: 1,
    sourceStatus: 'api',
    openMeteoParam: 'total_column_integrated_water_vapour',
    formToDataset: (v) => v,
    datasetToForm: (v) => v,
  },
  {
    index: 11,
    key: 'ssrd',
    era5Name: 'surface_solar_radiation_downwards',
    labelEn: 'Surface Downward Solar Radiation (GHI)',
    labelAr: 'الإشعاع الشمسي الساقط على السطح (GHI)',
    group: 'solar_rad',
    datasetUnit: 'J/m²',
    formUnit: 'W/m²',
    formRange: [0, 1300],
    datasetRange: [0, 1300 * 3600],
    step: 5,
    decimalsForm: 0,
    sourceStatus: 'api',
    openMeteoParam: 'shortwave_radiation',
    formToDataset: (wm2) => wm2 * 3600,
    datasetToForm: (jm2) => jm2 / 3600,
  },
  {
    index: 12,
    key: 'fdir',
    era5Name: 'total_sky_direct_solar_radiation_at_surface',
    labelEn: 'Direct Solar Radiation at Surface',
    labelAr: 'الإشعاع الشمسي المباشر على السطح',
    group: 'solar_rad',
    datasetUnit: 'J/m²',
    formUnit: 'W/m²',
    formRange: [0, 1250],
    datasetRange: [0, 1250 * 3600],
    step: 5,
    decimalsForm: 0,
    sourceStatus: 'api',
    openMeteoParam: 'direct_radiation',
    formToDataset: (wm2) => wm2 * 3600,
    datasetToForm: (jm2) => jm2 / 3600,
  },
  {
    index: 13,
    key: 'ssrdc',
    era5Name: 'surface_solar_radiation_downward_clear_sky',
    labelEn: 'Clear-Sky Downward Solar Radiation',
    labelAr: 'الإشعاع الشمسي في السماء الصافية',
    group: 'solar_rad',
    datasetUnit: 'J/m²',
    formUnit: 'W/m²',
    formRange: [0, 1300],
    datasetRange: [0, 1300 * 3600],
    step: 5,
    decimalsForm: 0,
    sourceStatus: 'calculated',
    formToDataset: (wm2) => wm2 * 3600,
    datasetToForm: (jm2) => jm2 / 3600,
  },
  {
    index: 14,
    key: 'tp',
    era5Name: 'total_precipitation',
    labelEn: 'Total Precipitation',
    labelAr: 'إجمالي الهطول المطري',
    group: 'precipitation',
    datasetUnit: 'm',
    formUnit: 'mm',
    formRange: [0, 100],
    datasetRange: [0, 0.1],
    step: 0.1,
    decimalsForm: 2,
    sourceStatus: 'api',
    openMeteoParam: 'precipitation',
    formToDataset: (mm) => mm / 1000,
    datasetToForm: (m) => m * 1000,
  },
  {
    index: 15,
    key: 'blh',
    era5Name: 'boundary_layer_height',
    labelEn: 'Boundary Layer Height',
    labelAr: 'ارتفاع الطبقة الحدية الجوية',
    group: 'thermal_atmo',
    datasetUnit: 'm',
    formUnit: 'm',
    formRange: [10, 6000],
    datasetRange: [10, 6000],
    step: 25,
    decimalsForm: 0,
    sourceStatus: 'api',
    openMeteoParam: 'boundary_layer_height',
    formToDataset: (v) => v,
    datasetToForm: (v) => v,
  },
  {
    index: 16,
    key: 'i10fg',
    era5Name: '10m_wind_gust_since_previous_post_processing',
    labelEn: '10m Wind Gust',
    labelAr: 'هبات الرياح عند 10م',
    group: 'wind',
    datasetUnit: 'm/s',
    formUnit: 'm/s',
    formRange: [0, 55],
    datasetRange: [0, 55],
    step: 0.5,
    decimalsForm: 1,
    sourceStatus: 'api',
    openMeteoParam: 'wind_gusts_10m',
    formToDataset: (v) => v,
    datasetToForm: (v) => v,
  },
  {
    index: 17,
    key: 'strd',
    era5Name: 'surface_thermal_radiation_downwards',
    labelEn: 'Surface Downward Thermal Radiation',
    labelAr: 'الإشعاع الحراري الهابط للسطح',
    group: 'thermal_atmo',
    datasetUnit: 'J/m²',
    formUnit: 'W/m²',
    formRange: [150, 550],
    datasetRange: [150 * 3600, 550 * 3600],
    step: 5,
    decimalsForm: 0,
    sourceStatus: 'default',
    formToDataset: (wm2) => wm2 * 3600,
    datasetToForm: (jm2) => jm2 / 3600,
  },
  {
    index: 18,
    key: 'ssr',
    era5Name: 'surface_net_solar_radiation',
    labelEn: 'Surface Net Solar Radiation',
    labelAr: 'صافي الإشعاع الشمسي السطحي',
    group: 'solar_rad',
    datasetUnit: 'J/m²',
    formUnit: 'W/m²',
    formRange: [0, 1200],
    datasetRange: [0, 1200 * 3600],
    step: 5,
    decimalsForm: 0,
    sourceStatus: 'default',
    formToDataset: (wm2) => wm2 * 3600,
    datasetToForm: (jm2) => jm2 / 3600,
  },
  {
    index: 19,
    key: 'str',
    era5Name: 'surface_net_thermal_radiation',
    labelEn: 'Surface Net Thermal Radiation',
    labelAr: 'صافي الإشعاع الحراري السطحي',
    group: 'thermal_atmo',
    datasetUnit: 'J/m²',
    formUnit: 'W/m²',
    formRange: [-300, 50],
    datasetRange: [-300 * 3600, 50 * 3600],
    step: 5,
    decimalsForm: 0,
    sourceStatus: 'default',
    formToDataset: (wm2) => wm2 * 3600,
    datasetToForm: (jm2) => jm2 / 3600,
  },
  {
    index: 20,
    key: 'tco3',
    era5Name: 'total_column_ozone',
    labelEn: 'Total Column Ozone',
    labelAr: 'إجمالي الأوزون في العمود الجوي',
    group: 'thermal_atmo',
    datasetUnit: 'kg/m²',
    formUnit: 'DU',
    formRange: [180, 450],
    datasetRange: [180 * DOBSON_TO_KG_M2, 450 * DOBSON_TO_KG_M2],
    step: 1,
    decimalsForm: 0,
    sourceStatus: 'default',
    formToDataset: (du) => du * DOBSON_TO_KG_M2,
    datasetToForm: (kgm2) => kgm2 / DOBSON_TO_KG_M2,
  },
  {
    index: 21,
    key: 'tciw',
    era5Name: 'total_column_cloud_ice_water',
    labelEn: 'Total Column Cloud Ice Water',
    labelAr: 'الماء الجليدي للسحب في العمود الجوي',
    group: 'cloud',
    datasetUnit: 'kg/m²',
    formUnit: 'kg/m²',
    formRange: [0, 2],
    datasetRange: [0, 2],
    step: 0.005,
    decimalsForm: 3,
    sourceStatus: 'default',
    formToDataset: (v) => v,
    datasetToForm: (v) => v,
  },
  {
    index: 22,
    key: 'tclw',
    era5Name: 'total_column_cloud_liquid_water',
    labelEn: 'Total Column Cloud Liquid Water',
    labelAr: 'الماء السائل للسحب في العمود الجوي',
    group: 'cloud',
    datasetUnit: 'kg/m²',
    formUnit: 'kg/m²',
    formRange: [0, 2],
    datasetRange: [0, 2],
    step: 0.005,
    decimalsForm: 3,
    sourceStatus: 'default',
    formToDataset: (v) => v,
    datasetToForm: (v) => v,
  },
  {
    index: 23,
    key: 'tisr',
    era5Name: 'toa_incident_solar_radiation',
    labelEn: 'TOA Incident Solar Radiation',
    labelAr: 'الإشعاع الشمسي الساقط أعلى الغلاف الجوي (TOA)',
    group: 'solar_rad',
    datasetUnit: 'J/m²',
    formUnit: 'W/m²',
    formRange: [0, 1420],
    datasetRange: [0, 1420 * 3600],
    step: 5,
    decimalsForm: 0,
    sourceStatus: 'api',
    openMeteoParam: 'terrestrial_radiation',
    formToDataset: (wm2) => wm2 * 3600,
    datasetToForm: (jm2) => jm2 / 3600,
  },
];

export const FEATURE_KEYS_23: FeatureKey[] = FEATURES_23.map((f) => f.key);

export const FEATURE_MAP: Record<FeatureKey, FeatureDefinition> = FEATURES_23.reduce(
  (acc, f) => {
    acc[f.key] = f;
    return acc;
  },
  {} as Record<FeatureKey, FeatureDefinition>
);

// Dataset hours: 02:00 to 17:00 UTC (16 hours)
export const DATASET_HOURS_UTC: readonly number[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
] as const;

export function isValidDatasetHourUtc(hourUtc: number): boolean {
  return Number.isInteger(hourUtc) && hourUtc >= 2 && hourUtc <= 17;
}

// Egypt DST is active roughly last Friday of April through last Thursday of October (UTC+3), else UTC+2
export function getCairoUtcOffsetHours(dateStr?: string): 2 | 3 {
  if (!dateStr) return 2;
  const parts = dateStr.split('-').map(Number);
  const month = parts[1] || 1;
  if (month >= 5 && month <= 10) return 3;
  return 2;
}

export function formatDatasetHourLabel(
  hourUtc: number,
  dateStr?: string,
  isAr = false
): string {
  const offset = getCairoUtcOffsetHours(dateStr);
  const cairoHour = (hourUtc + offset) % 24;
  const utcStr = `${String(hourUtc).padStart(2, '0')}:00 UTC`;
  const cairoStr = `${String(cairoHour).padStart(2, '0')}:00`;
  return isAr
    ? `${utcStr} (${cairoStr} بتوقيت القاهرة UTC+${offset})`
    : `${utcStr} (${cairoStr} Cairo · UTC+${offset})`;
}

// Meteorological wind conversion:
// Direction d is where the wind blows FROM (0° = North, 90° = East).
// u = -s * sin(d), v = -s * cos(d)
export function windSpeedDirToUV(
  speedMs: number,
  directionDeg: number
): { u10: number; v10: number } {
  const s = Math.max(0, speedMs);
  const rad = ((directionDeg % 360) * Math.PI) / 180;
  const u10 = -s * Math.sin(rad);
  const v10 = -s * Math.cos(rad);
  return {
    u10: Math.abs(u10) < 1e-9 ? 0 : Math.round(u10 * 1000) / 1000,
    v10: Math.abs(v10) < 1e-9 ? 0 : Math.round(v10 * 1000) / 1000,
  };
}

export function windUVToSpeedDir(
  u10: number,
  v10: number
): { speedMs: number; directionDeg: number } {
  const speedMs = Math.hypot(u10, v10);
  if (speedMs < 1e-6) {
    return { speedMs: 0, directionDeg: 0 };
  }
  const rad = Math.atan2(-u10, -v10);
  const deg = ((rad * 180) / Math.PI + 360) % 360;
  return {
    speedMs: Math.round(speedMs * 100) / 100,
    directionDeg: Math.round(deg * 10) / 10,
  };
}

export function formVectorToDatasetVector(form: Record<FeatureKey, number>): FeatureVector23 {
  const out = {} as FeatureVector23;
  for (const def of FEATURES_23) {
    const raw = form[def.key];
    out[def.key] = def.formToDataset(Number.isFinite(raw) ? raw : 0);
  }
  return out;
}

export function datasetVectorToFormVector(dataset: FeatureVector23): Record<FeatureKey, number> {
  const out = {} as Record<FeatureKey, number>;
  for (const def of FEATURES_23) {
    const raw = dataset[def.key];
    const converted = def.datasetToForm(Number.isFinite(raw) ? raw : 0);
    const factor = 10 ** def.decimalsForm;
    out[def.key] = Math.round(converted * factor) / factor;
  }
  return out;
}

export function validateFormFeatureField(
  key: FeatureKey,
  formValue: number,
  isAr = false
): string | null {
  const def = FEATURE_MAP[key];
  if (!def) return isAr ? 'حقل غير معروف' : 'Unknown field';
  if (!Number.isFinite(formValue)) {
    return isAr ? 'يجب إدخال رقم صحيح' : 'Value must be a finite number';
  }
  const [min, max] = def.formRange;
  if (formValue < min || formValue > max) {
    return isAr
      ? `القيمة خارج النطاق المسموح (${min} إلى ${max} ${def.formUnit})`
      : `Out of valid range (${min} to ${max} ${def.formUnit})`;
  }
  return null;
}

export function checkCrossFieldWarnings(
  form: Record<FeatureKey, number>,
  isAr = false
): string[] {
  const warnings: string[] = [];
  if (form.fdir > form.ssrd + 5) {
    warnings.push(
      isAr
        ? `الإشعاع المباشر (fdir = ${form.fdir} W/m²) أكبر من الإشعاع الكلي الساقط (ssrd = ${form.ssrd} W/m²).`
        : `Direct solar radiation (fdir = ${form.fdir} W/m²) exceeds total downward solar radiation (ssrd = ${form.ssrd} W/m²).`
    );
  }
  if (form.ssrd > form.ssrdc + 15 && form.ssrdc > 0) {
    warnings.push(
      isAr
        ? `الإشعاع الكلي (ssrd = ${form.ssrd} W/m²) يتجاوز إشعاع السماء الصافية (ssrdc = ${form.ssrdc} W/m²).`
        : `Total downward solar radiation (ssrd = ${form.ssrd} W/m²) exceeds clear-sky radiation (ssrdc = ${form.ssrdc} W/m²).`
    );
  }
  const maxLayerCloud = Math.max(form.lcc, form.mcc, form.hcc);
  if (maxLayerCloud > form.tcc + 2) {
    warnings.push(
      isAr
        ? `إحدى طبقات السحب (المنخفضة/المتوسطة/العالية = ${maxLayerCloud}%) أعلى من الغطاء السحابي الكلي (tcc = ${form.tcc}%).`
        : `A cloud layer (low/medium/high = ${maxLayerCloud}%) exceeds total cloud cover (tcc = ${form.tcc}%).`
    );
  }
  if (form.d2m > form.t2m + 0.2) {
    warnings.push(
      isAr
        ? `نقطة الندى (d2m = ${form.d2m} °C) أعلى من درجة حرارة الهواء (t2m = ${form.t2m} °C).`
        : `Dew point (d2m = ${form.d2m} °C) exceeds air temperature (t2m = ${form.t2m} °C).`
    );
  }
  return warnings;
}

export function validateDatasetFeatureVector(raw: unknown): {
  valid: boolean;
  errorField?: FeatureKey;
  errorMessage?: string;
  vector?: FeatureVector23;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      errorMessage: 'Request body must include a `features` object containing all 23 ERA5 keys.',
    };
  }
  const obj = raw as Record<string, unknown>;
  const vector = {} as FeatureVector23;

  for (const def of FEATURES_23) {
    const val = obj[def.key];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return {
        valid: false,
        errorField: def.key,
        errorMessage: `Field '${def.key}' (${def.era5Name}) is required and must be a finite number in ${def.datasetUnit}.`,
      };
    }
    const [min, max] = def.datasetRange;
    // Allow small floating-point tolerance at boundaries
    const tol = Math.max(1e-4, (max - min) * 0.01);
    if (val < min - tol || val > max + tol) {
      return {
        valid: false,
        errorField: def.key,
        errorMessage: `Field '${def.key}' (${def.era5Name}) value ${val} is outside allowed range [${min}, ${max}] ${def.datasetUnit}.`,
      };
    }
    vector[def.key] = val;
  }

  return { valid: true, vector };
}

// Regional defaults for the 6 features without a live Open-Meteo source
export const REGIONAL_SIX_DEFAULTS_FORM: Record<
  RegionId,
  {
    strd: number;
    str: number;
    tco3: number;
    tciw: number;
    tclw: number;
  }
> = {
  'north-coast-delta': { strd: 355, str: -72, tco3: 292, tciw: 0.012, tclw: 0.038 },
  'western-desert': { strd: 340, str: -108, tco3: 276, tciw: 0.002, tclw: 0.004 },
  'sinai-red-sea': { strd: 348, str: -92, tco3: 282, tciw: 0.005, tclw: 0.014 },
  'nile-valley-upper-egypt': { strd: 362, str: -98, tco3: 278, tciw: 0.003, tclw: 0.006 },
};

export function getDayOfYearFromDateStr(dateStr: string): number {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0] || 2026;
  const m = parts[1] || 6;
  const d = parts[2] || 15;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const start = new Date(Date.UTC(y, 0, 0));
  return Math.max(1, Math.min(365, Math.floor((dt.getTime() - start.getTime()) / 86400000)));
}

export function getDatasetAverageFormVector(
  regionId: RegionId,
  dateStr: string,
  hourUtc: number
): {
  form: Record<FeatureKey, number>;
  provenance: FeatureProvenanceMap;
} {
  const region = SAVED_REGIONS[regionId] || SAVED_REGIONS['nile-valley-upper-egypt'];
  const doy = getDayOfYearFromDateStr(dateStr);
  const hourLocal = hourUtc + 2;
  const clearSky = calculateClearSky(
    region.representativePoint.lat,
    region.representativePoint.lon,
    doy,
    hourLocal
  );
  const ssrdc = Math.round(clearSky.ghiClearWm2);
  const ssrd = Math.round(ssrdc * 0.91);
  const fdir = Math.round(ssrd * 0.8);
  const ssr = Math.round(ssrd * (1 - region.albedo));
  const tisr = Math.round(
    clearSky.elevationDeg > 0
      ? 1361 * Math.sin((clearSky.elevationDeg * Math.PI) / 180)
      : 0
  );

  const seasonalWarmth = Math.sin(((doy - 105) / 365) * 2 * Math.PI);
  const diurnalPhase = Math.cos(((hourLocal - 13.5) / 24) * 2 * Math.PI);
  const baseMidTemp = region.summerPeakTempC - 9 + seasonalWarmth * 6.5;
  const t2m = Math.round((baseMidTemp + diurnalPhase * 5.2) * 10) / 10;
  const d2m =
    regionId === 'north-coast-delta'
      ? Math.round((t2m - 8.5) * 10) / 10
      : Math.round((t2m - 17.5) * 10) / 10;

  const { u10, v10 } = windSpeedDirToUV(4.2, 330);
  const six = REGIONAL_SIX_DEFAULTS_FORM[regionId] || REGIONAL_SIX_DEFAULTS_FORM['nile-valley-upper-egypt'];

  const form: Record<FeatureKey, number> = {
    t2m,
    u10,
    d2m,
    v10,
    tcc: regionId === 'north-coast-delta' ? 18 : 6,
    lcc: regionId === 'north-coast-delta' ? 10 : 2,
    mcc: 4,
    hcc: 5,
    sp: Math.round((1013 - region.representativePoint.elevationM * 0.11) * 10) / 10,
    tcwv: regionId === 'north-coast-delta' ? 24.5 : 13.5,
    ssrd,
    fdir,
    ssrdc,
    tp: 0,
    blh: clearSky.elevationDeg > 20 ? 1650 : 520,
    i10fg: 6.4,
    strd: six.strd,
    ssr,
    str: six.str,
    tco3: six.tco3,
    tciw: six.tciw,
    tclw: six.tclw,
    tisr,
  };

  const provenance = {} as FeatureProvenanceMap;
  for (const k of FEATURE_KEYS_23) {
    provenance[k] = k === 'ssrdc' ? 'calculated' : 'default';
  }

  return { form, provenance };
}

export interface WeatherPreset {
  id: 'clear_summer_noon' | 'spring_dust_day' | 'winter_coastal_cloud' | 'cool_clear_morning';
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  recommendedRegion: RegionId;
  dateStr: string;
  hourUtc: number;
  form: Record<FeatureKey, number>;
}

export const WEATHER_PRESETS: WeatherPreset[] = [
  {
    id: 'clear_summer_noon',
    nameEn: 'Clear Summer Noon',
    nameAr: 'ظهيرة صيفية صافية',
    descriptionEn: 'High irradiance (1,010 W/m²), 41°C ambient air, dry sky in Upper Egypt (10:00 UTC / 12:00 Cairo)',
    descriptionAr: 'إشعاع مرتفع (1010 W/m²)، حرارة هواء 41°م، وسماء جافة في الصعيد',
    recommendedRegion: 'nile-valley-upper-egypt',
    dateStr: '2026-06-21',
    hourUtc: 10,
    form: {
      t2m: 41.0,
      u10: 1.85,
      d2m: 11.5,
      v10: -3.2,
      tcc: 2,
      lcc: 0,
      mcc: 0,
      hcc: 2,
      sp: 1004.0,
      tcwv: 14.2,
      ssrd: 1010,
      fdir: 885,
      ssrdc: 1035,
      tp: 0,
      blh: 2450,
      i10fg: 5.8,
      strd: 395,
      ssr: 747,
      str: -115,
      tco3: 278,
      tciw: 0.001,
      tclw: 0.002,
      tisr: 1295,
    },
  },
  {
    id: 'spring_dust_day',
    nameEn: 'Spring Khamaseen Dust Day',
    nameAr: 'يوم عاصفة خماسين ربيعية',
    descriptionEn: 'High wind gusts (14.5 m/s), attenuated direct beam, heavy diffuse dust scattering',
    descriptionAr: 'هبات رياح قوية (14.5 م/ث)، انخفاض الإشعاع المباشر وتشتت الغبار',
    recommendedRegion: 'western-desert',
    dateStr: '2026-04-18',
    hourUtc: 10,
    form: {
      t2m: 36.5,
      u10: -6.8,
      d2m: 6.0,
      v10: 7.4,
      tcc: 35,
      lcc: 5,
      mcc: 18,
      hcc: 28,
      sp: 996.5,
      tcwv: 11.8,
      ssrd: 640,
      fdir: 295,
      ssrdc: 965,
      tp: 0,
      blh: 2800,
      i10fg: 14.5,
      strd: 382,
      ssr: 435,
      str: -85,
      tco3: 284,
      tciw: 0.008,
      tclw: 0.01,
      tisr: 1220,
    },
  },
  {
    id: 'winter_coastal_cloud',
    nameEn: 'Winter Coastal Cloud',
    nameAr: 'سحب شتوية ساحلية',
    descriptionEn: 'Mediterranean cloud cover (78%), cool 17.5°C sea breeze, light rain trace',
    descriptionAr: 'غطاء سحابي متوسطي (78%)، نسيم بحري معتدل 17.5°م، وأمطار خفيفة',
    recommendedRegion: 'north-coast-delta',
    dateStr: '2026-01-15',
    hourUtc: 10,
    form: {
      t2m: 17.5,
      u10: 4.1,
      d2m: 12.8,
      v10: -3.9,
      tcc: 78,
      lcc: 64,
      mcc: 42,
      hcc: 20,
      sp: 1016.5,
      tcwv: 22.4,
      ssrd: 285,
      fdir: 95,
      ssrdc: 590,
      tp: 0.4,
      blh: 780,
      i10fg: 9.2,
      strd: 342,
      ssr: 228,
      str: -42,
      tco3: 305,
      tciw: 0.025,
      tclw: 0.145,
      tisr: 820,
    },
  },
  {
    id: 'cool_clear_morning',
    nameEn: 'Cool Clear Morning',
    nameAr: 'صباح صافٍ معتدل',
    descriptionEn: 'Early morning ramp hour (06:00 UTC / 08:00 Cairo), crisp 21°C air and high module efficiency',
    descriptionAr: 'ساعة الصباح الباكر (06:00 UTC / 08:00 القاهرة)، هواء معتدل 21°م وكفاءة خلايا عالية',
    recommendedRegion: 'sinai-red-sea',
    dateStr: '2026-05-10',
    hourUtc: 6,
    form: {
      t2m: 21.0,
      u10: 2.1,
      d2m: 10.2,
      v10: -3.6,
      tcc: 5,
      lcc: 3,
      mcc: 2,
      hcc: 0,
      sp: 1009.0,
      tcwv: 15.0,
      ssrd: 465,
      fdir: 380,
      ssrdc: 490,
      tp: 0,
      blh: 890,
      i10fg: 5.5,
      strd: 330,
      ssr: 353,
      str: -88,
      tco3: 282,
      tciw: 0.002,
      tclw: 0.005,
      tisr: 685,
    },
  },
];
