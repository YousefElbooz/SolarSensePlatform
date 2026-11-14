// Unit tests for 23-feature ERA5 conversions, wind u/v round-trips & validation
// Run via: npm test

import assert from 'node:assert/strict';
import {
  FEATURES_23,
  FEATURE_KEYS_23,
  WEATHER_PRESETS,
  checkCrossFieldWarnings,
  datasetVectorToFormVector,
  formVectorToDatasetVector,
  validateDatasetFeatureVector,
  windSpeedDirToUV,
  windUVToSpeedDir,
} from '../features';

function runTests() {
  // 1. Verify exact count and order of 23 features
  assert.equal(FEATURES_23.length, 23, 'Must define exactly 23 ERA5 features');
  assert.equal(FEATURE_KEYS_23.length, 23, 'Must export 23 feature keys');

  // 2. Round-trip conversion for every preset
  for (const preset of WEATHER_PRESETS) {
    const datasetVec = formVectorToDatasetVector(preset.form);
    const roundTripForm = datasetVectorToFormVector(datasetVec);

    for (const def of FEATURES_23) {
      const orig = preset.form[def.key];
      const back = roundTripForm[def.key];
      const tol = 10 ** -def.decimalsForm + 1e-6;
      assert.ok(
        Math.abs(orig - back) <= tol,
        `Round-trip mismatch for ${def.key} in preset ${preset.id}: expected ${orig}, got ${back}`
      );
    }

    // Validate dataset vector passes server schema
    const validation = validateDatasetFeatureVector(datasetVec);
    assert.equal(
      validation.valid,
      true,
      `Preset ${preset.id} dataset vector failed validation: ${validation.errorMessage}`
    );
  }

  // 3. Specific unit conversion spot checks
  const noonPreset = WEATHER_PRESETS[0].form;
  const noonDataset = formVectorToDatasetVector(noonPreset);
  assert.ok(Math.abs(noonDataset.t2m - (41.0 + 273.15)) < 1e-6, 't2m °C -> K');
  assert.ok(Math.abs(noonDataset.sp - 100400) < 1e-3, 'sp hPa -> Pa');
  assert.ok(Math.abs(noonDataset.ssrd - 1010 * 3600) < 1e-3, 'ssrd W/m² -> J/m²');
  assert.ok(Math.abs(noonDataset.tcc - 0.02) < 1e-6, 'tcc % -> 0..1');

  // 4. Wind speed/direction <-> u10/v10 round-trip across all quadrants
  const testAngles = [0, 45, 90, 135, 180, 225, 270, 315, 350];
  for (const dir of testAngles) {
    const speed = 7.5;
    const { u10, v10 } = windSpeedDirToUV(speed, dir);
    const back = windUVToSpeedDir(u10, v10);
    assert.ok(Math.abs(back.speedMs - speed) <= 0.02, `Wind speed round-trip at ${dir}°`);
    assert.ok(Math.abs(back.directionDeg - dir) <= 0.2, `Wind dir round-trip at ${dir}°`);
  }

  // North wind (0°): blows FROM North TO South -> u10 = 0, v10 = -s
  const northWind = windSpeedDirToUV(5, 0);
  assert.equal(northWind.u10, 0);
  assert.equal(northWind.v10, -5);

  // East wind (90°): blows FROM East TO West -> u10 = -s, v10 = 0
  const eastWind = windSpeedDirToUV(5, 90);
  assert.equal(eastWind.u10, -5);
  assert.equal(eastWind.v10, 0);

  // 5. Cross-field warning detection
  const badForm = { ...noonPreset, fdir: 1100, ssrd: 900, d2m: 45, t2m: 35 };
  const warnings = checkCrossFieldWarnings(badForm);
  assert.ok(warnings.length >= 2, 'Should flag fdir > ssrd and d2m > t2m');

  // 6. Server schema rejection on out-of-range field
  const badDataset = { ...noonDataset, tcc: 2.5 };
  const badRes = validateDatasetFeatureVector(badDataset);
  assert.equal(badRes.valid, false);
  assert.equal(badRes.errorField, 'tcc');

  console.log('✓ All 23-feature conversion, wind u/v, and schema validation tests passed.');
}

runTests();
