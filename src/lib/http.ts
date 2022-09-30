import { CustomError } from './errors';

export class HttpError extends CustomError {
  constructor(public code: number, message: string) {
    super(`[Azure Search Emulator] HTTP ${code} - ${message}`);
  }
}

export const createHttp400 = () => new HttpError(400, 'Invalid Request');
export const createHttp404 = () => new HttpError(404, 'Not Found');