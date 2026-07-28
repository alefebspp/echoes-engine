import {
  categorizeAppName,
  normalizeAppName,
} from './app-name-tag-categorizer';

describe('app-name-tag-categorizer', () => {
  describe('normalizeAppName', () => {
    it('trims and lowercases', () => {
      expect(normalizeAppName('  Instagram  ')).toBe('instagram');
    });
  });

  describe('categorizeAppName', () => {
    it('categorizes social media apps', () => {
      expect(categorizeAppName('Instagram')).toEqual([
        { tag: 'social media', confidence: 0.95 },
      ]);
    });

    it('categorizes streaming apps', () => {
      expect(categorizeAppName('Spotify')).toEqual([
        { tag: 'streaming', confidence: 0.95 },
      ]);
    });

    it('categorizes productivity apps', () => {
      expect(categorizeAppName('Notion')).toEqual([
        { tag: 'productivity', confidence: 0.9 },
      ]);
    });

    it('returns empty for unknown apps', () => {
      expect(categorizeAppName('Totally Unknown App')).toEqual([]);
    });
  });
});
