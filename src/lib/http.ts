import { CustomError } from './errors';

export class HttpError extends CustomError {
  constructor(public code: number, message: string) {
    super(`[Azure Search Emulator] HTTP ${code} - ${message}`);
  }
}

export function createHttp400() {
  return new HttpError(400, 'Invalid Request');
}
export function createHttp404() {
  return new HttpError(404, 'Not Found');
}