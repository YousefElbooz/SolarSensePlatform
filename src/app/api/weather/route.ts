import { NextRequest, NextResponse } from 'next/server';
import { isValidDatasetHourUtc } from '@/domain/features';
import { classifyWeatherDateEndpoint, fetch23WeatherFeatures } from '@/domain/providers/weatherProvider';
import { isValidRegionId } from '@/domain/regions';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const regionParam = searchParams.get('region');
  const dateParam = searchParams.get('date');
  const hourParam = searchParams.get('hour');

  if (!isValidRegionId(regionParam)) {
    return NextResponse.json(
      {
        error: "Invalid or missing field 'region'. Must be one of the saved regions: north-coast-delta, western-desert, sinai-red-sea, nile-valley-upper-egypt.",
        field: 'region',
      },
      { status: 400 }
    );
  }

  if (!dateParam) {
    return NextResponse.json(
      {
        error: "Missing required field 'date' (YYYY-MM-DD).",
        field: 'date',
      },
      { status: 400 }
    );
  }

  const dateCheck = classifyWeatherDateEndpoint(dateParam);
  if (!dateCheck.valid) {
    return NextResponse.json(
      {
        error: dateCheck.reason || "Invalid field 'date'.",
        field: 'date',
      },
      { status: 400 }
    );
  }

  const hourUtc = Number(hourParam);
  if (hourParam === null || hourParam.trim() === '' || !isValidDatasetHourUtc(hourUtc)) {
    return NextResponse.json(
      {
        error: "Invalid or missing field 'hour'. Must be an integer within dataset hours 2–17 UTC.",
        field: 'hour',
      },
      { status: 400 }
    );
  }

  try {
    const result = await fetch23WeatherFeatures({
      region: regionParam,
      date: dateParam,
      hourUtc,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Upstream weather service request failed.';
    return NextResponse.json(
      {
        error: `Weather request failed: ${message}. Enter weather values manually or try another date.`,
        field: 'weather_api',
      },
      { status: 502 }
    );
  }
}
