import { NextRequest, NextResponse } from 'next/server';
import { OPERATE_SITES } from '@/domain/benchmarkData';
import { predictionProvider } from '@/domain/providers/predictionProvider';
import { snapToGridCell } from '@/domain/regions';
import { DEFAULT_FLEXIBLE_LOADS, recommendOptimalLoadWindow } from '@/domain/scheduler';
import { FlexibleLoadItem, SkyCondition } from '@/domain/types';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const siteId = typeof body.siteId === 'string' ? body.siteId : 'benban-1mw';
  const skyCondition: SkyCondition = body.skyCondition || 'clear';
  const siteRecord = OPERATE_SITES.find((s) => s.id === siteId) || OPERATE_SITES[0];
  const sitePoint = snapToGridCell(siteRecord.lat, siteRecord.lon);

  const forecast = predictionProvider.forecast({
    site: sitePoint,
    system: {
      tech: siteRecord.tech,
      panelCount: Math.round((siteRecord.capacityKwp * 1000) / 400),
      kWp: siteRecord.capacityKwp,
      tiltDeg: siteRecord.tiltDeg,
      azimuthDeg: siteRecord.azimuthDeg,
    },
    horizonH: 1,
    mode: siteRecord.status === 'online-live' ? 'live' : 'replay',
    skyCondition,
  });

  const loads: FlexibleLoadItem[] = Array.isArray(body.loads) ? body.loads : DEFAULT_FLEXIBLE_LOADS;
  const recommendations = loads.map((l) =>
    recommendOptimalLoadWindow(forecast.points, l, siteRecord.baseLoadKw)
  );

  return NextResponse.json({
    site: siteRecord,
    forecast,
    recommendations,
  });
}

