import { NextRequest, NextResponse } from 'next/server';
import { weatherProvider } from '@/domain/providers/weatherProvider';
import { snapToGridCell, REGIONS } from '@/domain/regions';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat') ?? 30.04);
  const lon = Number(searchParams.get('lon') ?? 31.24);

  const site = snapToGridCell(lat, lon);
  const weather = await weatherProvider.getCurrentWeather(site.cellLat, site.cellLon);

  return NextResponse.json({
    site,
    region: REGIONS[site.region],
    weather,
  });
}

