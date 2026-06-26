export type UrlTagMatch = {
  tag: string;
  confidence: number;
};

type TagRule = {
  tag: string;
  domains: string[];
  confidence: number;
};

const TAG_RULES: TagRule[] = [
  {
    tag: 'social media',
    domains: [
      'youtube.com',
      'youtu.be',
      'twitter.com',
      'x.com',
      'facebook.com',
      'instagram.com',
      'tiktok.com',
      'linkedin.com',
      'reddit.com',
      'pinterest.com',
      'snapchat.com',
      'threads.net',
      'whatsapp.com',
      'telegram.org',
      'discord.com',
    ],
    confidence: 0.95,
  },
  {
    tag: 'streaming',
    domains: [
      'netflix.com',
      'spotify.com',
      'twitch.tv',
      'hulu.com',
      'disneyplus.com',
      'primevideo.com',
      'crunchyroll.com',
      'soundcloud.com',
    ],
    confidence: 0.95,
  },
  {
    tag: 'news',
    domains: [
      'nytimes.com',
      'bbc.com',
      'bbc.co.uk',
      'cnn.com',
      'reuters.com',
      'theguardian.com',
      'globo.com',
      'g1.globo.com',
      'uol.com.br',
      'techcrunch.com',
    ],
    confidence: 0.9,
  },
  {
    tag: 'developer tools',
    domains: [
      'github.com',
      'gitlab.com',
      'stackoverflow.com',
      'stackexchange.com',
      'npmjs.com',
      'dev.to',
      'medium.com',
      'docker.com',
      'kubernetes.io',
      'apache.org',
    ],
    confidence: 0.95,
  },
  {
    tag: 'productivity',
    domains: [
      'notion.so',
      'notion.site',
      'docs.google.com',
      'drive.google.com',
      'calendar.google.com',
      'trello.com',
      'asana.com',
      'slack.com',
      'teams.microsoft.com',
      'office.com',
      'figma.com',
      'miro.com',
      'monday.com',
    ],
    confidence: 0.9,
  },
  {
    tag: 'e-commerce',
    domains: [
      'amazon.com',
      'amazon.com.br',
      'ebay.com',
      'mercadolivre.com.br',
      'mercadolibre.com',
      'shopify.com',
      'aliexpress.com',
      'etsy.com',
    ],
    confidence: 0.9,
  },
  {
    tag: 'search',
    domains: ['google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com'],
    confidence: 0.85,
  },
  {
    tag: 'education',
    domains: [
      'coursera.org',
      'udemy.com',
      'khanacademy.org',
      'wikipedia.org',
      'edx.org',
      'duolingo.com',
    ],
    confidence: 0.9,
  },
  {
    tag: 'email',
    domains: ['gmail.com', 'mail.google.com', 'outlook.com', 'proton.me', 'protonmail.com'],
    confidence: 0.95,
  },
];

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

export function extractHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return normalizeHostname(parsed.hostname);
  } catch {
    return null;
  }
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function categorizeUrl(url: string): UrlTagMatch[] {
  const hostname = extractHostname(url);
  if (!hostname) {
    return [];
  }

  let bestMatch: (UrlTagMatch & { domainLength: number }) | null = null;

  for (const rule of TAG_RULES) {
    const sortedDomains = [...rule.domains].sort(
      (left, right) => right.length - left.length,
    );

    for (const domain of sortedDomains) {
      if (hostnameMatchesDomain(hostname, domain)) {
        if (!bestMatch || domain.length > bestMatch.domainLength) {
          bestMatch = {
            tag: rule.tag,
            confidence: rule.confidence,
            domainLength: domain.length,
          };
        }
        break;
      }
    }
  }

  if (!bestMatch) {
    return [];
  }

  return [{ tag: bestMatch.tag, confidence: bestMatch.confidence }];
}
