export async function waitFor(
  assertion: () => Promise<void>,
  timeoutMs = 10_000,
  intervalMs = 200,
): Promise<void> {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('waitFor timed out');
}
