export type StructuredLogMetadata = Record<string, unknown>;

export type StructuredLogPayload = {
  message: string;
} & StructuredLogMetadata;

export const STRUCTURED_LOG_SYMBOL = Symbol('structuredLog');

export type StructuredLogEntry = StructuredLogPayload & {
  [STRUCTURED_LOG_SYMBOL]: true;
};

export function structuredLog(
  message: string,
  metadata: StructuredLogMetadata = {},
): StructuredLogEntry {
  return {
    [STRUCTURED_LOG_SYMBOL]: true,
    message,
    ...metadata,
  };
}

export function isStructuredLogEntry(
  value: unknown,
): value is StructuredLogEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    STRUCTURED_LOG_SYMBOL in value &&
    typeof (value as StructuredLogEntry).message === 'string'
  );
}
