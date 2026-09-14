export type TagStatsRow = {
  tag: string;
  count: number;
  percentage: number;
};

export type TagStatsSnapshot = {
  categoryBreakdown: TagStatsRow[];
  generatedAt: string;
};

export interface TagStatsReadStore {
  getTagStats(userId: string, totalEvents: number): Promise<TagStatsSnapshot>;
}
