export type AppTagMatch = {
  tag: string;
  confidence: number;
};

type AppTagRule = {
  tag: string;
  apps: string[];
  confidence: number;
};

const TAG_RULES: AppTagRule[] = [
  {
    tag: 'social media',
    apps: [
      'instagram',
      'twitter',
      'x',
      'facebook',
      'tiktok',
      'linkedin',
      'reddit',
      'snapchat',
      'threads',
      'whatsapp',
      'telegram',
      'discord',
      'pinterest',
    ],
    confidence: 0.95,
  },
  {
    tag: 'streaming',
    apps: [
      'netflix',
      'spotify',
      'youtube',
      'twitch',
      'hulu',
      'disney+',
      'disney plus',
      'prime video',
      'amazon prime video',
      'crunchyroll',
      'soundcloud',
    ],
    confidence: 0.95,
  },
  {
    tag: 'news',
    apps: [
      'nytimes',
      'new york times',
      'bbc news',
      'cnn',
      'reuters',
      'the guardian',
      'globo',
      'g1',
    ],
    confidence: 0.9,
  },
  {
    tag: 'developer tools',
    apps: [
      'github',
      'gitlab',
      'stack overflow',
      'stackoverflow',
      'docker',
      'figma',
    ],
    confidence: 0.95,
  },
  {
    tag: 'productivity',
    apps: [
      'notion',
      'slack',
      'trello',
      'asana',
      'microsoft teams',
      'teams',
      'google docs',
      'google drive',
      'google calendar',
      'outlook',
      'miro',
      'monday',
      'todoist',
    ],
    confidence: 0.9,
  },
  {
    tag: 'e-commerce',
    apps: [
      'amazon',
      'ebay',
      'mercado livre',
      'mercadolivre',
      'shopify',
      'aliexpress',
      'etsy',
      'shopee',
    ],
    confidence: 0.9,
  },
  {
    tag: 'education',
    apps: [
      'coursera',
      'udemy',
      'khan academy',
      'duolingo',
      'wikipedia',
      'edx',
    ],
    confidence: 0.9,
  },
  {
    tag: 'email',
    apps: ['gmail', 'outlook', 'proton mail', 'protonmail', 'yahoo mail'],
    confidence: 0.95,
  },
];

export function normalizeAppName(appName: string): string {
  return appName.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function categorizeAppName(appName: string): AppTagMatch[] {
  const normalized = normalizeAppName(appName);
  if (!normalized) {
    return [];
  }

  let bestMatch: (AppTagMatch & { nameLength: number }) | null = null;

  for (const rule of TAG_RULES) {
    const sortedApps = [...rule.apps].sort(
      (left, right) => right.length - left.length,
    );

    for (const app of sortedApps) {
      if (normalized === app || normalized.includes(app)) {
        if (!bestMatch || app.length > bestMatch.nameLength) {
          bestMatch = {
            tag: rule.tag,
            confidence: rule.confidence,
            nameLength: app.length,
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
