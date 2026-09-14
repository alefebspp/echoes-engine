/**
 * Extract hostname from a URL metadata field (mirrors dashboard SQL logic).
 */
export function extractDomainFromUrl(url: string): string | null {
  const match = url.match(/^https?:\/\/([^/:]+)/i);
  if (!match?.[1]) {
    return null;
  }

  const domain = match[1].toLowerCase().replace(/^www\./, '');
  return domain.length > 0 ? domain : null;
}

export function extractDomainFromMetadata(
  metadata: Record<string, unknown>,
): string | null {
  const url = metadata.url;
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return null;
  }

  return extractDomainFromUrl(url);
}

export function extractBrowserFromMetadata(
  metadata: Record<string, unknown>,
): string | null {
  const browser = metadata.browser;
  if (typeof browser !== 'string' || browser.trim().length === 0) {
    return null;
  }

  return browser.trim();
}
