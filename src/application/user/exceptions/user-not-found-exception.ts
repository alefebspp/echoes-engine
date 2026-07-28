export class UserNotFoundException extends Error {
  constructor(id?: string) {
    super(id ? `User #${id} not found` : 'User not found');
    this.name = 'UserNotFoundException';
  }
}