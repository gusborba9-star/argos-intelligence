// ============================================================
// MODEL FACTORY v4.0 — MONTE CARLO & POISSON
// ============================================================

export class ModelFactory {
  static runMonteCarlo(
    baseOutput: { homeExpectedGoals: number; awayExpectedGoals: number },
    iterations: number = 1500,
    varianceMultiplier: number = 1.0
  ) {
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;

    for (let i = 0; i < iterations; i++) {
      const hLambda = baseOutput.homeExpectedGoals * (1 + (Math.random() - 0.5) * (varianceMultiplier - 1));
      const aLambda = baseOutput.awayExpectedGoals * (1 + (Math.random() - 0.5) * (varianceMultiplier - 1));

      const hGoals = this.poisson(hLambda);
      const aGoals = this.poisson(aLambda);

      if (hGoals > aGoals) homeWins++;
      else if (hGoals === aGoals) draws++;
      else awayWins++;
    }

    return {
      probabilities: {
        home: homeWins / iterations,
        draw: draws / iterations,
        away: awayWins / iterations
      },
      iterations,
      varianceMultiplier
    };
  }

  private static poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }
}
