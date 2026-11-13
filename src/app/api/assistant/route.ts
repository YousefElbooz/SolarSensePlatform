import { NextRequest, NextResponse } from 'next/server';
import { runGroundedAssistantQuery } from '@/domain/agent';
import { SkyCondition } from '@/domain/types';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const siteId = typeof body.siteId === 'string' ? body.siteId : 'benban-1mw';
  const query =
    typeof body.query === 'string'
      ? body.query
      : 'What is today’s solar forecast and when should we schedule the water pump?';
  const horizonRaw = Number(body.horizonH ?? 1);
  const horizonH: 1 | 6 | 24 = horizonRaw === 6 ? 6 : horizonRaw === 24 ? 24 : 1;
  const skyCondition: SkyCondition = body.skyCondition || 'clear';

  const reply = runGroundedAssistantQuery({
    siteId,
    query,
    horizonH,
    skyCondition,
  });

  return NextResponse.json(reply);
}

