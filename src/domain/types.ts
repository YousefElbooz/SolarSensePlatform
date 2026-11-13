// SolarSense Domain Contracts v1.0
// Framework-free TypeScript module shared by Next.js (Option A) and NestJS (Option B)

export type PanelTech = 'pc-Si' | 'a-Si:H/sc-Si' | 'CIGS';

export type RegionId =
  | 'north-coast-delta'
  | 'western-desert'
  | 'sinai-red-sea'
  | 'nile-valley-upper-egypt';

export type BindingLimit = 'area' | 'budget' | 'demand';

export type SkyCondition = 'clear' | 'dust' | 'cloud' | 'heatwave';

export type SeasonId = 'winter' | 'spring' | 'summer' | 'autumn';

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
  provider: 'open-meteo-live' | 'era5-replay-fallback';
  shortwaveRadiationWm2: number; // ssrd equivalent
  directRadiationWm2: number; // fdir equivalent
  diffuseRadiationWm2: number;
  clearSkyRadiationWm2: number; // ssrdc equivalent
  temperature2mC: number; // t2m
  dewPoint2mC: number; // d2m
  windSpeed10mKmh: number; // derived from u10, v10
  windSpeed10mMs: number;
  windDirectionDeg: number;
  cloudCoverPct: number; // tcc
  relativeHumidityPct: number;
  surfacePressureHpa: number; // sp
  precipitationMm: number; // tp
  dustAod: number; // Khamaseen / aerosol optical depth indicator
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
  source: 'mock' | 'model';
  modelName: string;
  modelVersion: string;
}

export interface YieldResult {
  annualKwh: number;
  monthlyKwh: number[]; // 12 months Jan..Dec
  monthlySpecificKwhPerKwp: number[];
  specificYield: number; // kWh / kWp / yr
  performanceRatio: number;
  clearSkyAnnualKwh: number;
  source: 'mock' | 'atlas';
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
  polygonCoords: [number, number][]; // [lon, lat] ring
}

export interface TechComparisonRow {
  tech: PanelTech;
  nameEn: string;
  nameAr: string;
  panelCount: number;
  panelUnitPriceEgp: number;
  kWp: number;
  roofAreaUsedM2: number;
  capexEgp: number;
  itemizedCost: {
    panelsEgp: number;
    inverterEgp: number;
    mountingEgp: number;
    installationEgp: number;
  };
  annualKwh: number;
  monthlyKwh: number[];
  specificYield: number;
  performanceRatio: number;
  annualSavingEgp: number;
  billCoveragePct: number;
  simplePaybackYears: number;
  npv25YrEgp: number;
  co2AvoidedKgYear: number;
  bindingLimit: BindingLimit;
  isRecommendedForRegion: boolean;
}

export interface EnhancerRecommendation {
  id: string;
  titleEn: string;
  titleAr: string;
  recommended: boolean;
  priority: 'high' | 'medium' | 'optional';
  badgeEn: string;
  badgeAr: string;
  reasonEn: string;
  reasonAr: string;
  impactMetric: string;
  estimatedCostEgp?: number;
}

export interface AssessmentInput {
  tech: PanelTech;
  lat: number;
  lon: number;
  usableAreaM2: number;
  budgetEgp: number;
  panelCount?: number;
  panelUnitPriceEgp?: number;
  monthlyBillEgp: number;
  daytimeSharePct: number;
  sector: 'residential' | 'commercial';
}

export interface AssessmentResult {
  id: string;
  createdAt: string;
  site: SitePoint;
  regionInfo: RegionInfo;
  input: AssessmentInput;
  monthlyDemandKwh: number;
  chosen: TechComparisonRow;
  allTechnologies: TechComparisonRow[]; // pc-Si, a-Si:H/sc-Si, CIGS side by side
  sensitivity: {
    plus20PctBudget: { panelCount: number; kWp: number; annualKwh: number; paybackYears: number };
    plus10M2Area: { panelCount: number; kWp: number; annualKwh: number; paybackYears: number };
  };
  cashflow25Years: { year: number; cumulativeNetEgp: number; annualSavingEgp: number }[];
  enhancers: EnhancerRecommendation[];
  assumptions: {
    version: string;
    date: string;
    tariffSource: string;
    effectiveTariffEgpPerKwh: number;
    gridEmissionFactorKgCo2PerKwh: number;
    discountRatePct: number;
    annualTariffEscalationPct: number;
    packingFactor: number;
    systemLossesPct: number;
  };
  predictionSource: 'mock-physics-atlas' | 'pvlib-ml-service';
}

export interface FlexibleLoadItem {
  id: string;
  siteId: string;
  name: string;
  category: 'pump' | 'hvac' | 'battery' | 'sterilizer' | 'ev';
  powerKw: number;
  durationH: number;
  earliestHour: number; // e.g., 7
  deadlineHour: number; // e.g., 17
  priority: 1 | 2 | 3;
}

export interface ScheduleWindowResult {
  loadId: string;
  loadName: string;
  powerKw: number;
  durationH: number;
  recommendedStartHour: number;
  recommendedEndHour: number;
  windowLabel: string;
  requiredEnergyKwh: number;
  expectedSolarSurplusKwh: number;
  p10GuaranteedSolarKwh: number;
  solarCoveragePct: number;
  p10CoveragePct: number;
  riskLevel: 'low' | 'medium' | 'high';
  dieselAvoidedLiters: number;
  costSavedEgp: number;
  rationale: string;
  validatedByEngine: boolean;
}

export interface ModelBenchmarkEntry {
  modelKey: 'persistence' | 'smart_persistence' | 'cliper' | 'xgb' | 'lstm' | 'pgnn';
  modelName: string;
  region: RegionId | 'all';
  horizonH: 1 | 6 | 24;
  stratum: 'overall' | 'clear' | 'dust_khamaseen' | 'coastal_cloud' | 'ramp_hours';
  maeKw: number;
  rmseKw: number;
  nMaePct: number; // normalized by 1000 kW rated capacity
  nRmsePct: number; // normalized by 1000 kW rated capacity
  mbeKw: number;
  r2Daytime: number;
  skillVsSmartPersistencePct: number;
  skillVsCliperPct: number;
  physicallyInvalidPredictionsPct: number;
  dmTestPValueVsSmartPers: number;
}

export interface ToolCallTrace {
  id: string;
  toolName:
    | 'get_forecast'
    | 'get_actuals'
    | 'get_clear_sky'
    | 'compare_periods'
    | 'get_model_skill'
    | 'recommend_window';
  args: Record<string, unknown>;
  outputSummary: string;
  rawOutput: Record<string, unknown>;
  durationMs: number;
}

export interface AssistantReply {
  messageId: string;
  createdAt: string;
  answerMarkdown: string;
  sources: string[]; // tool_call_ids
  toolTraces: ToolCallTrace[];
  riskBanner?: {
    level: 'low' | 'medium' | 'high';
    note: string;
  };
}

