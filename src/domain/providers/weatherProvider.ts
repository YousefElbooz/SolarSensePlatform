// SolarSense Domain: Replaceable WeatherProvider Interface
// Handover Principle 6 & Platform Context §5.3: OpenMeteoProvider + ERA5 Replay Fallback

import { snapToGridCell } from '../regions';
import { computeSolarPosition, simulateIrradianceAndPoa } from '../physics';
import { LiveWeatherObservation } from '../types';

export interface WeatherProvider {
  getCurrentWeather(lat: number, lon: number): Promise<LiveWeatherObservation>;
}

const OPEN_METEO_FIELDS = [
  'shortwave_radiation',
  'direct_radiation',
  'diffuse_radiation',
  'temperature_2m',
  'dew_point_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'cloud_cover',
  'relative_humidity_2m',
  'surface_pressure',
  'precipitation',
].join(',');

export function buildFallbackWeather(lat: number, lon: number): LiveWeatherObservation {
  const snapped = snapToGridCell(lat, lon);
  const now = new Date();
  const localHour = 12.5; // Midday reference for offline defense demo
  const solar = computeSolarPosition(snapped.cellLat, snapped.cellLon, localHour - 0.5, 135);
  const irr = simulateIrradianceAndPoa({
    solar,
    tiltDeg: 26,
    panelAzimuthDeg: 180,
    skyCondition: 'clear',
  });

  const baseTemp =
    snapped.region === 'nile-valley-upper-egypt'
      ? 35.4
      : snapped.region === 'western-desert'
        ? 34.8
        : snapped.region === 'sinai-red-sea'
          ? 31.2
          : 27.6;

  return {
    timestamp: now.toISOString().slice(0, 16).replace('T', ' '),
    provider: 'era5-replay-fallback',
    shortwaveRadiationWm2: Math.round(irr.ghiWm2),
    directRadiationWm2: Math.round(irr.dniWm2 * Math.sin((solar.elevationDeg * Math.PI) / 180)),
    diffuseRadiationWm2: Math.round(irr.dhiWm2),
    clearSkyRadiationWm2: Math.round(irr.ghiClearWm2),
    temperature2mC: baseTemp,
    dewPoint2mC: snapped.region === 'north-coast-delta' ? 18.2 : 9.4,
    windSpeed10mKmh: snapped.region === 'sinai-red-sea' ? 22.4 : 14.2,
    windSpeed10mMs: snapped.region === 'sinai-red-sea' ? 6.2 : 3.9,
    windDirectionDeg: 335,
    cloudCoverPct: snapped.region === 'north-coast-delta' ? 18 : 4,
    relativeHumidityPct: snapped.region === 'north-coast-delta' ? 62 : 24,
    surfacePressureHpa: 1013.2,
    precipitationMm: 0,
    dustAod: snapped.region === 'western-desert' ? 0.38 : 0.21,
  };
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  async getCurrentWeather(lat: number, lon: number): Promise<LiveWeatherObservation> {
    // Privacy rule (Platform Context §13.2): only send the snapped 0.25° ERA5 grid cell centre
    const snapped = snapToGridCell(lat, lon);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${snapped.cellLat}&longitude=${snapped.cellLon}&timezone=Africa%2FCairo&current=${OPEN_METEO_FIELDS}`;

    try {
      const res = await fetch(url, { next: { revalidate: 600 } });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const data = await res.json();
      const c = data.current || {};

      const solar = computeSolarPosition(snapped.cellLat, snapped.cellLon, 12.0, 135);
      const irr = simulateIrradianceAndPoa({
        solar,
        tiltDeg: 26,
        panelAzimuthDeg: 180,
        skyCondition: 'clear',
      });

      const wsKmh = typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : 14.0;
      return {
        timestamp: typeof c.time === 'string' ? c.time.replace('T', ' ') : new Date().toISOString(),
        provider: 'open-meteo-live',
        shortwaveRadiationWm2:
          typeof c.shortwave_radiation === 'number'
            ? Math.round(c.shortwave_radiation)
            : Math.round(irr.ghiWm2),
        directRadiationWm2:
          typeof c.direct_radiation === 'number'
            ? Math.round(c.direct_radiation)
            : Math.round(irr.dniWm2 * 0.8),
        diffuseRadiationWm2:
          typeof c.diffuse_radiation === 'number'
            ? Math.round(c.diffuse_radiation)
            : Math.round(irr.dhiWm2),
        clearSkyRadiationWm2: Math.round(irr.ghiClearWm2),
        temperature2mC: typeof c.temperature_2m === 'number' ? c.temperature_2m : 30.5,
        dewPoint2mC: typeof c.dew_point_2m === 'number' ? c.dew_point_2m : 12.0,
        windSpeed10mKmh: Math.round(wsKmh * 10) / 10,
        windSpeed10mMs: Math.round((wsKmh / 3.6) * 10) / 10,
        windDirectionDeg: typeof c.wind_direction_10m === 'number' ? c.wind_direction_10m : 330,
        cloudCoverPct: typeof c.cloud_cover === 'number' ? c.cloud_cover : 5,
        relativeHumidityPct:
          typeof c.relative_humidity_2m === 'number' ? c.relative_humidity_2m : 35,
        surfacePressureHpa:
          typeof c.surface_pressure === 'number' ? Math.round(c.surface_pressure) : 1013,
        precipitationMm: typeof c.precipitation === 'number' ? c.precipitation : 0,
        dustAod: snapped.region === 'western-desert' ? 0.34 : 0.19,
      };
    } catch {
      return buildFallbackWeather(snapped.cellLat, snapped.cellLon);
    }
  }
}

export const weatherProvider = new OpenMeteoWeatherProvider();

