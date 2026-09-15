export type EmbedResult = {
  vector: number[];
  model: string;
  dimensions: number;
};

/**
 * Port for turning text into dense vectors. Infrastructure owns the provider SDK.
 */
export interface EmbeddingPort {
  /** Configured model id — used for idempotent skip before calling the API. */
  readonly model: string;
  embed(text: string): Promise<EmbedResult>;
}
