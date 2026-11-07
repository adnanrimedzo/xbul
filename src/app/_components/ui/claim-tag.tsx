import type { ClaimKind } from '@/modules/claims';

// Told apart by the line as well as the words: solid for made, dashed for can make.
export function ClaimTag({ kind }: { kind: ClaimKind }) {
  return kind === 'original' ? (
    <span className="inline-block rounded-control border border-fg px-2 py-1 font-mono text-sm leading-tight font-medium">We made this</span>
  ) : (
    <span className="inline-block rounded-control border border-dashed border-fg px-2 py-1 font-mono text-sm leading-tight font-medium">Can make an equivalent</span>
  );
}
