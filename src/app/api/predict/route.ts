import { NextRequest, NextResponse } from 'next/server';
import { isValidDatasetHourUtc, validateDatasetFeatureVector } from '@/domain/features';
import { PANEL_TECHNOLOGIES } from '@/domain/panels';
import { evaluatePointPrediction } from '@/domain/providers/predictionProvider';
import { isValidRegionId } from '@/domain/regions';
import { PanelTech } from '@/domain/types';

function isValidPanelTech(raw: unknown): raw is PanelTech {
  return typeof raw === 'string' && Object.prototype.hasOwnProperty.call(PANEL_TECHNOLOGIES, raw);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.', field: 'body' },
      { status: 400 }
    );
  }

  const { region, datetimeUtc, panelTech, features } = body;

  if (typeof region !== 'string' || !isValidRegionId(region)) {
    return NextResponse.json(
      {
        error:
          "Invalid or missing field 'region'. Must be one of the saved regions: north-coast-delta, western-desert, sinai-red-sea, nile-valley-upper-egypt.",
        field: 'region',
      },
      { status: 400 }
    );
  }

  if (
    typeof datetimeUtc !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(datetimeUtc)
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid or missing field 'datetimeUtc'. Must be an ISO UTC timestamp (e.g., '2026-11-20T10:00:00Z').",
        field: 'datetimeUtc',
      },
      { status: 400 }
    );
  }

  const hourUtc = Number(datetimeUtc.slice(11, 13));
  if (!isValidDatasetHourUtc(hourUtc)) {
    return NextResponse.json(
      {
        error: `Invalid hour in 'datetimeUtc' (${hourUtc}:00 UTC). Dataset hours are 02:00–17:00 UTC.`,
        field: 'datetimeUtc',
      },
      { status: 400 }
    );
  }

  const resolvedTech: PanelTech = isValidPanelTech(panelTech) ? panelTech : 'pc-Si';
  if (panelTech !== undefined && !isValidPanelTech(panelTech)) {
    return NextResponse.json(
      {
        error: "Invalid field 'panelTech'. Must be 'pc-Si', 'a-Si:H/sc-Si', or 'CIGS'.",
        field: 'panelTech',
      },
      { status: 400 }
    );
  }

  const featureCheck = validateDatasetFeatureVector(features);
  if (!featureCheck.valid || !featureCheck.vector) {
    return NextResponse.json(
      {
        error: featureCheck.errorMessage || "Invalid field 'features'.",
        field: featureCheck.errorField || 'features',
      },
      { status: 400 }
    );
  }

  const response = await evaluatePointPrediction({
    region,
    datetimeUtc,
    panelTech: resolvedTech,
    features: featureCheck.vector,
  });

  return NextResponse.json(response);
}
