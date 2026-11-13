import { NextRequest, NextResponse } from 'next/server';
import { runAssessment } from '@/domain/business';
import { normalizePanelTech } from '@/domain/panels';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const assessment = runAssessment({
    tech: normalizePanelTech(body.tech),
    lat: typeof body.lat === 'number' ? body.lat : 30.04,
    lon: typeof body.lon === 'number' ? body.lon : 31.24,
    usableAreaM2: typeof body.usableAreaM2 === 'number' ? body.usableAreaM2 : 45,
    budgetEgp: typeof body.budgetEgp === 'number' ? body.budgetEgp : 180000,
    monthlyBillEgp: typeof body.monthlyBillEgp === 'number' ? body.monthlyBillEgp : 2400,
    daytimeSharePct: typeof body.daytimeSharePct === 'number' ? body.daytimeSharePct : 45,
    sector: body.sector === 'commercial' ? 'commercial' : 'residential',
  });

  return NextResponse.json(assessment);
}

