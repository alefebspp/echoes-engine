import {
  decodeEventCursor,
  encodeEventCursor,
  InvalidEventCursorException,
} from './event-cursor';

describe('event-cursor', () => {
  it('encodes and decodes an opaque cursor', () => {
    const payload = {
      occurredAt: '2026-08-20T12:00:00.000Z',
      id: 'abc-123',
    };

    const encoded = encodeEventCursor(payload);
    expect(decodeEventCursor(encoded)).toEqual(payload);
  });

  it('rejects invalid cursor payloads', () => {
    expect(() => decodeEventCursor('not-valid')).toThrow(
      InvalidEventCursorException,
    );
  });
});
