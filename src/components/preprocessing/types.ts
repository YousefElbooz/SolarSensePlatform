export type Nullable = (number | null)[];

export interface PPSample {
  site: string;
  time: string;
  lat: number;
  lon: number;
  local_hour?: number;
  raw: Record<string, number>;
  clean: Record<string, number | null> | null;
}

export interface PPQuality {
  variable: string;
  min: number | null;
  mean: number | null;
  max: number | null;
  nan: number;
  nan_pct: number;
  core: boolean;
}

export interface PPHist {
  counts: number[];
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  p05: number;
  p95: number;
  zero_share: number;
}

export interface PPWeek {
  start: string;
  time: string[];
  local_hour: number[];
  series: Record<string, Nullable>;
  band: Record<string, { lo: number[]; hi: number[] }>;
}

export interface PPData {
  generated: string;
  grid: { lat: number[]; lon: number[] };
  report: {
    load: {
      files: number;
      folders: number;
      size_mb: number;
      accum_files: number;
      instant_files: number;
      raw_vars: { accum: string[]; instant: string[] };
      steps_accum: number;
      steps_instant: number;
      steps_merged: number;
      duplicates: number;
      n_lat: number;
      n_lon: number;
      cells: number;
      lat_range: [number, number];
      lon_range: [number, number];
      resolution_deg: number;
    };
    time: {
      start: string;
      end: string;
      steps: number;
      days: number;
      utc_hours: number[];
      step_sizes: { step_hours: number; count: number }[];
      gaps: { after: string; before: string; days: number }[];
    };
    units: { negative_clipped: Record<string, number>; fdir_gt_ssrd: number; total_values: number };
    local: {
      tz: string;
      window: [number, number];
      steps_before: number;
      steps_after: number;
      per_local_hour: { hour: number; count: number; kept: boolean }[];
    };
    features: { added: string[]; rows: number; steps: number };
  };
  samples: PPSample[];
  quality: PPQuality[];
  maps: {
    months: number[];
    hours: number[];
    by_month: Record<string, number[][]>;
    by_hour: Record<string, number[][]>;
    mean: Record<string, number[]>;
  };
  timeseries: { dates: string[]; daily: Record<string, Nullable>; weeks: PPWeek[] };
  diurnal: { hours: number[]; mean: Record<string, number[]>; std: Record<string, number[]> };
  profiles: { lon: number[]; lat: number[]; by_lon: Record<string, number[]>; by_lat: Record<string, number[]> };
  distributions: { sample: number; hist: Record<string, PPHist> };
  correlation: { vars: string[]; matrix: number[][] };
}
