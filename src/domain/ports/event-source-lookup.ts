export interface EventSourceLookup {
  findIdByCode(code: string): Promise<string | null>;
}
