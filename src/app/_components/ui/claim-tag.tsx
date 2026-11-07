import { pageMessages } from '@/i18n/server';
import type { ClaimKind } from '@/modules/claims';
import { UI } from './messages';

// Told apart by the line as well as the words: solid for made, dashed for can make.
export async function ClaimTag({ kind }: { kind: ClaimKind }) {
  const { t } = await pageMessages(UI);
  return kind === 'original' ? (
    <span className="inline-block rounded-control border border-fg px-2 py-1 font-mono text-sm leading-tight font-medium">{t.madeThis}</span>
  ) : (
    <span className="inline-block rounded-control border border-dashed border-fg px-2 py-1 font-mono text-sm leading-tight font-medium">{t.canMake}</span>
  );
}
