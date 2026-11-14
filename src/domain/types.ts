// SolarSense Domain Contracts v2.0 (doc_representation_modifications)
// Framework-free TypeScript contracts for Digital Twin, 23-Feature Weather & Point Prediction

export type PanelTech = 'pc-Si' | 'a-Si:H/sc-Si' | 'CIGS';

export type RegionId =
  | 'north-coast-delta'
  | 'western-desert'
  | 'sinai-red-sea'
  | 'nile-valley-upper-egypt';

export type SkyCondition = 'clear' | 'dust' | 'cloud' | 'heatwave';

export type SeasonId = 'winter' | 'spring' | 'summer' | 'autumn';

export type FeatureKey =
  | 't2m'
  | 'u10'
  | 'd2m'
  | 'v10'
  | 'tcc'
  | 'lcc'
  | 'mcc'
  | 'hcc'
  | 'sp'
  | 'tcwv'
  | 'ssrd'
  | 'fdir'
  | 'ssrdc'
  | 'tp'
  | 'blh'
  | 'i10fg'
  | 'strd'
  | 'ssr'
  | 'str'
  | 'tco3'
  | 'tciw'
  | 'tclw'
  | 'tisr';

export type FeatureProvenance = 'api' | 'calculated' | 'default' | 'edited' | 'preset';

export type FeatureVector23 = Record<FeatureKey, number>;

export type FeatureProvenanceMap = Record<FeatureKey, FeatureProvenance>;

export interface SystemSpec {
  tech: PanelTech;
  panelCount: number;
  kWp: number;
  tiltDeg: number;
  azimuthDeg: number;
}

export interface SitePoint {
  lat: number;
  lon: number;
  cellLat: number;
  cellLon: number;
  cellId: string;
  inCoverage: boolean;
  distanceKm: number;
  region: RegionId;
  anchorName?: string;
}

export interface LiveWeatherObservation {
  timestamp: string;
  provider: 'open-meteo-live';
  shortwaveRadiationWm2: number; // ssrd equivalent
  directRadiationWm2: number; // fdir equivalent
  diffuseRadiationWm2: number;
  clearSkyRadiationWm2: number; // ssrdc equivalent
  temperature2mC: number; // t2m
  dewPoint2mC: number; // d2m
  windSpeed10mKmh: number;
  windSpeed10mMs: number;
  windDirectionDeg: number;
  cloudCoverPct: number; // tcc
  relativeHumidityPct: number;
  surfacePressureHpa: number; // sp
  precipitationMm: number; // tp
  dustAod: number;
}

export interface ForecastPoint {
  targetTime: string;
  hourLocal: number;
  solarElevationDeg: number;
  ghiWm2: number;
  tAmbC: number;
  tCellC: number;
  kc: number;
  pKw: number;
  p10Kw: number;
  p90Kw: number;
  pClearKw: number;
}

export interface ForecastResult {
  issueTime: string;
  horizonH: 1 | 6 | 24;
  mode: 'replay' | 'live';
  points: ForecastPoint[];
  source: 'stand-in' | 'model';
  modelVersion?: string;
}

export interface YieldResult {
  annualKwh: number;
  monthlyKwh: number[]; // 12 months Jan..Dec
  monthlySpecificKwhPerKwp: number[];
  specificYield: number; // kWh / kWp / yr
  performanceRatio: number;
  clearSkyAnnualKwh: number;
  source: 'stand-in' | 'atlas';
}

export interface PanelTechnologyInfo {
  key: PanelTech;
  shortKey: 'pc' | 'hjt' | 'cigs';
  nameEn: string;
  nameAr: string;
  subtitleEn: string;
  subtitleAr: string;
  efficiencyRange: string;
  efficiencyNominalPct: number;
  tempCoeffRange: string;
  tempCoeffPctPerC: number; // gamma, e.g. -0.42
  degradationPctPerYear: number;
  panelWp: number;
  panelAreaM2: number;
  noctC: number;
  areaPerKwpLabel: string;
  priceTier: '●○○' | '●●○' | '●●●';
  pricePerWpEgp: number;
  bestFitEn: string;
  bestFitAr: string;
  calloutsEn: string[];
  calloutsAr: string[];
}

export interface AnchorCity {
  id: string;
  nameEn: string;
  nameAr: string;
  lat: number;
  lon: number;
  region: RegionId;
  elevationM: number;
  noteEn: string;
  noteAr: string;
}

export interface RegionInfo {
  id: RegionId;
  regionNumber: number;
  code: 'R1' | 'R2' | 'R3' | 'R4';
  nameEn: string;
  nameAr: string;
  characterEn: string;
  characterAr: string;
  pvBehaviourEn: string;
  pvBehaviourAr: string;
  recommendedTech: PanelTech;
  recommendedReasonEn: string;
  recommendedReasonAr: string;
  color: string;
  avgAnnualGhiKwhM2: number;
  summerPeakTempC: number;
  dustRisk: 'Low' | 'Moderate' | 'High' | 'Extreme (Khamaseen)';
  albedo: number;
  representativePoint: {
    lat: number;
    lon: number;
    elevationM: number;
    labelEn: string;
    labelAr: string;
  };
  polygonCoords: [number, number][]; // [lon, lat] ring
}

export type WeatherEndpointKind = 'forecast' | 'recent' | 'archive';

export interface WeatherContractResponse {
  region: RegionId;
  regionNumber: number;
  representativePoint: {
    lat: number;
    lon: number;
    labelEn: string;
  };
  datetimeUtc: string;
  endpoint: WeatherEndpointKind;
  endpointLabelEn: string;
  endpointLabelAr: string;
  features: FeatureVector23;
  provenance: FeatureProvenanceMap;
  missing: FeatureKey[];
}

export interface PointPredictionRequest {
  region: RegionId;
  datetimeUtc: string;
  panelTech: PanelTech;
  features: FeatureVector23;
}

export interface PointPredictionResponse {
  prediction: {
    value: number;
    unit: string;
    specificKwPerKwp: number;
    referenceSystemKwp: number;
  };
  source: 'model' | 'stand-in';
  modelVersion?: string;
  physicsReference: {
    pClearKw: number;
    pPhysicsKw: number;
    gPoaWm2: number;
    tCellC: number;
    solarElevationDeg: number;
  };
  warnings: string[];
}
