import { NextResponse } from 'next/server';
import { ERA5_GRID } from '@/domain/regions';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'SolarSense Platform v1.0',
    timestamp: new Date().toISOString(),
    era5GridCells: ERA5_GRID.totalCells,
    modesSupported: ['replay', 'live'],
  });
}

