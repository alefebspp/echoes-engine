export type RollupStatsSnapshot = {
  topDomains: Array<{ domain: string; count: number }>;
  topBrowsers: Array<{ browser: string; count: number }>;
  eventsBySource: Array<{
    sourceCode: string;
    sourceName: string;
    count: number;
  }>;
};

export interface RollupStatsReadStore {
  getRollupStats(userId: string): Promise<RollupStatsSnapshot>;
}
