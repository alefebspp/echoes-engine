export class InvalidEventTagException extends Error {
  constructor(message = 'Invalid event tag.') {
    super(message);
    this.name = 'InvalidEventTagException';
  }
}
