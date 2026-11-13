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
import { ArrowRight } from 'lucide-react';

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
      maxTileCacheSize: 800,
      fadeDuration: 650,
      style: {
        version: 8,
        projection: { type: 'globe' },
        sky: {
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
        },
        sources: {
          'sat-base': {
            type: 'raster',
            tileSize: 256,
            minzoom: 0,
            maxzoom: 6,
            tiles: [
              'https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              'https://b.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              'https://c.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              'https://d.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
            ],
          },
          sat: {
            type: 'raster',
            tileSize: 256,
            maxzoom: 13,
            tiles: [
              'https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              'https://b.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              'https://c.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              'https://d.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
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
          {
            id: 'sat-base-layer',
            type: 'raster',
            source: 'sat-base',
            paint: {
              'raster-resampling': 'linear',
              'raster-opacity': 0.85,
              'raster-fade-duration': 0,
            },
          },
          {
            id: 'sat',
            type: 'raster',
            source: 'sat',
            paint: {
              'raster-resampling': 'linear',
              'raster-opacity': 0.85,
              'raster-fade-duration': 750,
            },
          },
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
    <div className="cinematic-page pb-20 pt-8">
      <Navbar clockLabel="10:45 · 4 Climate Regions" />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">
              {isAr
                ? 'أطلس الأقاليم المناخية الأربعة (990 خلية ERA5)'
                : 'Egypt ERA5 Climate & Yield Atlas · 990 Grid Cells'}
            </div>
            <h1 className="cinematic-h2 mt-2.5">
              {isAr
                ? 'أربعة أقاليم مناخية، ثمانية عشر موقعاً مرجعياً'
                : 'Four Egyptian skies, eighteen anchor stations'}
            </h1>
            <p className="cinematic-lede mt-2">
              ERA5 Coverage: <b>{ERA5_GRID.latMin}°–{ERA5_GRID.latMax}° N</b>,{' '}
              <b>{ERA5_GRID.lonMin}°–{ERA5_GRID.lonMax}° E</b> (0.25° resolution, 2020–2026, 16 daytime hours 02:00–17:00 UTC).
            </p>
          </div>

          <Link
            href={`/?tech=${selectedTech}&lat=${selectedCity.lat}&lon=${selectedCity.lon}`}
            className="btn-pill-primary"
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
                className={`glass-interactive text-left ${active ? 'glass-selected' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-xs font-bold text-[#05070f]"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.code}
                  </span>
                  <span className="font-mono text-xs text-[#b9bdcf]">
                    GHI ~{r.avgAnnualGhiKwhM2} kWh/m²
                  </span>
                </div>
                <h2 className="mt-2.5 font-serif text-lg font-semibold text-white">
                  {isAr ? r.nameAr : r.nameEn}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs text-[#b9bdcf]">
                  {isAr ? r.characterAr : r.characterEn}
                </p>
              </button>
            );
          })}
        </div>

        {/* Map + Anchor Yield Breakdown */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="glass overflow-hidden p-0 lg:col-span-6">
            <div ref={mapContainerRef} className="h-[440px] w-full" />
            <div className="border-t border-white/[0.14] p-4">
              <div className="font-mono text-xs uppercase tracking-[0.12em] text-[#b9bdcf]">
                {isAr ? 'اختر محطة مرجعية على الخريطة:' : '18 In-Grid Anchor Stations:'}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {ANCHOR_CITIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handlePickCity(c)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      selectedCity.id === c.id
                        ? 'border-[#f5a524] bg-[#f5a524] font-semibold text-[#221500]'
                        : 'border-white/[0.16] bg-white/[0.04] text-[#b9bdcf] hover:border-white/40 hover:text-white'
                    }`}
                  >
                    {isAr ? c.nameAr : c.nameEn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="glass flex flex-col justify-between lg:col-span-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="tag-pill">
                    {regInfo.code} · {isAr ? regInfo.nameAr : regInfo.nameEn}
                  </span>
                  <h2 className="mt-2 font-serif text-2xl font-semibold text-white">
                    {isAr ? selectedCity.nameAr : selectedCity.nameEn} (Cell {sitePoint.cellId})
                  </h2>
                </div>
                <span className="tag-pill live">Elev: {selectedCity.elevationM} m</span>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-[#b9bdcf]">
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
                      className={`glass-interactive p-3.5 text-left ${
                        active ? 'glass-selected' : ''
                      }`}
                    >
                      <div className="font-mono text-xs font-semibold text-[#b9bdcf]">
                        {tech.key}
                      </div>
                      <div className="mt-1 font-serif text-2xl font-bold text-[#ffd166]">
                        {res.specificYield}
                      </div>
                      <div className="text-[11px] text-[#b9bdcf]">
                        kWh / kWp / yr · PR {Math.round(res.performanceRatio * 100)}%
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Monthly Specific Yield Bar Chart */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-[#b9bdcf]">
                  <span className="font-semibold text-white">
                    Monthly Specific Yield ({selectedTech}, kWh / kWp)
                  </span>
                  <span className="font-mono text-[#9fe9e9]">
                    Optimal Tilt: {Math.round(sitePoint.cellLat * 0.9)}° South
                  </span>
                </div>
                <div className="mt-3 flex h-36 items-end gap-2 border-b border-white/[0.14] pb-2">
                  {activeYield.monthlySpecificKwhPerKwp.map((val, idx) => {
                    const pct = Math.max(15, Math.round((val / 230) * 100));
                    return (
                      <div
                        key={idx}
                        className="flex flex-1 flex-col items-center gap-1"
                        title={`Month ${idx + 1}: ${val} kWh/kWp`}
                      >
                        <span className="font-mono text-[10px] text-[#b9bdcf]">
                          {Math.round(val)}
                        </span>
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-[#3fc1c1] to-[#ffd166]"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[11px] text-[#b9bdcf]">
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.14] pt-3 font-mono text-xs text-[#b9bdcf]">
              <span>Peak Summer Temp: {regInfo.summerPeakTempC}°C</span>
              <span>Dust Profile: {regInfo.dustRisk}</span>
              <span className="text-[#ffd166]">Recommended: {regInfo.recommendedTech}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
