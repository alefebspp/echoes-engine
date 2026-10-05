export type EmbedResult = {
  vector: number[];
  model: string;
  dimensions: number;
};

/**
 * `document` is stored history. `query` is the question asked at retrieval time.
 * Providers that need different prompts for each (Gemini Embedding 2) use this.
 */
export type EmbeddingPurpose = 'document' | 'query';

/**
 * Port for turning text into dense vectors. Infrastructure owns the provider SDK.
 */
export interface EmbeddingPort {
  /** Configured model id — used for idempotent skip before calling the API. */
  readonly model: string;
  embed(text: string, purpose?: EmbeddingPurpose): Promise<EmbedResult>;
}
