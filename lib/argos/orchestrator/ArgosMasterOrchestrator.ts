        awayMean = (awayExtra.cornersFor + homeExtra.cornersAgainst) / 2;
        sampleSize = Math.min(homeExtra.sampleSize || 0, awayExtra.sampleSize || 0);
      } else if (vertical === MarketVertical.CARDS && homeExtra && awayExtra) {
        homeMean = (homeExtra.cardsFor + awayExtra.cardsAgainst) / 2;
        awayMean = (awayExtra.cardsFor + homeExtra.cardsAgainst) / 2;
        sampleSize = Math.min(homeExtra.sampleSize || 0, awayExtra.sampleSize || 0);
      } else {
        const profile = MarketStatFeatureEngine.build(
          vertical,
          rawData.homeHistory?.length ? rawData.homeHistory : homeHistory,
          rawData.awayHistory?.length ? rawData.awayHistory : awayHistory,
          rawData.home_team,
          rawData.away_team,
        );
        if (profile) {
          homeMean = (profile.homeFor + profile.awayAgainst) / 2;
          awayMean = (profile.awayFor + profile.homeAgainst) / 2;
          sampleSize = Math.min(profile.homeSample, profile.awaySample);
        }
      }

      if (homeMean === null || awayMean === null || sampleSize < this.MIN_REAL_SAMPLE) continue;
      const countStatSeed = ModelFactory.seedForCountStat(
        matchId,
        vertical,
        homeMean,
        awayMean,
        lines,
        regime,
      );
      countStatProbabilities[vertical] = await ModelFactory.runCountStatWithLearning(
        homeMean,
        awayMean,
        lines,
        leagueIdentifier,
        vertical,
        regime,
        5000,
        countStatSeed,
      );
      countStatSamples[vertical] = sampleSize;
    }

    let h2hSummary: any = null;
    if (hasRealData) {
      try { h2hSummary = await apiFootballService.getH2HSummary(rawData.home_team, rawData.away_team); } catch { h2hSummary = null; }
    }

    const verticalsToAnalyze = [
      MarketVertical.WINNER,
      MarketVertical.HANDICAP,
      MarketVertical.GOALS,
      MarketVertical.BTTS,
      ...COUNT_STAT_VERTICALS,
    ];
    const opportunities: any[] = [];

    const homeAttack = features.homeMetrics.goals;
    const homeDefence = features.homeMetrics.goalsAgainst;
    const awayAttack = features.awayMetrics.goals;
    const awayDefence = features.awayMetrics.goalsAgainst;
    const expectedHomeGoals = Math.max(0.05, (homeAttack + awayDefence) / 2);
    const expectedAwayGoals = Math.max(0.05, (awayAttack + homeDefence) / 2);
