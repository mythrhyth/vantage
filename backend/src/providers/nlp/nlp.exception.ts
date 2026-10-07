export class NlpValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NlpValidationException';
  }
}
