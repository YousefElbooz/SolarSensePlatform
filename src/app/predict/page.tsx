'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar, useLanguage } from '@/components/Navbar';
import { GlobeLocationModal } from '@/components/GlobeLocationModal';
import {
  DATASET_HOURS_UTC,
  FEATURES_23,
  FEATURE_GROUPS,
  WEATHER_PRESETS,
  checkCrossFieldWarnings,
  datasetVectorToFormVector,
  formatDatasetHourLabel,
  formVectorToDatasetVector,
  getDatasetAverageFormVector,
  validateFormFeatureField,
  windSpeedDirToUV,
  windUVToSpeedDir,
} from '@/domain/features';
import { PANEL_TECH_LIST, normalizePanelTech } from '@/domain/panels';
import { isValidRegionId, snapToSavedRegion } from '@/domain/regions';
import { SAVED_REGIONS, SAVED_REGION_LIST } from '@/domain/regions.config';
import {
  FeatureKey,
  FeatureProvenance,
  FeatureProvenanceMap,
  PanelTech,
  PointPredictionRequest,
  PointPredictionResponse,
  RegionId,
  WeatherContractResponse,
} from '@/domain/types';
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudSun,
  Globe2,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';

function provenanceBadgeStyle(p: FeatureProvenance): string {
  switch (p) {
    case 'api':
      return 'border-[#30d158]/45 bg-[#30d158]/15 text-[#30d158]';
    case 'calculated':
      return 'border-[#3fc1c1]/45 bg-[#3fc1c1]/15 text-[#9fe9e9]';
    case 'default':
      return 'border-white/20 bg-white/[0.08] text-[#b9bdcf]';
    case 'edited':
      return 'border-[#ffd60a]/55 bg-[#ffd60a]/18 text-[#ffd60a]';
    case 'preset':
      return 'border-[#60a5fa]/45 bg-[#60a5fa]/15 text-[#93c5fd]';
  }
}

function provenanceBadgeText(p: FeatureProvenance, isAr: boolean): string {
  switch (p) {
    case 'api':
      return isAr ? 'API' : 'API';
    case 'calculated':
      return isAr ? 'محسوب' : 'Calculated';
    case 'default':
      return isAr ? 'متوسط البيانات' : 'Dataset average';
    case 'edited':
      return isAr ? 'مُعدّل' : 'Edited';
    case 'preset':
      return isAr ? 'نموذج جاهز' : 'Preset';
  }
}

function PredictTestContent() {
  const { isAr } = useLanguage();
  const searchParams = useSearchParams();

  const initialMode = searchParams.get('mode') === 'map' ? 'map' : 'manual';
  const initialRegionParam = searchParams.get('region');
  const initialRegion: RegionId = isValidRegionId(initialRegionParam)
    ? initialRegionParam
    : 'nile-valley-upper-egypt';
  const initialTech: PanelTech = normalizePanelTech(searchParams.get('tech'));

  const { todayIso, maxDateIso } = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const max = new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10);
    return { todayIso: today, maxDateIso: max };
  }, []);

  const [tab, setTab] = useState<'manual' | 'map'>(initialMode);
  const [region, setRegion] = useState<RegionId>(initialRegion);
  const [dateStr, setDateStr] = useState<string>(todayIso);
  const [hourUtc, setHourUtc] = useState<number>(10);
  const [panelTech, setPanelTech] = useState<PanelTech>(initialTech);

  // Initialize form with dataset averages for initial region, date, and hour
  const initialBaseline = useMemo(
    () => getDatasetAverageFormVector(initialRegion, todayIso, 10),
    [initialRegion, todayIso]
  );

  const [formValues, setFormValues] = useState<Record<FeatureKey, number>>(initialBaseline.form);
  const [provenance, setProvenance] = useState<FeatureProvenanceMap>(initialBaseline.provenance);
  const [fieldsClearedDueToError, setFieldsClearedDueToError] = useState<boolean>(false);

  // Wind speed & direction UI controls synced with u10 & v10
  const [windSpeedMs, setWindSpeedMs] = useState<number>(() => {
    const { speedMs } = windUVToSpeedDir(initialBaseline.form.u10, initialBaseline.form.v10);
    return speedMs;
  });
  const [windDirectionDeg, setWindDirectionDeg] = useState<number>(() => {
    const { directionDeg } = windUVToSpeedDir(initialBaseline.form.u10, initialBaseline.form.v10);
    return directionDeg;
  });

  // Map & Weather API state
  const [globeOpen, setGlobeOpen] = useState<boolean>(false);
  const [globeAutoLocate, setGlobeAutoLocate] = useState<boolean>(false);
  const [mapSnapNotice, setMapSnapNotice] = useState<{
    accepted: boolean;
    text: string;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherEndpointLabel, setWeatherEndpointLabel] = useState<string | null>(null);

  // Prediction state
  const [predictLoading, setPredictLoading] = useState<boolean>(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<PointPredictionResponse | null>(null);
  const [lastRequestSent, setLastRequestSent] = useState<PointPredictionRequest | null>(null);
  const [jsonInspectorOpen, setJsonInspectorOpen] = useState<boolean>(false);

  const regionInfo = SAVED_REGIONS[region];

  // Field-level range errors
  const fieldErrors = useMemo(() => {
    const errs: Partial<Record<FeatureKey, string>> = {};
    for (const f of FEATURES_23) {
      const msg = validateFormFeatureField(f.key, formValues[f.key], isAr);
      if (msg) errs[f.key] = msg;
    }
    return errs;
  }, [formValues, isAr]);

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  // Cross-field physical warnings (non-blocking)
  const crossWarnings = useMemo(
    () => (fieldsClearedDueToError ? [] : checkCrossFieldWarnings(formValues, isAr)),
    [formValues, isAr, fieldsClearedDueToError]
  );

  // Dataset-unit feature vector ready to send to POST /api/predict
  const datasetVector = useMemo(() => formVectorToDatasetVector(formValues), [formValues]);

  const handleFieldChange = (key: FeatureKey, rawValue: string) => {
    const num = rawValue.trim() === '' ? NaN : Number(rawValue);
    setFieldsClearedDueToError(false);
    setFormValues((prev) => {
      const next = { ...prev, [key]: num };
      if (key === 'u10' || key === 'v10') {
        const u = key === 'u10' ? num : prev.u10;
        const v = key === 'v10' ? num : prev.v10;
        if (Number.isFinite(u) && Number.isFinite(v)) {
          const sd = windUVToSpeedDir(u, v);
          setWindSpeedMs(sd.speedMs);
          setWindDirectionDeg(sd.directionDeg);
        }
      }
      return next;
    });
    setProvenance((prev) => ({ ...prev, [key]: 'edited' }));
  };

  const handleWindSpeedDirChange = (nextSpeed: number, nextDir: number) => {
    setWindSpeedMs(nextSpeed);
    setWindDirectionDeg(nextDir);
    setFieldsClearedDueToError(false);
    if (Number.isFinite(nextSpeed) && Number.isFinite(nextDir)) {
      const { u10, v10 } = windSpeedDirToUV(nextSpeed, nextDir);
      setFormValues((prev) => ({ ...prev, u10, v10 }));
      setProvenance((prev) => ({ ...prev, u10: 'edited', v10: 'edited' }));
    }
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = WEATHER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setRegion(preset.recommendedRegion);
    setDateStr(preset.dateStr);
    setHourUtc(preset.hourUtc);
    setFormValues({ ...preset.form });
    const sd = windUVToSpeedDir(preset.form.u10, preset.form.v10);
    setWindSpeedMs(sd.speedMs);
    setWindDirectionDeg(sd.directionDeg);
    const nextProv = {} as FeatureProvenanceMap;
    for (const f of FEATURES_23) {
      nextProv[f.key] = 'preset';
    }
    setProvenance(nextProv);
    setFieldsClearedDueToError(false);
    setWeatherError(null);
    setWeatherEndpointLabel(isAr ? `نموذج جاهز: ${preset.nameAr}` : `Preset: ${preset.nameEn}`);
  };

  const handleResetToDatasetAverage = useCallback(() => {
    const base = getDatasetAverageFormVector(region, dateStr, hourUtc);
    setFormValues(base.form);
    setProvenance(base.provenance);
    const sd = windUVToSpeedDir(base.form.u10, base.form.v10);
    setWindSpeedMs(sd.speedMs);
    setWindDirectionDeg(sd.directionDeg);
    setFieldsClearedDueToError(false);
    setWeatherError(null);
    setWeatherEndpointLabel(isAr ? 'متوسطات بيانات التدريب' : 'Dataset averages');
  }, [region, dateStr, hourUtc, isAr]);

  const handleFetchWeather = async () => {
    setWeatherLoading(true);
    setWeatherError(null);
    setPredictError(null);

    try {
      const res = await fetch(
        `/api/weather?region=${encodeURIComponent(region)}&date=${encodeURIComponent(dateStr)}&hour=${hourUtc}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const contract = data as WeatherContractResponse;
      const convertedForm = datasetVectorToFormVector(contract.features);
      setFormValues(convertedForm);
      setProvenance(contract.provenance);
      const sd = windUVToSpeedDir(convertedForm.u10, convertedForm.v10);
      setWindSpeedMs(sd.speedMs);
      setWindDirectionDeg(sd.directionDeg);
      setFieldsClearedDueToError(false);
      setWeatherEndpointLabel(isAr ? contract.endpointLabelAr : contract.endpointLabelEn);
    } catch (err) {
      // Section 6.3 rule: If the weather request fails, say so and leave the fields empty for manual entry.
      // Do not fill in plausible values silently.
      const msg = err instanceof Error ? err.message : 'Weather request failed.';
      setWeatherError(msg);
      setWeatherEndpointLabel(null);
      setFieldsClearedDueToError(true);
      const emptyForm = {} as Record<FeatureKey, number>;
      for (const f of FEATURES_23) {
        emptyForm[f.key] = NaN;
      }
      setFormValues(emptyForm);
      setWindSpeedMs(NaN);
      setWindDirectionDeg(NaN);
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleRunPrediction = useCallback(async () => {
    if (hasFieldErrors) {
      setPredictError(
        isAr
          ? 'يرجى تصحيح الحقول التي تحتوي على أخطاء قبل تشغيل التنبؤ.'
          : 'Please fix the highlighted out-of-range or empty fields before running the prediction.'
      );
      return;
    }

    setPredictLoading(true);
    setPredictError(null);

    const payload: PointPredictionRequest = {
      region,
      datetimeUtc: `${dateStr}T${String(hourUtc).padStart(2, '0')}:00:00Z`,
      panelTech,
      features: formVectorToDatasetVector(formValues),
    };
    setLastRequestSent(payload);

    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setPredictionResult(data as PointPredictionResponse);
    } catch (err) {
      setPredictError(err instanceof Error ? err.message : 'Prediction request failed.');
    } finally {
      setPredictLoading(false);
    }
  }, [hasFieldErrors, isAr, region, dateStr, hourUtc, panelTech, formValues]);

  // Run initial prediction once on mount so the result panel is immediately informative
  useEffect(() => {
    handleRunPrediction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const twinUrl = useMemo(() => {
    const ghi = Number.isFinite(formValues.ssrd) ? Math.round(formValues.ssrd) : 850;
    const tamb = Number.isFinite(formValues.t2m) ? formValues.t2m : 32;
    const wind = Number.isFinite(windSpeedMs) ? windSpeedMs : 3.8;
    const cloud = Number.isFinite(formValues.tcc) ? formValues.tcc : 5;
    return `/twin?region=${region}&date=${dateStr}&hour=${hourUtc}&tech=${encodeURIComponent(panelTech)}&ghi=${ghi}&tamb=${tamb}&wind=${wind}&cloud=${cloud}`;
  }, [region, dateStr, hourUtc, panelTech, formValues.ssrd, formValues.t2m, formValues.tcc, windSpeedMs]);

  return (
    <div className="cinematic-page pb-24 pt-6">
      <Navbar clockLabel={`${String(hourUtc).padStart(2, '0')}:00 UTC · Prediction Test`} />

      <div className="mx-auto max-w-[1480px] px-4 sm:px-6">
        {/* Header & Mode Switch */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">
              {isAr ? 'اختبار نموذج التنبؤ · 23 متغيراً من ERA5' : 'Prediction Model Test Bench · 23 ERA5 Features'}
            </div>
            <h1 className="mt-1.5 font-serif text-[clamp(26px,3.4vw,42px)] leading-[1.08] text-white">
              {isAr
                ? 'اختبر التنبؤ بالساعة عبر الإدخال اليدوي أو خريطة الطقس'
                : 'Test single-hour solar predictions by hand or from live weather'}
            </h1>
            <p className="mt-1.5 max-w-[760px] text-sm text-[#b9bdcf]">
              {isAr
                ? 'تُعرض الحقول بوحدات مألوفة (°C, W/m², hPa, %) وتُحول تلقائياً إلى وحدات بيانات التدريب (K, J/m², Pa, 0–1) عند إرسالها إلى النموذج.'
                : 'Fields are shown in friendly units (°C, W/m², hPa, %) and converted in one place (features.ts) to exact ERA5 dataset units (K, J/m², Pa, 0–1) before calling the model.'}
            </p>
          </div>

          {/* Apple-style Segmented Control for Tab A (Manual) vs Tab B (Map + Weather) */}
          <div
            role="tablist"
            aria-label="Prediction input mode"
            className="apple-segmented"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'manual'}
              onClick={() => setTab('manual')}
              className={`apple-segment-btn flex items-center gap-2 ${
                tab === 'manual' ? 'apple-segment-btn-active' : ''
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>{isAr ? 'أ. إدخال يدوي (Manual)' : 'Tab A · Manual entry'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'map'}
              onClick={() => setTab('map')}
              className={`apple-segment-btn flex items-center gap-2 ${
                tab === 'map' ? 'apple-segment-btn-active' : ''
              }`}
            >
              <Globe2 className="h-3.5 w-3.5" />
              <span>{isAr ? 'ب. الخريطة + الطقس (Map + API)' : 'Tab B · Map + weather'}</span>
            </button>
          </div>
        </div>

        {/* Shared Inputs Bar (Section 6.1: Region, Date, Hour 02-17 UTC, Panel Technology) */}
        <div className="glass mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Saved Region Dropdown */}
          <div>
            <label
              htmlFor="select-region"
              className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-[#b9bdcf]"
            >
              {isAr ? 'المنطقة المحفوظة (Saved Region)' : 'Saved Region'}
            </label>
            <select
              id="select-region"
              value={region}
              onChange={(e) => {
                const nextReg = e.target.value as RegionId;
                setRegion(nextReg);
              }}
              className="w-full rounded-xl border border-white/15 bg-[#0c1020] px-3 py-2 text-sm font-medium text-white focus:border-[#ffd60a] focus:outline-none"
            >
              {SAVED_REGION_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {isAr ? r.nameAr : r.nameEn}
                </option>
              ))}
            </select>
            <div className="mt-1 text-[11px] text-[#8e93a8]">
              {isAr
                ? `النقطة المرجعية: ${regionInfo.representativePoint.lat.toFixed(2)}°N, ${regionInfo.representativePoint.lon.toFixed(2)}°E`
                : `Representative cell: ${regionInfo.representativePoint.lat.toFixed(2)}° N, ${regionInfo.representativePoint.lon.toFixed(2)}° E`}
            </div>
          </div>

          {/* 2. Date Picker (2020-01-01 to today + 15 days) */}
          <div>
            <label
              htmlFor="select-date"
              className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-[#b9bdcf]"
            >
              {isAr ? 'التاريخ (2020 إلى +15 يوم)' : 'Date (2020-01-01 to +15d)'}
            </label>
            <input
              id="select-date"
              type="date"
              min="2020-01-01"
              max={maxDateIso}
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0c1020] px-3 py-2 font-mono text-sm text-white focus:border-[#ffd60a] focus:outline-none"
            />
            <div className="mt-1 text-[11px] text-[#8e93a8]">
              {dateStr >= todayIso
                ? isAr
                  ? 'نطاق التوقعات الجوية (Forecast)'
                  : 'Forecast window (Open-Meteo forecast)'
                : isAr
                  ? 'نطاق الطقس التاريخي / الحديث'
                  : 'Past date (Recent / ERA5 Reanalysis)'}
            </div>
          </div>

          {/* 3. Hour Dropdown (Only the 16 dataset hours: 02:00–17:00 UTC) */}
          <div>
            <label
              htmlFor="select-hour"
              className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-[#b9bdcf]"
            >
              {isAr ? 'ساعة البيانات (02:00–17:00 UTC)' : 'Dataset Hour (02:00–17:00 UTC)'}
            </label>
            <select
              id="select-hour"
              value={hourUtc}
              onChange={(e) => setHourUtc(Number(e.target.value))}
              className="w-full rounded-xl border border-white/15 bg-[#0c1020] px-3 py-2 font-mono text-sm text-white focus:border-[#ffd60a] focus:outline-none"
            >
              {DATASET_HOURS_UTC.map((h) => (
                <option key={h} value={h}>
                  {formatDatasetHourLabel(h, dateStr, isAr)}
                </option>
              ))}
            </select>
            <div className="mt-1 text-[11px] text-[#8e93a8]">
              {isAr
                ? 'تُرسل الساعة بالتوقيت العالمي UTC للنموذج'
                : 'Sent as UTC to the weather API and model'}
            </div>
          </div>

          {/* 4. Panel Technology Switch */}
          <div>
            <div className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-[#b9bdcf]">
              {isAr ? 'تكنولوجيا اللوح الشمسي' : 'Panel Technology'}
            </div>
            <div className="apple-segmented w-full">
              {PANEL_TECH_LIST.map((t) => {
                const active = t.key === panelTech;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setPanelTech(t.key)}
                    className={`apple-segment-btn flex-1 text-center text-xs ${
                      active ? 'apple-segment-btn-active' : ''
                    }`}
                  >
                    {t.key}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 text-[11px] text-[#8e93a8]">
              {isAr ? 'تُستخدم في المرجع الفيزيائي والنموذج' : 'Used for physics reference & model'}
            </div>
          </div>
        </div>

        {/* Mode-Specific Action Bar */}
        {tab === 'manual' ? (
          <div className="glass mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-[0.08em] text-[#ffd166]">
                <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                {isAr ? 'نماذج جاهزة للتجربة:' : 'Demonstration Presets:'}
              </span>
              {WEATHER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p.id)}
                  title={isAr ? p.descriptionAr : p.descriptionEn}
                  className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition hover:border-[#ffd60a] hover:bg-[#ffd60a]/15"
                >
                  {isAr ? p.nameAr : p.nameEn}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleResetToDatasetAverage}
              className="btn-pill py-1.5 px-3.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>
                {isAr ? 'إعادة لمتوسط بيانات المنطقة' : 'Reset to dataset average'}
              </span>
            </button>
          </div>
        ) : (
          <div className="glass mb-6 flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setGlobeAutoLocate(false);
                    setGlobeOpen(true);
                  }}
                  className="btn-pill"
                >
                  <Globe2 className="h-4 w-4 text-[#3fc1c1]" />
                  <span>{isAr ? 'اختر موقعاً على الخريطة 3D' : 'Pick location on 3D Map'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGlobeAutoLocate(true);
                    setGlobeOpen(true);
                  }}
                  className="btn-pill"
                >
                  <span>{isAr ? 'تحديد موقعي تلقائياً' : 'Detect my position'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFetchWeather}
                  disabled={weatherLoading}
                  className="btn-pill-primary"
                >
                  <CloudSun className="h-4 w-4" />
                  <span>
                    {weatherLoading
                      ? isAr
                        ? 'جاري جلب الطقس...'
                        : 'Fetching weather...'
                      : isAr
                        ? 'جلب الطقس للمنطقة والتاريخ والساعة'
                        : 'Get weather for region, date & hour'}
                  </span>
                </button>
              </div>

              {weatherEndpointLabel && (
                <div className="flex items-center gap-2">
                  <span className="tag-pill live">{weatherEndpointLabel}</span>
                </div>
              )}
            </div>

            {mapSnapNotice && (
              <div
                className={`rounded-xl border px-3.5 py-2 text-xs ${
                  mapSnapNotice.accepted
                    ? 'border-[#3fc1c1]/45 bg-[#3fc1c1]/10 text-[#9fe9e9]'
                    : 'border-[#ff9f0a]/55 bg-[#ff9f0a]/15 text-[#ffd166]'
                }`}
              >
                {mapSnapNotice.text}
              </div>
            )}

            {weatherError && (
              <div className="rounded-xl border border-[#ff453a]/60 bg-[#ff453a]/15 px-4 py-3 text-xs text-white">
                <div className="font-semibold text-[#ff6961]">
                  {isAr ? 'فشل جلب بيانات الطقس' : 'Weather API request failed'}
                </div>
                <p className="mt-1 text-[#f4f5fa]">{weatherError}</p>
                <p className="mt-1 text-[#b9bdcf]">
                  {isAr
                    ? 'تُركت الحقول فارغة للإدخال اليدوي (لا يتم تعبئة قيم افتراضية صامتة عند فشل الاتصال).'
                    : 'Fields have been left empty for manual entry (no silent fallback values are invented when the weather request fails).'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Main 2-Column Layout: Left = 23 Weather Inputs (6 Groups), Right = Sticky Result Panel */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          {/* LEFT: 23 WEATHER FEATURES IN 6 GROUPS */}
          <div className="grid gap-4">
            {FEATURE_GROUPS.map((grp) => {
              const groupFeatures = FEATURES_23.filter((f) => f.group === grp.id);
              return (
                <section key={grp.id} className="glass p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.12] pb-2.5">
                    <div>
                      <h2 className="font-serif text-[20px] font-semibold text-white">
                        {isAr ? grp.titleAr : grp.titleEn}
                      </h2>
                      <p className="text-xs text-[#b9bdcf]">
                        {isAr ? grp.subtitleAr : grp.subtitleEn}
                      </p>
                    </div>
                  </div>

                  {/* Special Wind Speed + Direction Helper inside Group 2 (wind) */}
                  {grp.id === 'wind' && (
                    <div className="mb-4 rounded-xl border border-[#3fc1c1]/30 bg-[#3fc1c1]/[0.06] p-3.5">
                      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#9fe9e9]">
                        {isAr
                          ? 'إدخال الرياح كسرعة واتجاه (يحسب u10 و v10 تلقائياً)'
                          : 'Wind Speed & Direction Helper (computes u10 = −s·sin(d), v10 = −s·cos(d))'}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="wind-speed-input"
                            className="mb-1 block text-xs text-[#b9bdcf]"
                          >
                            {isAr ? 'سرعة الرياح (10م) [m/s]' : '10m Wind Speed [m/s]'}
                          </label>
                          <input
                            id="wind-speed-input"
                            type="number"
                            min={0}
                            max={45}
                            step={0.1}
                            value={Number.isFinite(windSpeedMs) ? windSpeedMs : ''}
                            onChange={(e) =>
                              handleWindSpeedDirChange(
                                Number(e.target.value),
                                Number.isFinite(windDirectionDeg) ? windDirectionDeg : 0
                              )
                            }
                            className="w-full rounded-xl border border-white/15 bg-[#090d1a] px-3 py-1.5 font-mono text-sm text-white focus:border-[#ffd60a] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="wind-dir-input"
                            className="mb-1 block text-xs text-[#b9bdcf]"
                          >
                            {isAr
                              ? 'اتجاه الرياح (من أين تهب 0–360°)'
                              : 'Wind Direction (from 0–360°)'}
                          </label>
                          <input
                            id="wind-dir-input"
                            type="number"
                            min={0}
                            max={360}
                            step={5}
                            value={Number.isFinite(windDirectionDeg) ? windDirectionDeg : ''}
                            onChange={(e) =>
                              handleWindSpeedDirChange(
                                Number.isFinite(windSpeedMs) ? windSpeedMs : 0,
                                Number(e.target.value)
                              )
                            }
                            className="w-full rounded-xl border border-white/15 bg-[#090d1a] px-3 py-1.5 font-mono text-sm text-white focus:border-[#ffd60a] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {groupFeatures.map((f) => {
                      const val = formValues[f.key];
                      const prov = provenance[f.key] || 'default';
                      const err = fieldErrors[f.key];
                      const datasetVal = datasetVector[f.key];

                      return (
                        <div
                          key={f.key}
                          className={`rounded-xl border p-3 transition ${
                            err
                              ? 'border-[#ff453a]/70 bg-[#ff453a]/10'
                              : 'border-white/[0.1] bg-white/[0.03]'
                          }`}
                        >
                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <div>
                              <label
                                htmlFor={`field-${f.key}`}
                                className="block text-[13px] font-medium text-white"
                              >
                                {isAr ? f.labelAr : f.labelEn}
                              </label>
                              <div className="font-mono text-[10.5px] text-[#8e93a8]">
                                #{f.index} · <span className="text-[#9fe9e9]">{f.key}</span> (
                                {f.era5Name})
                              </div>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${provenanceBadgeStyle(
                                prov
                              )}`}
                            >
                              {provenanceBadgeText(prov, isAr)}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <input
                              id={`field-${f.key}`}
                              type="number"
                              min={f.formRange[0]}
                              max={f.formRange[1]}
                              step={f.step}
                              placeholder={`${f.formRange[0]}..${f.formRange[1]}`}
                              value={Number.isFinite(val) ? val : ''}
                              onChange={(e) => handleFieldChange(f.key, e.target.value)}
                              className="w-full rounded-xl border border-white/15 bg-[#090d1a] px-3 py-1.5 font-mono text-sm font-semibold text-white focus:border-[#ffd60a] focus:outline-none"
                            />
                            <span className="shrink-0 font-mono text-xs font-semibold text-[#ffd166]">
                              {f.formUnit}
                            </span>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#8e93a8]">
                            <span>
                              {isAr ? 'النطاق:' : 'Valid:'} {f.formRange[0]} .. {f.formRange[1]}{' '}
                              {f.formUnit}
                            </span>
                            {Number.isFinite(val) && f.datasetUnit !== f.formUnit && (
                              <span className="font-mono text-[10.5px] text-[#b9bdcf]">
                                →{' '}
                                {Math.abs(datasetVal) >= 1000
                                  ? Math.round(datasetVal).toLocaleString('en-US')
                                  : Number(datasetVal.toPrecision(4))}{' '}
                                {f.datasetUnit}
                              </span>
                            )}
                          </div>

                          {err && (
                            <div className="mt-1.5 text-[11px] font-medium text-[#ff6961]">
                              {err}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* RIGHT: SHARED RESULT PANEL (Section 6.4) */}
          <aside className="lg:sticky lg:top-24">
            <div className="glass p-5">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.12] pb-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#b9bdcf]">
                    {isAr ? 'نتيجة التنبؤ الساعي' : 'Single-Hour Prediction Result'}
                  </div>
                  <div className="mt-0.5 text-xs text-[#8e93a8]">
                    {isAr ? regionInfo.nameAr : regionInfo.nameEn} · {dateStr} ·{' '}
                    {String(hourUtc).padStart(2, '0')}:00 UTC
                  </div>
                </div>

                {/* Honest Source Badge: Model vs Physics stand-in */}
                {predictionResult && (
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase ${
                      predictionResult.source === 'model'
                        ? 'border-[#30d158]/50 bg-[#30d158]/15 text-[#30d158]'
                        : 'border-[#ff9f0a]/55 bg-[#ff9f0a]/15 text-[#ffd60a]'
                    }`}
                  >
                    {predictionResult.source === 'model'
                      ? `${isAr ? 'النموذج' : 'Model'} (${predictionResult.modelVersion})`
                      : isAr
                        ? 'بديل فيزيائي (Physics stand-in)'
                        : 'Physics stand-in'}
                  </span>
                )}
              </div>

              {/* Run Prediction Button */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleRunPrediction}
                  disabled={predictLoading || hasFieldErrors}
                  className="btn-pill-primary w-full justify-center py-3 text-sm disabled:opacity-50"
                >
                  <Activity className="h-4 w-4" />
                  <span>
                    {predictLoading
                      ? isAr
                        ? 'جاري حساب التنبؤ...'
                        : 'Running prediction...'
                      : isAr
                        ? 'تشغيل التنبؤ لهذه الساعة'
                        : 'Run prediction for this hour'}
                  </span>
                </button>
              </div>

              {predictError && (
                <div className="mt-3 rounded-xl border border-[#ff453a]/60 bg-[#ff453a]/15 p-3 text-xs text-[#ff6961]">
                  {predictError}
                </div>
              )}

              {predictionResult && (
                <>
                  {/* Main Predicted Output Value */}
                  <div className="mt-4 rounded-2xl border border-white/[0.14] bg-white/[0.04] p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#b9bdcf]">
                      {isAr ? 'القدرة المتوقعة' : 'Predicted Output'}
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-serif text-[42px] leading-none text-[#ffd60a]">
                        {predictionResult.prediction.value.toFixed(2)}
                      </span>
                      <span className="font-mono text-sm text-white">
                        {predictionResult.prediction.unit}
                      </span>
                    </div>
                    <div className="mt-1.5 font-mono text-xs text-[#b9bdcf]">
                      {isAr ? 'الإنتاجية النوعية:' : 'Specific output:'}{' '}
                      <b className="text-white">
                        {predictionResult.prediction.specificKwPerKwp.toFixed(3)} kW / kWp
                      </b>{' '}
                      · {panelTech}
                    </div>
                  </div>

                  {/* Physics Reference Beside It (Section 6.4) */}
                  <div className="mt-3.5 rounded-2xl border border-[#3fc1c1]/35 bg-[#3fc1c1]/[0.06] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#9fe9e9]">
                        {isAr
                          ? 'المرجع الفيزيائي (physics.ts)'
                          : 'Physics Reference (from physics.ts)'}
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-[#3fc1c1]" />
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-2.5 text-xs">
                      <div className="rounded-xl bg-black/25 p-2.5">
                        <div className="text-[#b9bdcf]">
                          {isAr ? 'قدرة السماء الصافية' : 'Clear-sky power (P_clear)'}
                        </div>
                        <div className="mt-0.5 font-mono text-base font-semibold text-white">
                          {predictionResult.physicsReference.pClearKw.toFixed(2)} kW
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/25 p-2.5">
                        <div className="text-[#b9bdcf]">
                          {isAr ? 'إشعاع المصفوفة المائل' : 'Tilted POA irradiance'}
                        </div>
                        <div className="mt-0.5 font-mono text-base font-semibold text-white">
                          {predictionResult.physicsReference.gPoaWm2} W/m²
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/25 p-2.5">
                        <div className="text-[#b9bdcf]">
                          {isAr ? 'حرارة الخلية (Faiman)' : 'Faiman cell temp (T_cell)'}
                        </div>
                        <div className="mt-0.5 font-mono text-base font-semibold text-white">
                          {predictionResult.physicsReference.tCellC.toFixed(1)} °C
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/25 p-2.5">
                        <div className="text-[#b9bdcf]">
                          {isAr ? 'زاوية ارتفاع الشمس' : 'Solar elevation (α_s)'}
                        </div>
                        <div className="mt-0.5 font-mono text-base font-semibold text-white">
                          {predictionResult.physicsReference.solarElevationDeg.toFixed(1)}°
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Validation & Service Warnings */}
                  {(crossWarnings.length > 0 || predictionResult.warnings.length > 0) && (
                    <div className="mt-3.5 rounded-2xl border border-[#ff9f0a]/45 bg-[#ff9f0a]/10 p-3.5 text-xs">
                      <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase text-[#ffd60a]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>
                          {isAr ? 'تنبيهات التحقق والخدمة' : 'Validation & Service Notes'}
                        </span>
                      </div>
                      <ul className="m-0 list-disc space-y-1 pl-4 text-[#f4f5fa]">
                        {Array.from(new Set([...crossWarnings, ...predictionResult.warnings])).map(
                          (w, idx) => (
                            <li key={idx}>{w}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Open This Hour in the Digital Twin Button */}
                  <div className="mt-4">
                    <Link
                      href={twinUrl}
                      className="btn-pill w-full justify-center py-2.5 text-xs"
                    >
                      <Box className="h-4 w-4 text-[#3fc1c1]" />
                      <span>
                        {isAr
                          ? 'افتح هذه الساعة في التوأم الرقمي 3D'
                          : 'Open this hour in the digital twin'}
                      </span>
                    </Link>
                  </div>

                  {/* Collapsible Request & Response JSON Block (for Seminar Inspection) */}
                  <div className="mt-4 border-t border-white/[0.12] pt-3">
                    <button
                      type="button"
                      onClick={() => setJsonInspectorOpen((v) => !v)}
                      className="flex w-full items-center justify-between text-left font-mono text-xs text-[#b9bdcf] hover:text-white"
                    >
                      <span>
                        {isAr
                          ? 'عرض JSON الطلب والاستجابة (Request & Response)'
                          : 'Request and response JSON (23 dataset features)'}
                      </span>
                      {jsonInspectorOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {jsonInspectorOpen && (
                      <div className="mt-2.5 space-y-2.5">
                        <div>
                          <div className="mb-1 font-mono text-[10px] uppercase text-[#9fe9e9]">
                            POST /api/predict — Request Body (Dataset Units)
                          </div>
                          <pre className="max-h-[220px] overflow-auto rounded-xl border border-white/10 bg-[#05070f] p-2.5 font-mono text-[11px] text-[#f4f5fa]">
                            {JSON.stringify(lastRequestSent, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="mb-1 font-mono text-[10px] uppercase text-[#ffd60a]">
                            POST /api/predict — Response Body
                          </div>
                          <pre className="max-h-[220px] overflow-auto rounded-xl border border-white/10 bg-[#05070f] p-2.5 font-mono text-[11px] text-[#f4f5fa]">
                            {JSON.stringify(predictionResult, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Globe Modal for Tab B: snaps to nearest saved region or refuses out-of-coverage points */}
      <GlobeLocationModal
        open={globeOpen}
        autoLocate={globeAutoLocate}
        initialLat={regionInfo.representativePoint.lat}
        initialLon={regionInfo.representativePoint.lon}
        isAr={isAr}
        onClose={() => setGlobeOpen(false)}
        onSelectLocation={(sitePoint) => {
          const snap = snapToSavedRegion(sitePoint.lat, sitePoint.lon);
          setGlobeOpen(false);
          if (!snap.accepted) {
            setMapSnapNotice({
              accepted: false,
              text:
                (isAr ? snap.messageAr : snap.messageEn) ||
                `Point is outside saved regions. Closest saved region: ${snap.closestRegion.nameEn}.`,
            });
            return;
          }
          setRegion(snap.region.id);
          setMapSnapNotice({
            accepted: true,
            text: isAr
              ? `تمت المطابقة مع ${snap.region.nameAr} (النقطة المرجعية: ${snap.region.representativePoint.labelAr}).`
              : `Matched to ${snap.region.nameEn} (Representative cell: ${snap.region.representativePoint.labelEn}).`,
          });
        }}
      />
    </div>
  );
}

export default function PredictPage() {
  return (
    <Suspense
      fallback={
        <div className="cinematic-page flex min-h-screen items-center justify-center text-sm text-[#b9bdcf]">
          Loading prediction test bench...
        </div>
      }
    >
      <PredictTestContent />
    </Suspense>
  );
}
