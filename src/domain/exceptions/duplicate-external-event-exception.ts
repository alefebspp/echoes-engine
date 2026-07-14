export class DuplicateExternalEventException extends Error {
  constructor() {
    super('Event with this external id already exists');
    this.name = 'DuplicateExternalEventException';
  }
}
