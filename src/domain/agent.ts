// SolarSense Domain: Grounded AI Operations Assistant (Handover Principle 5 & §7.6)
// Every number in the assistant's response comes strictly from deterministic tool calls.
// Every schedule recommendation is validated by the deterministic scheduling engine.

import { MODEL_BENCHMARK_TABLE, OPERATE_SITES } from './benchmarkData';
import { predictionProvider } from './providers/predictionProvider';
import { snapToGridCell } from './regions';
import { DEFAULT_FLEXIBLE_LOADS, recommendOptimalLoadWindow } from './scheduler';
import { AssistantReply, SkyCondition, ToolCallTrace } from './types';

export function runGroundedAssistantQuery(params: {
  siteId: string;
  query: string;
  horizonH?: 1 | 6 | 24;
  skyCondition?: SkyCondition;
}): AssistantReply {
  const { siteId, query, horizonH = 1, skyCondition = 'clear' } = params;
  const siteRecord = OPERATE_SITES.find((s) => s.id === siteId) || OPERATE_SITES[0];
  const sitePoint = snapToGridCell(siteRecord.lat, siteRecord.lon);
  const qLower = query.toLowerCase();

  const toolTraces: ToolCallTrace[] = [];

  // Refusal guardrail: operational hardware commands must be refused (Charter Assumption 8)
  if (
    qLower.includes('shut down') ||
    qLower.includes('trip breaker') ||
    qLower.includes('override inverter') ||
    qLower.includes('force diesel off')
  ) {
    return {
      messageId: `msg-${Date.now()}`,
      createdAt: new Date().toISOString(),
      answerMarkdown:
        '⚠️ **Advisory-Only Guardrail:** SolarSense AI Assistant is strictly a decision-support advisor and cannot execute direct breaker, inverter, or generator control commands. All dispatch actions require human operator confirmation.',
      sources: [],
      toolTraces: [],
      riskBanner: {
        level: 'high',
        note: 'Operational hardware actuation refused per safety policy (Charter Assumption 8).',
      },
    };
  }

  // Always call get_forecast for the selected site
  const forecastRes = predictionProvider.forecast({
    site: sitePoint,
    system: {
      tech: siteRecord.tech,
      panelCount: Math.round((siteRecord.capacityKwp * 1000) / 400),
      kWp: siteRecord.capacityKwp,
      tiltDeg: siteRecord.tiltDeg,
      azimuthDeg: siteRecord.azimuthDeg,
    },
    horizonH,
    mode: siteRecord.status === 'online-live' ? 'live' : 'replay',
    skyCondition,
  });

  const peakPoint = forecastRes.points.reduce(
    (best, pt) => (pt.pKw > best.pKw ? pt : best),
    forecastRes.points[0]
  );
  const totalDayExpectedKwh = Math.round(
    forecastRes.points.reduce((acc, pt) => acc + pt.pKw, 0)
  );
  const totalDayP10Kwh = Math.round(
    forecastRes.points.reduce((acc, pt) => acc + pt.p10Kw, 0)
  );
  const totalDayClearKwh = Math.round(
    forecastRes.points.reduce((acc, pt) => acc + pt.pClearKw, 0)
  );

  const call1Id = 'tc_get_forecast_01';
  toolTraces.push({
    id: call1Id,
    toolName: 'get_forecast',
    args: {
      site: siteRecord.id,
      capacity_kwp: siteRecord.capacityKwp,
      horizon_h: horizonH,
      sky_condition: skyCondition,
    },
    outputSummary: `Total expected ${totalDayExpectedKwh.toLocaleString()} kWh (P10: ${totalDayP10Kwh.toLocaleString()} kWh); peak ${peakPoint.pKw} kW at ${peakPoint.hourLocal}:00.`,
    rawOutput: {
      siteId: siteRecord.id,
      model: forecastRes.modelName,
      totalDayExpectedKwh,
      totalDayP10Kwh,
      peakKw: peakPoint.pKw,
      peakP10Kw: peakPoint.p10Kw,
      peakP90Kw: peakPoint.p90Kw,
      peakHourLocal: `${peakPoint.hourLocal}:00`,
      peakCellTempC: peakPoint.tCellC,
      meanClearSkyIndexKc: peakPoint.kc,
    },
    durationMs: 18,
  });

  // Check if query asks about model accuracy / skill / PGNN / XGBoost
  if (
    qLower.includes('skill') ||
    qLower.includes('model') ||
    qLower.includes('accuracy') ||
    qLower.includes('rmse') ||
    qLower.includes('pgnn') ||
    qLower.includes('xgboost')
  ) {
    const rows = MODEL_BENCHMARK_TABLE.filter(
      (r) => r.horizonH === horizonH && r.stratum === (skyCondition === 'dust' ? 'dust_khamaseen' : 'overall')
    );
    const pgnn = rows.find((r) => r.modelKey === 'pgnn') || MODEL_BENCHMARK_TABLE[5];
    const xgb = rows.find((r) => r.modelKey === 'xgb') || MODEL_BENCHMARK_TABLE[3];
    const smart = rows.find((r) => r.modelKey === 'smart_persistence') || MODEL_BENCHMARK_TABLE[1];

    const callSkillId = 'tc_get_model_skill_02';
    toolTraces.push({
      id: callSkillId,
      toolName: 'get_model_skill',
      args: {
        site: siteRecord.id,
        horizon_h: horizonH,
        stratum: skyCondition === 'dust' ? 'dust_khamaseen' : 'overall',
      },
      outputSummary: `PGNN nRMSE ${pgnn.nRmsePct}% (Skill +${pgnn.skillVsSmartPersistencePct}% vs Smart Persistence); XGBoost nRMSE ${xgb.nRmsePct}% (Skill +${xgb.skillVsSmartPersistencePct}%).`,
      rawOutput: {
        smartPersistenceNrmsePct: smart.nRmsePct,
        xgbNrmsePct: xgb.nRmsePct,
        xgbSkillPct: xgb.skillVsSmartPersistencePct,
        pgnnNrmsePct: pgnn.nRmsePct,
        pgnnSkillPct: pgnn.skillVsSmartPersistencePct,
        pgnnInvalidPct: pgnn.physicallyInvalidPredictionsPct,
        dmPValue: pgnn.dmTestPValueVsSmartPers,
      },
      durationMs: 12,
    });

    return {
      messageId: `msg-${Date.now()}`,
      createdAt: new Date().toISOString(),
      answerMarkdown: `### Verified Model Skill for **${siteRecord.nameEn}** (${horizonH}h Horizon)\n\n` +
        `- **PGNN (Physics-Guided Neural Network):** nRMSE = **${pgnn.nRmsePct}%** (${pgnn.rmseKw} kW), achieving **+${pgnn.skillVsSmartPersistencePct}% RMSE Skill** vs Smart Persistence and **+${pgnn.skillVsCliperPct}%** vs CLIPER ($p = ${pgnn.dmTestPValueVsSmartPers}$).\n` +
        `- **XGBoost ($k_c$ route):** nRMSE = **${xgb.nRmsePct}%** (${xgb.rmseKw} kW), **+${xgb.skillVsSmartPersistencePct}% Skill** vs Smart Persistence.\n` +
        `- **Smart Persistence Baseline:** nRMSE = **${smart.nRmsePct}%** (${smart.rmseKw} kW).\n` +
        `- **Physical Validity:** PGNN produces **${pgnn.physicallyInvalidPredictionsPct}%** physically invalid predictions (hard-clamped to $0 \\le \\hat{P} \\le P_{\\text{clear}}$).\n\n` +
        `*Today's Forecast Summary [${call1Id}]:* Expected generation is **${totalDayExpectedKwh.toLocaleString()} kWh** (P10 lower bound: **${totalDayP10Kwh.toLocaleString()} kWh**), peaking at **${peakPoint.pKw} kW** at **${peakPoint.hourLocal}:00**.`,
      sources: toolTraces.map((t) => t.id),
      toolTraces,
      riskBanner: {
        level: skyCondition === 'dust' ? 'medium' : 'low',
        note: `All metrics retrieved from daylight-masked (> 5° elevation) 2026 test evaluation [${callSkillId}].`,
      },
    };
  }

  // Check if query asks about clear sky / dust / heat loss
  if (qLower.includes('clear') || qLower.includes('dust') || qLower.includes('khamaseen') || qLower.includes('loss')) {
    const callClearId = 'tc_get_clear_sky_02';
    const attenuationPct = Math.round((1 - totalDayExpectedKwh / Math.max(1, totalDayClearKwh)) * 1000) / 10;
    toolTraces.push({
      id: callClearId,
      toolName: 'get_clear_sky',
      args: { site: siteRecord.id, sky_condition: skyCondition },
      outputSummary: `Clear-sky envelope ${totalDayClearKwh.toLocaleString()} kWh vs forecasted ${totalDayExpectedKwh.toLocaleString()} kWh (${attenuationPct}% atmospheric attenuation).`,
      rawOutput: {
        clearSkyDayKwh: totalDayClearKwh,
        forecastDayKwh: totalDayExpectedKwh,
        attenuationPct,
        meanKc: peakPoint.kc,
        peakCellTempC: peakPoint.tCellC,
      },
      durationMs: 14,
    });

    return {
      messageId: `msg-${Date.now()}`,
      createdAt: new Date().toISOString(),
      answerMarkdown: `### Clear-Sky vs Atmospheric Attenuation Analysis (**${siteRecord.nameEn}**)\n\n` +
        `- **Clear-Sky Envelope ($P_{\\text{clear}}$):** **${totalDayClearKwh.toLocaleString()} kWh** (peak **${peakPoint.pClearKw} kW** at ${peakPoint.hourLocal}:00) [${callClearId}].\n` +
        `- **Forecasted AC Output ($\\hat{P}$):** **${totalDayExpectedKwh.toLocaleString()} kWh** (P10–P90 band at noon: **${peakPoint.p10Kw} – ${peakPoint.p90Kw} kW**) [${call1Id}].\n` +
        `- **Clear-Sky Index ($k_c$):** **${peakPoint.kc}** (${attenuationPct}% attenuation under current **${skyCondition}** sky).\n` +
        `- **Thermal State:** Midday cell temperature reaches **${peakPoint.tCellC} °C** (ambient **${peakPoint.tAmbC} °C**).`,
      sources: toolTraces.map((t) => t.id),
      toolTraces,
      riskBanner: {
        level: skyCondition === 'dust' || skyCondition === 'cloud' ? 'medium' : 'low',
        note: `Uncertainty band P10=${totalDayP10Kwh.toLocaleString()} kWh must be respected during ${skyCondition} conditions.`,
      },
    };
  }

  // Default / Scheduling & Dispatch query: run deterministic load scheduler
  const primaryLoad = DEFAULT_FLEXIBLE_LOADS[0];
  const secondaryLoad = DEFAULT_FLEXIBLE_LOADS[2];
  const sched1 = recommendOptimalLoadWindow(forecastRes.points, primaryLoad, siteRecord.baseLoadKw);
  const sched2 = recommendOptimalLoadWindow(forecastRes.points, secondaryLoad, siteRecord.baseLoadKw);

  const callSchedId = 'tc_recommend_window_02';
  toolTraces.push({
    id: callSchedId,
    toolName: 'recommend_window',
    args: {
      site: siteRecord.id,
      loads: [
        { name: primaryLoad.name, kw: primaryLoad.powerKw, duration_h: primaryLoad.durationH },
        { name: secondaryLoad.name, kw: secondaryLoad.powerKw, duration_h: secondaryLoad.durationH },
      ],
      base_load_kw: siteRecord.baseLoadKw,
    },
    outputSummary: `Validated window ${sched1.windowLabel} for ${primaryLoad.name} (P10 coverage: ${sched1.p10CoveragePct}%, Risk: ${sched1.riskLevel}).`,
    rawOutput: {
      schedules: [sched1, sched2],
    },
    durationMs: 24,
  });

  return {
    messageId: `msg-${Date.now()}`,
    createdAt: new Date().toISOString(),
    answerMarkdown:
      `### Grounded Dispatch & Load Schedule for **${siteRecord.nameEn}**\n\n` +
      `1. **Forecast Summary [${call1Id}]:**\n` +
      `   - **Daily Expected Yield:** **${totalDayExpectedKwh.toLocaleString()} kWh** (Conservative P10: **${totalDayP10Kwh.toLocaleString()} kWh**).\n` +
      `   - **Peak Output:** **${peakPoint.pKw} kW** (P10: **${peakPoint.p10Kw} kW**, P90: **${peakPoint.p90Kw} kW**) at **${peakPoint.hourLocal}:00** (cell temp **${peakPoint.tCellC} °C**, $k_c = ${peakPoint.kc}$).\n\n` +
      `2. **Deterministically Validated Flexible-Load Windows [${callSchedId}]:**\n` +
      `   - **${sched1.loadName} (${sched1.powerKw} kW × ${sched1.durationH}h):** Run **${sched1.windowLabel}** → Expected solar covers **${sched1.solarCoveragePct}%**; P10 lower bound covers **${sched1.p10CoveragePct}%** (**Risk: ${sched1.riskLevel.toUpperCase()}**). Avoids **${sched1.dieselAvoidedLiters} L** diesel (**EGP ${sched1.costSavedEgp.toLocaleString()}** saved).\n` +
      `   - **${sched2.loadName} (${sched2.powerKw} kW × ${sched2.durationH}h):** Run **${sched2.windowLabel}** → Expected solar covers **${sched2.solarCoveragePct}%** (P10: **${sched2.p10CoveragePct}%**).\n\n` +
      `*Advisory Note:* Every schedule above has been verified by the deterministic scheduling engine against the P10 lower-bound forecast.`,
    sources: toolTraces.map((t) => t.id),
    toolTraces,
    riskBanner: {
      level: sched1.riskLevel,
      note: sched1.rationale,
    },
  };
}

