import { NextRequest, NextResponse } from 'next/server';
import { normalizePanelTech } from '@/domain/panels';
import { predictionProvider } from '@/domain/providers/predictionProvider';
import { snapToGridCell } from '@/domain/regions';
import { SkyCondition } from '@/domain/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat') ?? 30.04);
  const lon = Number(searchParams.get('lon') ?? 31.24);
  const tech = normalizePanelTech(searchParams.get('tech'));
  const kWp = Number(searchParams.get('kWp') ?? 5.0);
  const panelCount = Number(searchParams.get('panelCount') ?? 14);
  const horizonRaw = Number(searchParams.get('horizon') ?? 1);
  const horizonH: 1 | 6 | 24 = horizonRaw === 6 ? 6 : horizonRaw === 24 ? 24 : 1;
  const mode = searchParams.get('mode') === 'live' ? 'live' : 'replay';
  const sky = (searchParams.get('sky') as SkyCondition) || 'clear';

  const site = snapToGridCell(lat, lon);
  const system = {
    tech,
    panelCount,
    kWp,
    tiltDeg: Math.round(site.cellLat * 0.9),
    azimuthDeg: 180,
  };

  const forecast = predictionProvider.forecast({
    site,
    system,
    horizonH,
    mode,
    skyCondition: sky,
  });
  const yieldResult = predictionProvider.yield(site, system);

  return NextResponse.json({
    site,
    system,
    forecast,
    yield: yieldResult,
  });
}

