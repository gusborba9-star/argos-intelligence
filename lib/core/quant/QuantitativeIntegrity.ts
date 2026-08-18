export interface CanonicalValueChain {
  modelProbability: number;
  modelFairOdd: number;
  marketOdd: number;
  expectedValue: number;
  fullKelly: number;
  fractionalKelly: number;
}

const EPS = 1e-9;

export function buildCanonicalValueChain(
  modelProbability: number,
  marketOdd: number,
  fractionalKelly = 0.25,
): CanonicalValueChain {
  if (!Number.isFinite(modelProbability) || modelProbability <= 0 || modelProbability >= 1) {
    throw new Error(`Invalid canonical model probability: ${modelProbability}`);
  }
  if (!Number.isFinite(marketOdd) || marketOdd <= 1) {
    throw new Error(`Invalid executable market odd: ${marketOdd}`);
  }
  if (!Number.isFinite(fractionalKelly) || fractionalKelly <= 0 || fractionalKelly > 1) {
    throw new Error(`Invalid fractional Kelly: ${fractionalKelly}`);
  }

  const modelFairOdd = 1 / modelProbability;
  const expectedValue = modelProbability * marketOdd - 1;
  const b = marketOdd - 1;
  const q = 1 - modelProbability;
  const fullKelly = Math.max(0, (modelProbability * b - q) / b);

  return {
    modelProbability,
    modelFairOdd,
    marketOdd,
    expectedValue,
    fullKelly,
    fractionalKelly: fullKelly * fractionalKelly,
  };
}

export function assertCanonicalValueChain(chain: CanonicalValueChain): void {
  const expectedFair = 1 / chain.modelProbability;
  const expectedEv = chain.modelProbability * chain.marketOdd - 1;
  const b = chain.marketOdd - 1;
  const expectedKelly = Math.max(0, (chain.modelProbability * b - (1 - chain.modelProbability)) / b);

  if (Math.abs(chain.modelFairOdd - expectedFair) > EPS) {
    throw new Error("Quantitative integrity failure: model fair odd is not reciprocal of model probability");
  }
  if (Math.abs(chain.expectedValue - expectedEv) > EPS) {
    throw new Error("Quantitative integrity failure: EV is not derived from canonical model probability");
  }
  if (Math.abs(chain.fullKelly - expectedKelly) > EPS) {
    throw new Error("Quantitative integrity failure: Kelly is not derived from canonical model probability");
  }
}
