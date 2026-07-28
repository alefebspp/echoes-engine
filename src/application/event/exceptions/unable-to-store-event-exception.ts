export class UnableToStoreEventException extends Error {
  constructor() {
    super('Unable to store event');
    this.name = 'UnableToStoreEventException';
  }
}
