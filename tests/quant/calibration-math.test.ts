import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCalibration,
  applyCalibrationIntercept,
  brierScore,
  fitLogisticCalibration,
  logLoss,
  type CalibrationObservation,
} from "../../lib/core/CalibrationMath";

const observations: CalibrationObservation[] = [
  { probability: 0.20, outcome: 0 },
  { probability: 0.30, outcome: 0 },
  { probability: 0.40, outcome: 1 },
  { probability: 0.60, outcome: 1 },
  { probability: 0.70, outcome: 1 },
  { probability: 0.80, outcome: 1 },
];

test("calibration fit remains finite and inside promotion bounds", () => {
  const fit = fitLogisticCalibration(observations);
  assert.ok(Number.isFinite(fit.slope));
  assert.ok(Number.isFinite(fit.intercept));
  assert.ok(fit.slope >= 0.8 && fit.slope <= 1.25);
  assert.ok(Math.abs(fit.intercept) <= 0.05);
});

test("identity transform preserves the original probability", () => {
  for (const probability of [0.01, 0.2, 0.5, 0.8, 0.99]) {
    assert.ok(Math.abs(applyCalibration(probability, 1, 0) - probability) < 1e-12);
    assert.ok(Math.abs(applyCalibrationIntercept(probability, 0) - probability) < 1e-12);
  }
});

test("full calibration transform preserves probability bounds", () => {
  for (const probability of [0.000001, 0.01, 0.5, 0.99, 0.999999]) {
    const calibrated = applyCalibration(probability, 1.25, 0.05);
    assert.ok(calibrated > 0 && calibrated < 1);
  }
});

test("calibration is monotonic in the source probability", () => {
  const low = applyCalibration(0.25, 1.2, 0.02);
  const high = applyCalibration(0.75, 1.2, 0.02);
  assert.ok(high > low);
});

test("Brier score is non-negative and perfect predictions score zero", () => {
  const perfect: CalibrationObservation[] = [
    { probability: 0, outcome: 0 },
    { probability: 1, outcome: 1 },
  ];
  assert.equal(brierScore([0, 1], perfect), 0);
  assert.ok(brierScore([0.25, 0.75], perfect) >= 0);
});

test("Log loss is finite and perfect non-boundary predictions outperform wrong predictions", () => {
  const data: CalibrationObservation[] = [
    { probability: 0.1, outcome: 0 },
    { probability: 0.9, outcome: 1 },
  ];
  assert.ok(Number.isFinite(logLoss([0.1, 0.9], data)));
  assert.ok(logLoss([0.1, 0.9], data) < logLoss([0.9, 0.1], data));
});

test("Brier score rejects mismatched vector lengths", () => {
  assert.throws(() => brierScore([0.5], observations), /equal length/);
});

test("Log loss rejects mismatched vector lengths", () => {
  assert.throws(() => logLoss([0.5], observations), /equal length/);
});
