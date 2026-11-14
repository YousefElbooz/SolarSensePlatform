// SolarSense Domain: Region Resolution & Grid Snapping
// Consumes SAVED_REGIONS from regions.config.ts (single source of truth)

import {
  ANCHOR_CITIES,
  EGYPT_BOUNDS,
  ERA5_GRID,
  SAVED_REGIONS,
  SAVED_REGION_LIST,
} from './regions.config';
import { AnchorCity, RegionId, RegionInfo, SitePoint } from './types';

export { ANCHOR_CITIES, EGYPT_BOUNDS, ERA5_GRID, SAVED_REGIONS, SAVED_REGION_LIST };

// Alias for existing callers
export const REGIONS: Record<RegionId, RegionInfo> = SAVED_REGIONS;

// Nile corridor centerline [lat, lon] for regional classification
const NILE_SPINE: [number, number][] = [
  [31.75, 31.2],
  [30.0, 31.2],
  [29.0, 31.1],
  [28.1, 30.75],
  [27.2, 31.2],
  [26.2, 32.4],
  [25.7, 32.65],
  [24.1, 32.9],
  [23.75, 32.9],
];

function interpolateNileLon(lat: number): number {
  for (let i = 0; i < NILE_SPINE.length - 1; i++) {
    const [latA, lonA] = NILE_SPINE[i];
    const [latB, lonB] = NILE_SPINE[i + 1];
    if (lat <= latA && lat >= latB) {
      return lonA + ((lonB - lonA) * (latA - lat)) / (latA - latB);
    }
  }
  return lat > NILE_SPINE[0][0] ? NILE_SPINE[0][1] : NILE_SPINE[NILE_SPINE.length - 1][1];
}

export function classifyRegion(lat: number, lon: number): RegionId {
  if (lon >= 32.4 && lat >= 29.0) return 'sinai-red-sea';
  if (lat >= 30.35) return 'north-coast-delta';
  const redSeaCoastLon = 32.6 + (29.0 - lat) * 0.55;
  if (lon >= redSeaCoastLon - 0.7) return 'sinai-red-sea';
  const deltaFromNile = lon - interpolateNileLon(lat);
  if (Math.abs(deltaFromNile) <= 0.65) return 'nile-valley-upper-egypt';
  return deltaFromNile < 0 ? 'western-desert' : 'sinai-red-sea';
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function isValidRegionId(raw?: string | null): raw is RegionId {
  if (!raw) return false;
  return Object.prototype.hasOwnProperty.call(SAVED_REGIONS, raw);
}

export function resolveRegion(raw?: string | null): RegionInfo {
  if (isValidRegionId(raw)) {
    return SAVED_REGIONS[raw];
  }
  // Support numeric region number ("1".."4") or code ("R1".."R4")
  if (raw) {
    const trimmed = raw.trim().toUpperCase();
    const byCode = SAVED_REGION_LIST.find(
      (r) => r.code === trimmed || String(r.regionNumber) === trimmed
    );
    if (byCode) return byCode;
  }
  return SAVED_REGIONS['nile-valley-upper-egypt'];
}

export function snapToSavedRegion(
  lat: number,
  lon: number
): {
  accepted: boolean;
  region: RegionInfo;
  closestRegion: RegionInfo;
  distanceToRepKm: number;
  messageEn?: string;
  messageAr?: string;
} {
  const half = ERA5_GRID.step / 2;
  const inEra5Grid =
    lat >= ERA5_GRID.latMin - half &&
    lat <= ERA5_GRID.latMax + half &&
    lon >= ERA5_GRID.lonMin - half &&
    lon <= ERA5_GRID.lonMax + half;

  let closestRegion = SAVED_REGION_LIST[0];
  let minKm = Infinity;
  for (const reg of SAVED_REGION_LIST) {
    const d = haversineKm(lat, lon, reg.representativePoint.lat, reg.representativePoint.lon);
    if (d < minKm) {
      minKm = d;
      closestRegion = reg;
    }
  }

  if (!inEra5Grid) {
    return {
      accepted: false,
      region: closestRegion,
      closestRegion,
      distanceToRepKm: Math.round(minKm),
      messageEn: `Selected coordinates (${lat.toFixed(2)}° N, ${lon.toFixed(2)}° E) are outside the saved ERA5 regions. Closest saved region: ${closestRegion.nameEn}.`,
      messageAr: `الإحداثيات المختارة (${lat.toFixed(2)}° ش، ${lon.toFixed(2)}° ق) خارج نطاق المناطق المحفوظة. أقرب منطقة محفوظة: ${closestRegion.nameAr}.`,
    };
  }

  const classifiedId = classifyRegion(lat, lon);
  const region = SAVED_REGIONS[classifiedId];
  const distKm = Math.round(
    haversineKm(lat, lon, region.representativePoint.lat, region.representativePoint.lon)
  );

  return {
    accepted: true,
    region,
    closestRegion: region,
    distanceToRepKm: distKm,
  };
}

export function snapToGridCell(lat: number, lon: number): SitePoint {
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const half = ERA5_GRID.step / 2;
  const inCoverage =
    lat >= ERA5_GRID.latMin - half &&
    lat <= ERA5_GRID.latMax + half &&
    lon >= ERA5_GRID.lonMin - half &&
    lon <= ERA5_GRID.lonMax + half;

  const cellLat = clamp(
    Math.round(lat / ERA5_GRID.step) * ERA5_GRID.step,
    ERA5_GRID.latMin,
    ERA5_GRID.latMax
  );
  const cellLon = clamp(
    Math.round(lon / ERA5_GRID.step) * ERA5_GRID.step,
    ERA5_GRID.lonMin,
    ERA5_GRID.lonMax
  );
  const cellId = `${cellLat.toFixed(2)}_${cellLon.toFixed(2)}`;
  const region = classifyRegion(cellLat, cellLon);
  const distanceKm = haversineKm(lat, lon, cellLat, cellLon);

  let closestAnchor: AnchorCity | undefined;
  let minDist = 45;
  for (const a of ANCHOR_CITIES) {
    const d = haversineKm(cellLat, cellLon, a.lat, a.lon);
    if (d < minDist) {
      minDist = d;
      closestAnchor = a;
    }
  }

  return {
    lat,
    lon,
    cellLat,
    cellLon,
    cellId,
    inCoverage,
    distanceKm: Math.round(distanceKm * 10) / 10,
    region,
    anchorName: closestAnchor?.nameEn,
  };
}
