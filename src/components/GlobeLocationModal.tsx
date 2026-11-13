'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ANCHOR_CITIES, EGYPT_BOUNDS, ERA5_GRID, REGIONS, snapToGridCell } from '@/domain/regions';
import { SitePoint } from '@/domain/types';
import { Compass, MapPin, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export function GlobeLocationModal({
  open,
  autoLocate = false,
  initialLat = 30.04,
  initialLon = 31.24,
  isAr = false,
  onClose,
  onSelectLocation,
}: {
  open: boolean;
  autoLocate?: boolean;
  initialLat?: number;
  initialLon?: number;
  isAr?: boolean;
  onClose: () => void;
  onSelectLocation: (site: SitePoint, sourceLabel: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [site, setSite] = useState<SitePoint>(() => snapToGridCell(initialLat, initialLon));
  const [sourceLabel, setSourceLabel] = useState<string>('Selected on map');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [locating, setLocating] = useState<boolean>(false);

  const updatePinOnMap = (lat: number, lon: number, src: string, fly = true) => {
    const snapped = snapToGridCell(lat, lon);
    setSite(snapped);
    setSourceLabel(src);

    const map = mapRef.current;
    if (!map) return;

    if (!markerRef.current) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:22px;height:22px;border-radius:50%;background:#ffd166;border:3px solid #fff;box-shadow:0 0 18px 6px rgba(245,165,36,.75);cursor:grab;';
      markerRef.current = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([lon, lat])
        .addTo(map);
      markerRef.current.on('dragend', () => {
        const lngLat = markerRef.current!.getLngLat();
        updatePinOnMap(lngLat.lat, lngLat.lng, 'Adjusted pin', false);
      });
    } else {
      markerRef.current.setLngLat([lon, lat]);
    }

    const half = ERA5_GRID.step / 2;
    const cellGeoJson = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [snapped.cellLon - half, snapped.cellLat - half],
                [snapped.cellLon + half, snapped.cellLat - half],
                [snapped.cellLon + half, snapped.cellLat + half],
                [snapped.cellLon - half, snapped.cellLat + half],
                [snapped.cellLon - half, snapped.cellLat - half],
              ],
            ],
          },
        },
      ],
    };

    const srcObj = map.getSource('era5-cell') as maplibregl.GeoJSONSource | undefined;
    if (srcObj) {
      srcObj.setData(cellGeoJson);
    }

    if (fly) {
      map.flyTo({
        center: [lon, lat],
        zoom: 9.5,
        pitch: 42,
        bearing: -10,
        duration: 2600,
        essential: true,
      });
    }
  };

  const handleBrowserLocate = () => {
    if (!('geolocation' in navigator)) {
      setStatusMessage(
        isAr
          ? 'المتصفح لا يدعم تحديد الموقع؛ اختر موقعك على الخريطة أو من المدن أدناه.'
          : 'Browser geolocation unavailable. Click anywhere in Egypt or choose an anchor city below.'
      );
      return;
    }
    setLocating(true);
    setStatusMessage(
      isAr
        ? 'جاري التحليق إلى مصر وانتظار إحداثيات المتصفح...'
        : 'Flying to Egypt and requesting browser coordinates...'
    );
    mapRef.current?.flyTo({ center: [30.8, 26.8], zoom: 5.0, duration: 2400 });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        const inEgypt =
          latitude >= EGYPT_BOUNDS.latMin &&
          latitude <= EGYPT_BOUNDS.latMax &&
          longitude >= EGYPT_BOUNDS.lonMin &&
          longitude <= EGYPT_BOUNDS.lonMax;

        if (!inEgypt) {
          setStatusMessage(
            isAr
              ? 'يبدو أنك خارج مصر. اختر الموقع الذي تخطط له داخل مصر على الخريطة.'
              : 'You appear to be outside Egypt. Pick the Egyptian site you are planning for on the map.'
          );
          return;
        }
        setStatusMessage('');
        updatePinOnMap(
          latitude,
          longitude,
          `Browser GPS (±${Math.round(accuracy)}m)`,
          true
        );
      },
      () => {
        setLocating(false);
        setStatusMessage(
          isAr
            ? 'تعذر الحصول على إذن الموقع. انقر على أي مكان في مصر أو اختر مدينة مرجعية.'
            : 'Location permission was not granted. Click anywhere in Egypt on the globe or pick a city below.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (!open || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: [30.8, 26.8],
      zoom: 4.8,
      maxZoom: 14,
      style: {
        version: 8,
        projection: { type: 'globe' },
        sources: {
          sat: {
            type: 'raster',
            tileSize: 256,
            maxzoom: 14,
            tiles: [
              'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
            ],
            attribution: 'Sentinel-2 cloudless 2020 by EOX',
          },
          'era5-cell': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#05070f' } },
          {
            id: 'sat-layer',
            type: 'raster',
            source: 'sat',
            paint: { 'raster-saturation': 0.08, 'raster-contrast': 0.06 },
          },
          {
            id: 'cell-fill',
            type: 'fill',
            source: 'era5-cell',
            paint: { 'fill-color': '#3fc1c1', 'fill-opacity': 0.18 },
          },
          {
            id: 'cell-line',
            type: 'line',
            source: 'era5-cell',
            paint: { 'line-color': '#8fe3e3', 'line-width': 2, 'line-dasharray': [2, 2] },
          },
        ],
      },
    });

    mapRef.current = map;

    map.on('load', () => {
      updatePinOnMap(initialLat, initialLon, 'Initial site', false);
      if (autoLocate) {
        handleBrowserLocate();
      }
    });

    map.on('click', (e) => {
      updatePinOnMap(e.lngLat.lat, e.lngLat.lng, 'Picked on satellite globe', true);
    });

    return () => {
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  const regionInfo = REGIONS[site.region];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between bg-[#05070f]"
      role="dialog"
      aria-modal="true"
    >
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-[#05070f]/90 to-transparent px-6 py-4">
        <div>
          <span className="text-[11px] uppercase tracking-widest text-amber-400">
            {isAr ? 'الخطوة 2 · تحديد الموقع والشبكة المناخية' : 'Chapter 4 · 3D Satellite Globe & ERA5 Grid Detector'}
          </span>
          <h2 className="font-serif text-xl font-semibold text-white">
            {isAr ? 'حدد موقع سطحك في مصر' : 'Where is your roof in Egypt?'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-[#05070f]/80 px-4 py-2 text-xs font-medium text-white backdrop-blur-md hover:border-amber-400"
        >
          <X className="h-4 w-4" />
          <span>{isAr ? 'إغلاق' : 'Close'}</span>
        </button>
      </div>

      {/* Bottom Control Panel */}
      <div className="relative z-10 mx-auto mb-5 w-full max-w-3xl px-4">
        <div className="rounded-2xl border border-white/15 bg-[#0a0d1c]/85 p-5 shadow-2xl backdrop-blur-xl">
          {statusMessage && (
            <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
              {statusMessage}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                {isAr ? 'الإقليم المناخي وخلية ERA5' : 'Matched Climate Region & ERA5 Cell'}
              </div>
              <div className="mt-1 font-serif text-xl font-semibold text-white">
                {isAr ? regionInfo.nameAr : regionInfo.nameEn}{' '}
                <span className="ml-1 rounded-full bg-teal-500/20 px-2 py-0.5 font-sans text-xs text-teal-300">
                  {regionInfo.code}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                {isAr ? regionInfo.characterAr : regionInfo.characterEn}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-200">
                  <MapPin className="h-3.5 w-3.5 text-amber-400" />
                  Cell: {site.cellLat.toFixed(2)}° N, {site.cellLon.toFixed(2)}° E
                </span>
                {site.inCoverage ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isAr ? 'ضمن تغطية أرشيف ERA5' : 'Inside 990-cell ERA5 grid'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {isAr
                      ? `أقرب خلية على بعد ${site.distanceKm} كم`
                      : `Snapped to nearest cell (${site.distanceKm} km)`}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                {isAr ? 'المدن المرجعية السريعة (18 موقعاً)' : 'Quick-Pick Anchor Cities'}
              </div>
              <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {ANCHOR_CITIES.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() =>
                      updatePinOnMap(city.lat, city.lon, `Anchor: ${city.nameEn}`, true)
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      site.anchorName === city.nameEn
                        ? 'border-amber-400 bg-amber-500/25 text-amber-200 font-semibold'
                        : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/40 hover:text-white'
                    }`}
                  >
                    {isAr ? city.nameAr : city.nameEn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBrowserLocate}
                disabled={locating}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white hover:border-amber-400"
              >
                <Compass className="h-4 w-4 text-amber-400" />
                <span>
                  {locating
                    ? isAr
                      ? 'جاري التحديد...'
                      : 'Locating...'
                    : isAr
                      ? 'استخدم موقعي الحالي (GPS)'
                      : 'Use my GPS location'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-[11px] text-slate-400 sm:inline">
                {isAr
                  ? 'خصوصية تامة: يُرسل مركز الخلية (25 كم) فقط لخدمة الطقس.'
                  : 'Privacy: only the 0.25° (~25 km) grid cell center is sent to Open-Meteo.'}
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelectLocation(site, sourceLabel);
                  onClose();
                }}
                className="rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400"
              >
                {isAr ? 'تأكيد هذا الموقع ←' : 'Use this location →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

