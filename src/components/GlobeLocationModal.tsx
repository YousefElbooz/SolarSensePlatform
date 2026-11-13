'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { EGYPT_BOUNDS, ERA5_GRID, REGIONS, snapToGridCell } from '@/domain/regions';
import { SitePoint } from '@/domain/types';

type GlobeStage = 'intro' | 'locating' | 'pick' | 'placed';
type PlaceSource = 'gps' | 'picked' | 'adjusted';

const EGYPT_VIEW = { center: [30.6, 26.9] as [number, number], zoom: 4.7 };
const INTRO_VIEW = { center: [-20, 18] as [number, number], zoom: 1.35 };

const PLACES: Array<[string, string, number, number]> = [
  ['Cairo', 'القاهرة', 30.04, 31.24],
  ['Alexandria', 'الإسكندرية', 31.2, 29.92],
  ['Aswan / Benban', 'أسوان / بنبان', 24.45, 32.74],
  ['Kharga', 'الخارجة', 25.45, 30.55],
  ['Sharm El-Sheikh', 'شرم الشيخ', 27.91, 34.33],
  ['Hurghada', 'الغردقة', 27.26, 33.81],
];

const GEO_ERR: Record<number | string, { en: string; ar: string }> = {
  1: {
    en: 'Location permission was not given. You can pick your place on the map instead.',
    ar: 'لم يتم منح إذن الموقع. يمكنك اختيار موقعك على الخريطة بدلاً من ذلك.',
  },
  2: {
    en: 'Your device could not work out a position. Pick your place on the map instead.',
    ar: 'تعذر على جهازك تحديد الموقع. اختر موقعك على الخريطة بدلاً من ذلك.',
  },
  3: {
    en: 'Finding your position took too long. Pick your place on the map instead.',
    ar: 'استغرق تحديد موقعك وقتاً طويلاً. اختر موقعك على الخريطة بدلاً من ذلك.',
  },
  unsupported: {
    en: 'This browser cannot share a location here. Pick your place on the map instead.',
    ar: 'هذا المتصفح لا يدعم مشاركة الموقع هنا. اختر موقعك على الخريطة بدلاً من ذلك.',
  },
};

function buildCellFeatureCollection(cellLat: number, cellLon: number) {
  const h = ERA5_GRID.step / 2;
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [cellLon - h, cellLat - h],
              [cellLon + h, cellLat - h],
              [cellLon + h, cellLat + h],
              [cellLon - h, cellLat + h],
              [cellLon - h, cellLat - h],
            ],
          ],
        },
      },
    ],
  };
}

const EMPTY_FC = {
  type: 'FeatureCollection' as const,
  features: [],
};

const preloadedUrls = new Set<string>();

function lon2tile(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

function lat2tile(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z));
}

function preloadTileUrl(z: number, x: number, y: number) {
  const hosts = ['a', 'b', 'c', 'd'];
  const sub = hosts[Math.abs(x + y) % hosts.length];
  const url = `https://${sub}.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${z}/${y}/${x}.jpg`;
  if (preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
}

// Preload intermediate + final zoom tile pyramid (z=6..11) around a target (lat, lon) so zooming in steps smoothly through every resolution instead of stretching a pixelated z=4 tile
function preloadTargetPyramid(lat: number, lon: number) {
  if (typeof window === 'undefined') return;
  for (const z of [6, 7, 8, 9, 10, 11]) {
    const cx = lon2tile(lon, z);
    const cy = lat2tile(lat, z);
    const radius = z <= 9 ? 1 : 1;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        preloadTileUrl(z, cx + dx, cy + dy);
      }
    }
  }
}

// Pre-warm satellite tiles for Egypt overview (z=4,5,6) and the 6 anchor locations
function prewarmEgyptTiles() {
  if (typeof window === 'undefined') return;
  const tasks: Array<() => void> = [];

  for (const z of [4, 5, 6]) {
    const xMin = lon2tile(24.5, z);
    const xMax = lon2tile(36.0, z);
    const yMin = lat2tile(31.8, z);
    const yMax = lat2tile(22.0, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tasks.push(() => preloadTileUrl(z, x, y));
      }
    }
  }

  for (const [, , lat, lon] of PLACES) {
    tasks.push(() => preloadTargetPyramid(lat, lon));
  }

  let idx = 0;
  const pump = () => {
    const batch = tasks.slice(idx, idx + 4);
    idx += 4;
    batch.forEach((fn) => fn());
    if (idx < tasks.length) {
      setTimeout(pump, 90);
    }
  };
  setTimeout(pump, 200);
}

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
  const spinningRef = useRef<boolean>(true);
  const stageRef = useRef<GlobeStage>('intro');
  const openRef = useRef<boolean>(open);
  openRef.current = open;

  const [hasOpened, setHasOpened] = useState<boolean>(open);
  const [stage, setStage] = useState<GlobeStage>('intro');
  const [isZooming, setIsZooming] = useState<boolean>(false);
  const [site, setSite] = useState<SitePoint>(() => snapToGridCell(initialLat, initialLon));
  const [placeSource, setPlaceSource] = useState<PlaceSource>('picked');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(undefined);
  const [locatingText, setLocatingText] = useState<string>(
    'Waiting for your browser to share a position.'
  );
  const [pickMessage, setPickMessage] = useState<string>('');
  const [placedMessage, setPlacedMessage] = useState<string>('');

  useEffect(() => {
    if (open && !hasOpened) {
      setHasOpened(true);
    }
  }, [open, hasOpened]);

  const showStage = useCallback((next: GlobeStage) => {
    stageRef.current = next;
    setStage(next);
    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = next === 'pick' || next === 'placed' ? 'crosshair' : '';
      if (next !== 'pick' && next !== 'placed') {
        const hoverSrc = map.getSource('hover-cell') as maplibregl.GeoJSONSource | undefined;
        hoverSrc?.setData(EMPTY_FC);
      }
    }
  }, []);

  const fly = useCallback((opts: maplibregl.FlyToOptions): Promise<void> => {
    return new Promise((resolve) => {
      const map = mapRef.current;
      if (!map) {
        resolve();
        return;
      }
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) {
        map.jumpTo({
          center: opts.center,
          zoom: opts.zoom,
          pitch: opts.pitch,
          bearing: opts.bearing,
        });
        resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      map.once('moveend', finish);
      setTimeout(finish, (opts.duration ?? 2000) + 150);
      map.flyTo({
        essential: true,
        curve: 1.18,
        easing: (t) => 1 - Math.pow(1 - t, 3.2),
        ...opts,
      });
    });
  }, []);

  // Place pin & render the 0.25° ERA5 weather grid square IMMEDIATELY while preloading progressive zoom tiles
  const place = useCallback(
    (
      lat: number,
      lon: number,
      opts: { source: PlaceSource; acc?: number; animate?: boolean } = { source: 'picked' }
    ) => {
      const { source, acc, animate = true } = opts;
      spinningRef.current = false;

      // Immediately start preloading intermediate & target zoom tiles (z=6..11) so unpixelizing is progressive and silky-smooth
      preloadTargetPyramid(lat, lon);

      const snapped = snapToGridCell(lat, lon);
      setSite(snapped);
      setPlaceSource(source);
      setGpsAccuracy(acc);

      if (!snapped.inCoverage) {
        setPlacedMessage(
          isAr
            ? `هذه النقطة خارج تغطية أرشيف الطقس الحالي. أقرب خلية مغطاة تبعد حوالي ${Math.round(snapped.distanceKm)} كم، لذا قد تكون النتائج أقل دقة.`
            : `This point is outside the current weather archive. The nearest covered cell is about ${Math.round(snapped.distanceKm)} km away, so results here would be less reliable.`
        );
      } else {
        setPlacedMessage('');
      }

      // Show 'placed' card immediately so the user never waits for the camera flight to finish
      showStage('placed');

      const map = mapRef.current;
      if (!map) return;

      // 1. Place or move the pulsing solar pin immediately
      if (!markerRef.current) {
        const el = document.createElement('div');
        el.className = 'pin';
        el.innerHTML = '<i></i>';
        const marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([lon, lat])
          .addTo(map);
        marker.on('dragend', () => {
          const p = marker.getLngLat();
          place(p.lat, p.lng, { source: 'adjusted', animate: false });
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setLngLat([lon, lat]);
      }

      // 2. Draw the 0.25° weather data cell square immediately and force a WebGL repaint
      const cellSrc = map.getSource('cell') as maplibregl.GeoJSONSource | undefined;
      if (cellSrc) {
        cellSrc.setData(buildCellFeatureCollection(snapped.cellLat, snapped.cellLon));
      }
      const hoverSrc = map.getSource('hover-cell') as maplibregl.GeoJSONSource | undefined;
      if (hoverSrc) {
        hoverSrc.setData(EMPTY_FC);
      }
      map.triggerRepaint();

      // 3. Smooth progressive camera descent so intermediate zoom tiles cross-fade cleanly without blocky pixelation
      if (animate) {
        void fly({
          center: [lon, lat],
          zoom: 10.2,
          pitch: 46,
          bearing: -12,
          duration: 2100,
        });
      }
    },
    [fly, isAr, showStage]
  );

  const startPick = useCallback(
    (message = '') => {
      spinningRef.current = false;
      setPickMessage(message);
      showStage('pick');
      const map = mapRef.current;
      if (map && map.getZoom() < 4) {
        void fly({ ...EGYPT_VIEW, pitch: 0, bearing: 0, duration: 1650 });
      }
    },
    [fly, showStage]
  );

  const locate = useCallback(async () => {
    spinningRef.current = false;
    showStage('locating');
    setLocatingText(
      isAr
        ? 'بانتظار مشاركة المتصفح لإحداثيات موقعك.'
        : 'Waiting for your browser to share a position.'
    );

    const toEgypt = fly({ ...EGYPT_VIEW, pitch: 0, bearing: 0, duration: 1800 });

    const getPos = (): Promise<{ lat: number; lon: number; acc: number }> =>
      new Promise((resolve, reject) => {
        if (!('geolocation' in navigator) || !window.isSecureContext) {
          reject({ code: 'unsupported' });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) =>
            resolve({
              lat: p.coords.latitude,
              lon: p.coords.longitude,
              acc: p.coords.accuracy,
            }),
          (e) => reject({ code: e.code }),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      });

    let pos: { lat: number; lon: number; acc: number } | null = null;
    let errCode: number | string | null = null;

    try {
      pos = await getPos();
    } catch (e: unknown) {
      const code =
        typeof e === 'object' && e !== null && 'code' in e
          ? (e as { code: number | string }).code
          : 2;
      errCode = code;
    }

    await toEgypt;

    if (errCode !== null || !pos) {
      const msgObj = GEO_ERR[errCode ?? 2] || GEO_ERR[2];
      startPick(isAr ? msgObj.ar : msgObj.en);
      return;
    }

    const inEgypt =
      pos.lat >= EGYPT_BOUNDS.latMin &&
      pos.lat <= EGYPT_BOUNDS.latMax &&
      pos.lon >= EGYPT_BOUNDS.lonMin &&
      pos.lon <= EGYPT_BOUNDS.lonMax;

    if (!inEgypt) {
      startPick(
        isAr
          ? 'يبدو أنك خارج مصر. يغطي SolarSense المواقع المصرية، لذا اختر المكان الذي تخطط له.'
          : 'You appear to be outside Egypt. SolarSense covers Egyptian sites, so choose the place you are planning for.'
      );
      return;
    }

    setLocatingText(
      isAr ? 'تم تحديد الموقع. جاري الهبوط إلى موقعك.' : 'Got it. Descending to your location.'
    );
    place(pos.lat, pos.lon, { source: 'gps', acc: pos.acc, animate: true });
  }, [fly, isAr, place, showStage, startPick]);

  // Mount MapLibre GL once when first opened and keep alive for instant subsequent opens
  useEffect(() => {
    if (!hasOpened || !mapContainerRef.current || mapRef.current) return;

    prewarmEgyptTiles();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: INTRO_VIEW.center,
      zoom: INTRO_VIEW.zoom,
      maxZoom: 13.5,
      maxTileCacheSize: 1000,
      fadeDuration: 650,
      attributionControl: { compact: true },
      style: {
        version: 8,
        projection: { type: 'globe' },
        sky: {
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
        },
        sources: {
          // Persistent low-zoom base layer (z=0..6) kept in memory so zooming never shows raw blocky gaps
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
          // High-resolution detail layer with smooth 750ms cross-fade & linear resampling
          sat: {
            type: 'raster',
            tileSize: 256,
            minzoom: 0,
            maxzoom: 14,
            tiles: [
              'https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              'https://b.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              'https://c.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              'https://d.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
            ],
            attribution:
              'Sentinel-2 cloudless 2020 by <a href="https://s2maps.eu" target="_blank" rel="noopener">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)',
          },
          'hover-cell': {
            type: 'geojson',
            data: EMPTY_FC,
          },
          cell: {
            type: 'geojson',
            data: EMPTY_FC,
          },
        },
        layers: [
          {
            id: 'space',
            type: 'background',
            paint: { 'background-color': '#060912', 'background-opacity': 0 },
          },
          {
            id: 'sat-base-layer',
            type: 'raster',
            source: 'sat-base',
            paint: {
              'raster-resampling': 'linear',
              'raster-saturation': 0.08,
              'raster-contrast': 0.06,
              'raster-fade-duration': 0,
            },
          },
          {
            id: 'sat',
            type: 'raster',
            source: 'sat',
            paint: {
              'raster-resampling': 'linear',
              'raster-saturation': 0.08,
              'raster-contrast': 0.06,
              'raster-fade-duration': 750,
            },
          },
          // Instant 60fps hover preview of the 0.25° weather grid square
          {
            id: 'hover-cell-fill',
            type: 'fill',
            source: 'hover-cell',
            paint: { 'fill-color': '#3fc1c1', 'fill-opacity': 0.07 },
          },
          {
            id: 'hover-cell-line',
            type: 'line',
            source: 'hover-cell',
            paint: {
              'line-color': '#8fe3e3',
              'line-width': 1.2,
              'line-opacity': 0.55,
              'line-dasharray': [2, 2],
            },
          },
          // Selected 0.25° weather data cell square (matches location_globe_prototype.html)
          {
            id: 'cell-fill',
            type: 'fill',
            source: 'cell',
            paint: { 'fill-color': '#3fc1c1', 'fill-opacity': 0.14 },
          },
          {
            id: 'cell-glow',
            type: 'line',
            source: 'cell',
            paint: {
              'line-color': '#3fc1c1',
              'line-width': 5,
              'line-opacity': 0.22,
              'line-blur': 2,
            },
          },
          {
            id: 'cell-line',
            type: 'line',
            source: 'cell',
            paint: {
              'line-color': '#8fe3e3',
              'line-width': 2,
              'line-dasharray': [2, 2],
            },
          },
        ],
      },
    });

    map.dragRotate.disable();
    mapRef.current = map;

    let zoomSettleTimer: ReturnType<typeof setTimeout> | null = null;
    map.on('zoomstart', () => {
      if (zoomSettleTimer) clearTimeout(zoomSettleTimer);
      setIsZooming(true);
    });
    map.on('zoomend', () => {
      if (zoomSettleTimer) clearTimeout(zoomSettleTimer);
      zoomSettleTimer = setTimeout(() => setIsZooming(false), 180);
    });

    let rafId = 0;
    const spinLoop = () => {
      if (openRef.current && spinningRef.current && !reduceMotion && !map.isMoving()) {
        const c = map.getCenter();
        map.setCenter([c.lng + 0.06, c.lat]);
      }
      rafId = requestAnimationFrame(spinLoop);
    };

    map.on('load', () => {
      rafId = requestAnimationFrame(spinLoop);
    });

    map.on('mousedown', () => {
      spinningRef.current = false;
    });
    map.on('touchstart', () => {
      spinningRef.current = false;
    });

    // Live 60fps hover square preview over Egypt + speculative tile pre-warming under cursor
    let lastHoverId = '';
    map.on('mousemove', (e) => {
      const curStage = stageRef.current;
      if (curStage !== 'pick' && curStage !== 'placed') return;
      const { lat, lng } = e.lngLat;
      if (
        lat < EGYPT_BOUNDS.latMin - 1 ||
        lat > EGYPT_BOUNDS.latMax + 1 ||
        lng < EGYPT_BOUNDS.lonMin - 1 ||
        lng > EGYPT_BOUNDS.lonMax + 1
      ) {
        if (lastHoverId !== '') {
          lastHoverId = '';
          const hoverSrc = map.getSource('hover-cell') as maplibregl.GeoJSONSource | undefined;
          hoverSrc?.setData(EMPTY_FC);
        }
        return;
      }
      const snapped = snapToGridCell(lat, lng);
      if (snapped.cellId !== lastHoverId) {
        lastHoverId = snapped.cellId;
        const hoverSrc = map.getSource('hover-cell') as maplibregl.GeoJSONSource | undefined;
        hoverSrc?.setData(buildCellFeatureCollection(snapped.cellLat, snapped.cellLon));
        // Pre-warm mid-zoom tiles (z=7,8,9) around the hovered cell so clicking it unpixelizes smoothly
        for (const z of [7, 8, 9]) {
          preloadTileUrl(z, lon2tile(snapped.cellLon, z), lat2tile(snapped.cellLat, z));
        }
      }
    });

    map.on('click', (e) => {
      const curStage = stageRef.current;
      if (curStage !== 'pick' && curStage !== 'placed') return;
      place(e.lngLat.lat, e.lngLat.lng, {
        source: 'picked',
        animate: curStage === 'pick',
      });
    });

    return () => {
      if (zoomSettleTimer) clearTimeout(zoomSettleTimer);
      cancelAnimationFrame(rafId);
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [hasOpened, place]);

  // Handle opening / closing & Escape key
  useEffect(() => {
    if (!open) return;

    const map = mapRef.current;
    if (map) {
      map.resize();
    }

    if (autoLocate) {
      void locate();
    } else {
      spinningRef.current = true;
      showStage('intro');
      if (map) {
        map.jumpTo({ center: INTRO_VIEW.center, zoom: INTRO_VIEW.zoom, pitch: 0, bearing: 0 });
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, autoLocate, locate, onClose, showStage]);

  const regionInfo = REGIONS[site.region];
  const ns = site.lat >= 0 ? 'N' : 'S';
  const ew = site.lon >= 0 ? 'E' : 'W';
  const formattedPos = `${Math.abs(site.lat).toFixed(4)}° ${ns}, ${Math.abs(site.lon).toFixed(4)}° ${ew}`;

  const formattedSource =
    placeSource === 'gps'
      ? isAr
        ? `موقع المتصفح${gpsAccuracy ? ` (± ${gpsAccuracy >= 1000 ? (gpsAccuracy / 1000).toFixed(1) + ' كم' : Math.round(gpsAccuracy) + ' م'})` : ''}`
        : `Browser location${gpsAccuracy ? ` (± ${gpsAccuracy >= 1000 ? (gpsAccuracy / 1000).toFixed(1) + ' km' : Math.round(gpsAccuracy) + ' m'})` : ''}`
      : placeSource === 'adjusted'
        ? isAr
          ? 'تم تحريك الدبوس بواسطتك'
          : 'Pin moved by you'
        : isAr
          ? 'تم اختياره على الخريطة'
          : 'Picked on the map';

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden bg-[#05070f] text-[#eef0f7] transition-opacity duration-300 ${
        open ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={isAr ? 'اختر موقعك' : 'Choose your location'}
    >
      {/* Star field behind the transparent area around the 3D globe */}
      <div className="globe-space" />

      {/* MapLibre 3D Globe container (.lifted in intro state, smooth optical focus-pull filter during zoom) */}
      <div
        ref={mapContainerRef}
        className={`globe-map ${stage === 'intro' ? 'lifted' : ''} ${
          isZooming ? 'globe-zoom-soft' : 'globe-zoom-sharp'
        }`}
        aria-label="Globe showing your location"
      />

      {/* Vignette overlay */}
      <div className="globe-vignette" />

      {/* Close button matching day_arc_prototype.html #globe-close */}
      <button
        type="button"
        onClick={onClose}
        className="fixed top-[14px] right-[16px] z-20 cursor-pointer rounded-full border border-white/[0.16] bg-[#05070f]/78 px-[18px] py-[11px] text-[14px] text-[#f4f5fa] backdrop-blur-[10px] transition hover:border-[#ffd166]"
      >
        {isAr ? 'إغلاق ✕' : 'Close ✕'}
      </button>

      {/* Bottom Stage Panel matching location_globe_prototype.html .stage > .panel */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center p-5">
        <div
          className="pointer-events-auto w-[min(560px,100%)] rounded-[20px] border border-white/[0.14] bg-[#0c1022]/72 px-[22px] py-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-[14px]"
          aria-live="polite"
        >
          {/* STATE 1: s-intro */}
          {stage === 'intro' && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#a4a9bd]">
                {isAr ? 'الضحى' : 'Late morning'}
              </div>
              <h1 className="mt-1.5 mb-2 font-serif text-[clamp(24px,4.4vw,34px)] leading-[1.1] font-semibold text-[#eef0f7]">
                {isAr
                  ? 'كل سماء في مصر مختلفة. أيّها سماؤك؟'
                  : 'Every sky in Egypt is different. Which one is yours?'}
              </h1>
              <p className="mb-3.5 text-[15px] leading-[1.5] text-[#cfd3e2]">
                {isAr
                  ? 'اسمح لمتصفحك بمشاركة موقعك وسنحلق إلى هناك، أو اختر مكاناً بنفسك.'
                  : 'Let your browser share your position and we will fly there, or pick a place yourself.'}
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void locate()}
                  className="cursor-pointer rounded-full border border-[#f5a524] bg-[#f5a524] px-[18px] py-[11px] text-[15px] font-semibold text-[#2a1a00] transition hover:bg-[#ffd166]"
                >
                  {isAr ? 'حدد موقعي' : 'Find my location'}
                </button>
                <button
                  type="button"
                  onClick={() => startPick('')}
                  className="cursor-pointer rounded-full border border-white/[0.14] bg-transparent px-[18px] py-[11px] text-[15px] text-[#eef0f7] transition hover:border-[#ffd166]"
                >
                  {isAr ? 'اختر على الخريطة' : 'Choose on the map'}
                </button>
              </div>
              <div className="mt-3 text-[12px] text-[#a4a9bd]">
                {isAr
                  ? 'يُستخدم موقعك داخل هذه الصفحة فقط. ولا يتم إرساله إلى SolarSense أو تخزينه.'
                  : 'Your position is used in this page only. It is not sent to SolarSense or stored.'}
              </div>
            </div>
          )}

          {/* STATE 2: s-locating */}
          {stage === 'locating' && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#a4a9bd]">
                {isAr ? 'جاري تحديد الموقع' : 'Locating'}
              </div>
              <h1 className="mt-1.5 mb-2 font-serif text-[clamp(24px,4.4vw,34px)] leading-[1.1] font-semibold text-[#eef0f7]">
                {isAr ? 'نحلق إلى مصر…' : 'Flying to Egypt…'}
              </h1>
              <div className="flex items-center gap-2.5 text-[14px] text-[#dfe3f1]">
                <span className="globe-spin" />
                <span>{locatingText}</span>
              </div>
            </div>
          )}

          {/* STATE 3: s-pick */}
          {stage === 'pick' && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#a4a9bd]">
                {isAr ? 'اختر مكاناً' : 'Choose a place'}
              </div>
              <h1 className="mt-1.5 mb-2 font-serif text-[clamp(24px,4.4vw,34px)] leading-[1.1] font-semibold text-[#eef0f7]">
                {isAr ? 'انقر على أي مكان في مصر' : 'Click anywhere in Egypt'}
              </h1>
              {pickMessage && (
                <div className="mb-3 rounded-[12px] border border-[#f5a524]/40 bg-[#f5a524]/12 px-3 py-2.5 text-[14px] text-[#eef0f7]">
                  {pickMessage}
                </div>
              )}
              <p className="mb-3.5 text-[15px] leading-[1.5] text-[#cfd3e2]">
                {isAr
                  ? 'كبّر الخريطة واسحبها، ثم انقر على موقعك. أو ابدأ من مكان معروف:'
                  : 'Zoom and drag the map, then click your site. Or start from a known place:'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PLACES.map(([nameEn, nameAr, lat, lon]) => (
                  <button
                    key={nameEn}
                    type="button"
                    onMouseEnter={() => preloadTargetPyramid(lat, lon)}
                    onClick={() => place(lat, lon, { source: 'picked', animate: true })}
                    className="cursor-pointer rounded-full border border-white/[0.14] bg-transparent px-3 py-1.5 text-[13px] text-[#dfe3f1] transition hover:border-[#ffd166] hover:text-white"
                  >
                    {isAr ? nameAr : nameEn}
                  </button>
                ))}
              </div>
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void locate()}
                  className="cursor-pointer rounded-full border border-white/[0.14] bg-transparent px-[18px] py-[11px] text-[15px] text-[#eef0f7] transition hover:border-[#ffd166]"
                >
                  {isAr ? 'جرب تحديد موقعي مرة أخرى' : 'Try my location again'}
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: s-placed */}
          {stage === 'placed' && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#a4a9bd]">
                {placeSource === 'gps'
                  ? isAr
                    ? 'موقعك'
                    : 'Your location'
                  : isAr
                    ? 'الموقع المختار'
                    : 'Chosen location'}
              </div>
              <h1 className="mt-1.5 mb-2 font-serif text-[clamp(24px,4.4vw,34px)] leading-[1.1] font-semibold text-[#eef0f7]">
                {placeSource === 'gps'
                  ? isAr
                    ? 'وجدناك.'
                    : 'Found you.'
                  : isAr
                    ? 'تم التثبيت.'
                    : 'Pinned.'}
              </h1>
              {placedMessage && (
                <div className="mb-3 rounded-[12px] border border-[#f5a524]/40 bg-[#f5a524]/12 px-3 py-2.5 text-[14px] text-[#eef0f7]">
                  {placedMessage}
                </div>
              )}

              <dl className="my-1.5 mb-3.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
                <dt className="text-[#a4a9bd]">{isAr ? 'الإحداثيات' : 'Position'}</dt>
                <dd className="m-0 font-semibold text-[#eef0f7]">{formattedPos}</dd>

                <dt className="text-[#a4a9bd]">{isAr ? 'المصدر' : 'Source'}</dt>
                <dd className="m-0 font-semibold text-[#eef0f7]">{formattedSource}</dd>

                <dt className="text-[#a4a9bd]">{isAr ? 'الإقليم المناخي' : 'Climate region'}</dt>
                <dd className="m-0 font-semibold text-[#eef0f7]">
                  {isAr ? regionInfo.nameAr : regionInfo.nameEn}{' '}
                  <span className="ml-1 inline-block rounded-full bg-[#3fc1c1]/18 px-2.5 py-0.5 text-[12px] font-semibold text-[#8fe3e3]">
                    {isAr ? 'مبدئي' : 'provisional'}
                  </span>
                </dd>

                <dt className="text-[#a4a9bd]">
                  {isAr ? 'خلية بيانات الطقس' : 'Weather data cell'}
                </dt>
                <dd className="m-0 font-semibold text-[#eef0f7]">
                  {site.cellLat.toFixed(2)}° N, {site.cellLon.toFixed(2)}° E{' '}
                  {site.inCoverage ? (
                    <span className="ml-1 inline-block rounded-full bg-[#3fc1c1]/18 px-2.5 py-0.5 text-[12px] font-semibold text-[#8fe3e3]">
                      {isAr ? 'ضمن التغطية' : 'in coverage'}
                    </span>
                  ) : (
                    <span className="ml-1 inline-block rounded-full bg-[#f5a524]/18 px-2.5 py-0.5 text-[12px] font-semibold text-[#ffd166]">
                      {isAr ? 'أقرب خلية' : 'nearest cell'}
                    </span>
                  )}
                </dd>
              </dl>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onSelectLocation(site, formattedSource);
                    onClose();
                  }}
                  className="cursor-pointer rounded-full border border-[#f5a524] bg-[#f5a524] px-[18px] py-[11px] text-[15px] font-semibold text-[#2a1a00] transition hover:bg-[#ffd166]"
                >
                  {isAr ? 'استخدم هذا الموقع' : 'Use this location'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    startPick('');
                    void fly({ ...EGYPT_VIEW, pitch: 0, bearing: 0, duration: 1500 });
                  }}
                  className="cursor-pointer rounded-full border border-white/[0.14] bg-transparent px-[18px] py-[11px] text-[15px] text-[#eef0f7] transition hover:border-[#ffd166]"
                >
                  {isAr ? 'اختر موقعاً آخر' : 'Choose another'}
                </button>
              </div>

              <div className="mt-3 text-[12px] text-[#a4a9bd]">
                {isAr
                  ? 'اسحب الدبوس أو انقر على الخريطة للتعديل. حدود الأقاليم مبدئية.'
                  : 'Drag the pin or click the map to adjust. Region borders are provisional.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
