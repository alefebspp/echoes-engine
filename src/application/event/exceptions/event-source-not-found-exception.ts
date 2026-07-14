export class EventSourceNotFoundException extends Error {
  constructor(sourceCode: string) {
    super(`Event source ${sourceCode} not found`);
    this.name = 'EventSourceNotFoundException';
  }
}
