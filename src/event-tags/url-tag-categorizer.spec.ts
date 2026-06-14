import { categorizeUrl, extractHostname } from './url-tag-categorizer';

describe('url-tag-categorizer', () => {
  describe('extractHostname', () => {
    it('normalizes www prefix', () => {
      expect(extractHostname('https://www.youtube.com/watch?v=1')).toBe(
        'youtube.com',
      );
    });

    it('returns null for invalid URLs', () => {
      expect(extractHostname('not-a-url')).toBeNull();
    });
  });

  describe('categorizeUrl', () => {
    it('tags YouTube as social media', () => {
      expect(categorizeUrl('https://youtube.com/watch?v=1')).toEqual([
        { tag: 'social media', confidence: 0.95 },
      ]);
    });

    it('tags GitHub as developer tools', () => {
      expect(categorizeUrl('https://github.com/org/repo')).toEqual([
        { tag: 'developer tools', confidence: 0.95 },
      ]);
    });

    it('tags docs.google.com as productivity', () => {
      expect(categorizeUrl('https://docs.google.com/document/d/1/edit')).toEqual([
        { tag: 'productivity', confidence: 0.9 },
      ]);
    });

    it('tags google.com as search', () => {
      expect(categorizeUrl('https://www.google.com/search?q=nestjs')).toEqual([
        { tag: 'search', confidence: 0.85 },
      ]);
    });

    it('returns empty array for unknown domains', () => {
      expect(categorizeUrl('https://random-unknown.example')).toEqual([]);
    });
  });
});
