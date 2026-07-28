import { EventTag } from 'src/domain/event-tag/event-tag';
import { UnsupportedEventTypeHandlerException } from 'src/domain/exceptions/unsupported-event-type-handler-exception';
import { AppVisitEventTypeHandler } from './app-visit-event-type-handler';
import { MapEventTypeHandlerRegistry } from './map-event-type-handler-registry';
import { WebVisitEventTypeHandler } from './web-visit-event-type-handler';

describe('event type handlers', () => {
  describe('WebVisitEventTypeHandler', () => {
    const handler = new WebVisitEventTypeHandler();

    it('suggests tags from url metadata', () => {
      const tags = handler.suggestTags({
        url: 'https://www.youtube.com/watch?v=1',
        title: 'Video',
      });

      expect(tags).toHaveLength(1);
      expect(tags[0]).toBeInstanceOf(EventTag);
      expect(tags[0].getTag()).toBe('social media');
    });

    it('returns no tags without url', () => {
      expect(handler.suggestTags({ title: 'No URL' })).toEqual([]);
    });
  });

  describe('AppVisitEventTypeHandler', () => {
    const handler = new AppVisitEventTypeHandler();

    it('suggests tags from appName metadata', () => {
      const tags = handler.suggestTags({
        appName: 'Instagram',
        packageName: 'com.instagram.android',
      });

      expect(tags).toHaveLength(1);
      expect(tags[0].getTag()).toBe('social media');
      expect(tags[0].getConfidence()).toBe(0.95);
    });

    it('returns no tags without appName', () => {
      expect(handler.suggestTags({})).toEqual([]);
    });
  });

  describe('MapEventTypeHandlerRegistry', () => {
    const registry = new MapEventTypeHandlerRegistry([
      new WebVisitEventTypeHandler(),
      new AppVisitEventTypeHandler(),
    ]);

    it('resolves handlers by type without branching in the use case', () => {
      expect(registry.getHandler('WEB_VISIT').type).toBe('WEB_VISIT');
      expect(registry.getHandler('APP_VISIT').type).toBe('APP_VISIT');
    });

    it('throws when no handler is registered', () => {
      expect(() => registry.getHandler('SPOTIFY_PLAY')).toThrow(
        UnsupportedEventTypeHandlerException,
      );
    });
  });
});
