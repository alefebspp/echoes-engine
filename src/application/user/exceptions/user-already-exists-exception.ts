export class UserAlreadyExistsException extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'UserAlreadyExistsException';
  }
}
