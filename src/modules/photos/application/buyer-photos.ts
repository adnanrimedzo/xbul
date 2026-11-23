import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import { dayAgo, isExpired, retentionCutoff, searchPhotoKey, VISITOR_DAILY_LIMIT, type PhotoCheck } from '../domain/photo-check';
import type { GateDecision, GateReason, Verdict } from '../domain/verdict';
import { analysePhoto } from './analyse-photo';
import type { BuyerPhotoDeps } from './ports';

export type BuyerCheckResult = { id: string; decision: GateDecision; reason: GateReason | null; verdict: Verdict };

const PRUNE_BATCH = 200;

// A buyer's photo search. The daily cap comes before any AI call. An accepted or unclear photo is kept (with its vector)
// for 7 days so the results page can be revisited; a rejected one is never stored, only counted.
export async function checkBuyerPhoto(
  deps: BuyerPhotoDeps,
  input: { visitorHash: string | null; bytes: Uint8Array },
  now: Date = new Date(),
): Promise<BuyerCheckResult> {
  if ((await deps.checks.countSince({ visitorHash: input.visitorHash }, dayAgo(now))) >= VISITOR_DAILY_LIMIT) throw new DomainError('photo.daily_limit');
  const a = await analysePhoto(deps.model, input.bytes);
  const id = newId();
  const keep = a.decision !== 'rejected';
  const photoKey = keep ? searchPhotoKey(id, now) : null;
  if (photoKey) await deps.store.put(photoKey, input.bytes, 'image/jpeg');
  try {
    await deps.checks.save({
      id, source: 'buyer', companyId: null, visitorHash: input.visitorHash, decision: a.decision, reason: a.reason, verdict: a.verdict,
      closeUp: null, photoKey, embedding: keep ? a.embedding : null, embeddingModel: deps.model.embeddingModel, createdAt: now,
    });
  } catch (e) {
    if (photoKey) await deleteQuietly(deps, photoKey);
    throw e;
  }
  await pruneExpiredSearches(deps, now).catch((e) => console.error('[photos] prune failed', e));
  return { id, decision: a.decision, reason: a.reason, verdict: a.verdict };
}

// An optional fabric close-up for an existing search: checked on its own (and counted toward the cap), never stored,
// and its fabric details join the search's. A close-up that isn't a textile is reported, not added.
export async function addCloseUp(
  deps: BuyerPhotoDeps,
  input: { searchId: string; visitorHash: string | null; bytes: Uint8Array },
  now: Date = new Date(),
): Promise<{ decision: GateDecision; reason: GateReason | null }> {
  const search = await findBuyerSearch(deps, input.searchId, now);
  if (!search || search.decision === 'rejected') throw new DomainError('photo.not_found');
  if ((await deps.checks.countSince({ visitorHash: input.visitorHash }, dayAgo(now))) >= VISITOR_DAILY_LIMIT) throw new DomainError('photo.daily_limit');
  const a = await analysePhoto(deps.model, input.bytes);
  await deps.checks.save({
    id: newId(), source: 'buyer', companyId: null, visitorHash: input.visitorHash, decision: a.decision, reason: a.reason, verdict: a.verdict,
    closeUp: null, photoKey: null, embedding: null, embeddingModel: deps.model.embeddingModel, createdAt: now,
  });
  if (a.decision !== 'rejected') await deps.checks.setCloseUp(search.id, a.verdict);
  return { decision: a.decision, reason: a.reason };
}

// Clears photo and vector from searches past retention but keeps the rows, so caps and stats still count them.
// The R2 lifecycle rule is the backstop for any file this misses.
export async function pruneExpiredSearches(deps: Pick<BuyerPhotoDeps, 'checks' | 'store'>, now: Date = new Date()): Promise<number> {
  const expired = await deps.checks.listExpired(retentionCutoff(now), PRUNE_BATCH);
  await deps.checks.clearExpired(expired.map((e) => e.id));
  for (const e of expired) if (e.photoKey) await deleteQuietly(deps, e.photoKey);
  return expired.length;
}

// A buyer's search while it lasts; anything else (unknown, a supplier check, expired) is null.
export async function findBuyerSearch(deps: Pick<BuyerPhotoDeps, 'checks'>, id: string, now: Date = new Date()): Promise<PhotoCheck | null> {
  const check = await deps.checks.findById(id);
  return check && check.source === 'buyer' && !isExpired(check.createdAt, now) ? check : null;
}

async function deleteQuietly(deps: Pick<BuyerPhotoDeps, 'store'>, key: string): Promise<void> {
  try {
    await deps.store.delete(key);
  } catch (e) {
    console.error(`[photos] could not delete ${key}`, e);
  }
}
