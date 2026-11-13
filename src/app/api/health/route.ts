import { NextResponse } from 'next/server';
import { ERA5_GRID } from '@/domain/regions';

export async function GET() {
  const pythonUrl = process.env.PYTHON_ML_SERVICE_URL?.replace(/\/+$/, '') || null;
  return NextResponse.json({
    status: 'ok',
    service: 'SolarSense Platform v1.0',
    timestamp: new Date().toISOString(),
    era5GridCells: ERA5_GRID.totalCells,
    modesSupported: ['replay', 'live'],
    pythonMlServerConfigured: Boolean(pythonUrl),
    predictionMode: pythonUrl ? 'python-ml-service-with-physics-fallback' : 'physics-atlas-fallback',
  });
}

