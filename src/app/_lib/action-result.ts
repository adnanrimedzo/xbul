import { DomainError } from '@/shared/domain/errors';
import { errorMessage } from './error-messages';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Anything that isn't a DomainError (including Next's redirect/notFound signals) propagates.
export function toActionError(e: unknown): { ok: false; error: string } {
  if (!(e instanceof DomainError)) throw e;
  return { ok: false, error: errorMessage(e.code) };
}
