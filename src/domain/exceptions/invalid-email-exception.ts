export class InvalidEmailException extends Error {
  constructor() {
    super('Invalid email.');
    this.name = 'InvalidEmailException';
  }
}
