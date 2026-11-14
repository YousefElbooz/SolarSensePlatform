import { NextResponse } from 'next/server';
import { ERA5_GRID, SAVED_REGION_LIST } from '@/domain/regions';
import { FEATURE_KEYS_23 } from '@/domain/features';

export async function GET() {
  const pythonUrl = process.env.PYTHON_ML_SERVICE_URL?.replace(/\/+$/, '') || null;
  return NextResponse.json({
    status: 'ok',
    service: 'SolarSense Platform (Focused 3-Page Edition)',
    timestamp: new Date().toISOString(),
    era5GridCells: ERA5_GRID.totalCells,
    savedRegions: SAVED_REGION_LIST.map((r) => r.id),
    featureCount: FEATURE_KEYS_23.length,
    pythonMlServerConfigured: Boolean(pythonUrl),
    predictionSource: pythonUrl ? 'model' : 'stand-in',
  });
}

