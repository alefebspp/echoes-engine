export class InvalidEventTypeException extends Error {
  constructor(value?: string) {
    super(
      value
        ? `Invalid event type: ${value}.`
        : 'Invalid event type.',
    );
    this.name = 'InvalidEventTypeException';
  }
}
