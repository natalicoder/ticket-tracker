import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (code: string, what: string) => new AppError(404, code, `${what} not found`);

interface PgError {
  code?: string;
  constraint?: string;
  detail?: string;
}

function pgErrorOf(err: unknown): PgError | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as PgError & { cause?: unknown };
  if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) return e;
  if (e.cause) return pgErrorOf(e.cause);
  return undefined;
}

function zodDetails(err: ZodError): Array<{ path: string; message: string }> {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
};

export function errorBody(code: string, message: string, details?: unknown) {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export function errorHandler(err: FastifyError | AppError | ZodError, request: FastifyRequest, reply: FastifyReply) {
  if (err instanceof AppError) {
    return reply.status(err.status).send(errorBody(err.code, err.message, err.details));
  }

  if (err instanceof ZodError || (err as { name?: string }).name === 'ZodError') {
    const zerr = err as ZodError;
    const details = zodDetails(zerr);
    return reply.status(400).send(errorBody('VALIDATION_ERROR', details[0]?.message ?? 'Invalid request', details));
  }

  const pg = pgErrorOf(err);
  if (pg?.code === '23505') {
    return reply.status(409).send(errorBody('CONFLICT', 'This record already exists'));
  }
  if (pg?.code === '23503') {
    return reply.status(409).send(errorBody('CONFLICT', 'This record is referenced by other records'));
  }
  if (pg?.code === '22P02') {
    return reply.status(400).send(errorBody('BAD_REQUEST', 'Malformed identifier'));
  }

  const fe = err as FastifyError;
  if (fe.validation) {
    const details = fe.validation.map((v) => ({ path: v.instancePath.replace(/^\//, '').replace(/\//g, '.'), message: v.message ?? 'Invalid value' }));
    return reply.status(400).send(errorBody('VALIDATION_ERROR', details[0]?.message ?? 'Invalid request', details));
  }
  const status = fe.statusCode ?? 500;
  if (status >= 400 && status < 500) {
    const code = fe.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || fe.code === 'FST_ERR_CTP_EMPTY_JSON_BODY' ? 'INVALID_JSON' : (STATUS_CODES[status] ?? 'BAD_REQUEST');
    const message = status === 415 ? 'Requests must use Content-Type: application/json' : fe.message;
    return reply.status(status).send(errorBody(code, message));
  }

  request.log.error({ err }, 'unhandled error');
  return reply.status(500).send(errorBody('INTERNAL', 'Something went wrong. Please try again.'));
}
