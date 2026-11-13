'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Navbar, useLanguage } from '@/components/Navbar';
import { ANCHOR_CITIES, ERA5_GRID, REGIONS, snapToGridCell } from '@/domain/regions';
import { predictionProvider } from '@/domain/providers/predictionProvider';
import { PANEL_TECH_LIST } from '@/domain/panels';
import { AnchorCity, PanelTech, RegionId } from '@/domain/types';
import { Globe2, MapPin, Sun, Thermometer, Wind, ArrowRight } from 'lucide-react';

export default function FourRegionsAtlasPage() {
  const { isAr } = useLanguage();
  const [selectedRegion, setSelectedRegion] = useState<RegionId>('nile-valley-upper-egypt');
  const [selectedCity, setSelectedCity] = useState<AnchorCity>(
    ANCHOR_CITIES.find((c) => c.id === 'aswan-benban') || ANCHOR_CITIES[0]
  );
  const [selectedTech, setSelectedTech] = useState<PanelTech>('a-Si:H/sc-Si');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const regionFeatures = Object.values(REGIONS).map((reg) => ({
      type: 'Feature' as const,
      properties: { id: reg.id, color: reg.color, name: reg.nameEn },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [reg.polygonCoords],
      },
    }));

    const cityFeatures = ANCHOR_CITIES.map((c) => ({
      type: 'Feature' as const,
      properties: { id: c.id, name: c.nameEn, region: c.region },
      geometry: {
        type: 'Point' as const,
        coordinates: [c.lon, c.lat],
      },
    }));

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: [31.2, 27.4],
      zoom: 5.1,
      style: {
        version: 8,
        sources: {
          sat: {
            type: 'raster',
            tileSize: 256,
            maxzoom: 13,
            tiles: [
              'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
            ],
            attribution: 'Sentinel-2 cloudless 2020 by EOX',
          },
          regions: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: regionFeatures },
          },
          cities: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: cityFeatures },
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#05070f' } },
          { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-opacity': 0.82 } },
          {
            id: 'region-fill',
            type: 'fill',
            source: 'regions',
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': 0.22,
            },
          },
          {
            id: 'region-outline',
            type: 'line',
            source: 'regions',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 2,
            },
          },
          {
            id: 'city-circles',
            type: 'circle',
            source: 'cities',
            paint: {
              'circle-radius': 6,
              'circle-color': '#ffd166',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#05070f',
            },
          },
        ],
      },
    });

    map.on('click', 'city-circles', (e) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const cityId = feat.properties?.id;
      const found = ANCHOR_CITIES.find((c) => c.id === cityId);
      if (found) {
        setSelectedCity(found);
        setSelectedRegion(found.region);
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handlePickCity = (city: AnchorCity) => {
    setSelectedCity(city);
    setSelectedRegion(city.region);
    mapRef.current?.flyTo({ center: [city.lon, city.lat], zoom: 7.2, duration: 1400 });
  };

  const sitePoint = useMemo(
    () => snapToGridCell(selectedCity.lat, selectedCity.lon),
    [selectedCity]
  );

  const yieldComparison = useMemo(
    () =>
      PANEL_TECH_LIST.map((t) => ({
        tech: t,
        res: predictionProvider.yield(sitePoint, {
          tech: t.key,
          panelCount: 1,
          kWp: 1,
          tiltDeg: Math.round(sitePoint.cellLat * 0.9),
          azimuthDeg: 180,
        }),
      })),
    [sitePoint]
  );

  const activeYield =
    yieldComparison.find((y) => y.tech.key === selectedTech)?.res || yieldComparison[0].res;
  const regInfo = REGIONS[selectedRegion];

  return (
    <div className="min-h-screen bg-[#05070f] pb-20 pt-20 text-slate-100">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
              {isAr ? 'أطلس الأقاليم المناخية الأربعة (990 خلية ERA5)' : 'Egypt ERA5 Climate & Yield Atlas (990 Grid Cells)'}
            </div>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-white sm:text-5xl">
              {isAr ? 'أربعة أقاليم مناخية، ثمانية عشر موقعاً مرجعياً' : 'Four Egyptian Skies, Eighteen Anchor Stations'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              ERA5 Coverage: <b>{ERA5_GRID.latMin}°–{ERA5_GRID.latMax}° N</b>,{' '}
              <b>{ERA5_GRID.lonMin}°–{ERA5_GRID.lonMax}° E</b> (0.25° resolution, 2020–2026, 16 daytime hours 02:00–17:00 UTC).
            </p>
          </div>

          <Link
            href={`/?tech=${selectedTech}&lat=${selectedCity.lat}&lon=${selectedCity.lon}`}
            className="flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            <span>
              {isAr ? `خطط لموقع ${selectedCity.nameAr}` : `Plan a system in ${selectedCity.nameEn}`}
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 4 Region Selector Cards */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(REGIONS).map((r) => {
            const active = r.id === selectedRegion;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedRegion(r.id);
                  const firstCity = ANCHOR_CITIES.find((c) => c.region === r.id);
                  if (firstCity) handlePickCity(firstCity);
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-amber-400 bg-amber-500/15 shadow-lg'
                    : 'border-white/10 bg-[#0a0d1c]/80 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold text-slate-950"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.code}
                  </span>
                  <span className="text-xs text-slate-400">
                    GHI ~{r.avgAnnualGhiKwhM2} kWh/m²
                  </span>
                </div>
                <h2 className="mt-2 font-serif text-lg font-semibold text-white">
                  {isAr ? r.nameAr : r.nameEn}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                  {isAr ? r.characterAr : r.characterEn}
                </p>
              </button>
            );
          })}
        </div>

        {/* Map + Anchor Yield Breakdown */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="overflow-hidden rounded-3xl border border-white/15 bg-[#0a0d1c] lg:col-span-6">
            <div ref={mapContainerRef} className="h-[460px] w-full" />
            <div className="border-t border-white/10 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">
                {isAr ? 'اختر محطة مرجعية على الخريطة:' : '18 In-Grid Anchor Stations:'}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ANCHOR_CITIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handlePickCity(c)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      selectedCity.id === c.id
                        ? 'border-amber-400 bg-amber-500 font-semibold text-slate-950'
                        : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/40'
                    }`}
                  >
                    {isAr ? c.nameAr : c.nameEn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-white/15 bg-[#0a0d1c]/90 p-6 lg:col-span-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    {regInfo.code} · {isAr ? regInfo.nameAr : regInfo.nameEn}
                  </span>
                  <h2 className="font-serif text-2xl font-semibold text-white">
                    {isAr ? selectedCity.nameAr : selectedCity.nameEn} (Cell {sitePoint.cellId})
                  </h2>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                  Elev: {selectedCity.elevationM} m
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-300">
                {isAr ? selectedCity.noteAr : selectedCity.noteEn} —{' '}
                {isAr ? regInfo.pvBehaviourAr : regInfo.pvBehaviourEn}
              </p>

              {/* Specific Yield per kWp for all 3 technologies at this anchor */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                {yieldComparison.map(({ tech, res }) => {
                  const active = tech.key === selectedTech;
                  return (
                    <button
                      key={tech.key}
                      type="button"
                      onClick={() => setSelectedTech(tech.key)}
                      className={`rounded-2xl border p-3.5 text-left transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/20'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-300">{tech.key}</div>
                      <div className="mt-1 font-serif text-2xl font-bold text-amber-300">
                        {res.specificYield}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        kWh / kWp / yr · PR {Math.round(res.performanceRatio * 100)}%
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Monthly Specific Yield Bar Chart */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">
                    Monthly Specific Yield ({selectedTech}, kWh / kWp)
                  </span>
                  <span className="text-teal-300">
                    Optimal Tilt: {Math.round(sitePoint.cellLat * 0.9)}° South
                  </span>
                </div>
                <div className="mt-3 flex h-36 items-end gap-2 border-b border-white/10 pb-2">
                  {activeYield.monthlySpecificKwhPerKwp.map((val, idx) => {
                    const pct = Math.max(15, Math.round((val / 230) * 100));
                    return (
                      <div
                        key={idx}
                        className="flex flex-1 flex-col items-center gap-1"
                        title={`Month ${idx + 1}: ${val} kWh/kWp`}
                      >
                        <span className="text-[10px] text-slate-300">{Math.round(val)}</span>
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-teal-600 to-amber-400"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
                    (m) => (
                      <span key={m} className="flex-1 text-center">
                        {m}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
              <span>Peak Summer Temp: {regInfo.summerPeakTempC}°C</span>
              <span>Dust Profile: {regInfo.dustRisk}</span>
              <span>Recommended Tech: {regInfo.recommendedTech}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

