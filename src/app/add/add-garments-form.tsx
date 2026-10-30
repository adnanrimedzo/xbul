'use client';

import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/app/_components/ui/button';
import { GarmentImage } from '@/app/_components/ui/garment-image';
import { addManualProductAction, previewGarmentsAction, publishGarmentsAction, type PreviewRow } from './actions';

type Kind = 'original' | 'equivalent';
// A fetched row plus what the supplier has typed for it so far (`byHand`: it was added with a brand and name, not fetched).
type Row = PreviewRow & { articleCode: string; kind: Kind; byHand?: boolean };
type Ready = Extract<Row, { state: 'ready' }>;
type NeedsDetails = Extract<Row, { state: 'needs_details' }>;
type Invalid = Extract<Row, { state: 'invalid' }>;

const KINDS: [Kind, string][] = [
  ['original', 'We made this'],
  ['equivalent', 'Equivalent'],
];
const input = 'w-full border border-ink p-2 text-[12px] font-normal normal-case focus:outline-2 focus:outline-accent';
const alertBox = 'border border-accent px-3 py-2 text-[12px] normal-case';
const thumb = 'h-[90px] w-[72px] max-[760px]:h-[76px] max-[760px]:w-[60px]';
const plural = (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`;
// What a row starts with: what the supplier typed for it before, else the claim it already has (so publishing again restates that claim), else blank.
const startingValues = (row: PreviewRow, before?: { articleCode: string; kind: Kind }): { articleCode: string; kind: Kind } => {
  const existing = row.state === 'ready' ? row.existing : undefined;
  return { articleCode: before?.articleCode ?? existing?.articleCode ?? '', kind: before?.kind ?? existing?.kind ?? 'original' };
};

// Mockup .row: thumbnail, name and status, article code, role.
function RowShell({ children }: { children: ReactNode }) {
  return (
    <li data-testid="preview-row" className="grid grid-cols-[72px_1fr_150px_210px] items-center gap-3.5 border-b border-ink px-5 py-3 max-[760px]:grid-cols-[60px_1fr]">
      {children}
    </li>
  );
}

// Mockup .n over .s: what the row is, then how it went. The status is always words, never colour alone.
function Status({ name, children, tone = 'muted' }: { name: ReactNode; children: ReactNode; tone?: 'ok' | 'muted' | 'ink' }) {
  const colour = { ok: 'text-[#167a32]', muted: 'text-muted', ink: 'text-ink' }[tone];
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-semibold break-words">{name}</div>
      <div className={`mt-[3px] text-[10px] ${colour}`}>{children}</div>
    </div>
  );
}

// A pasted link is shown as typed (links are case-sensitive), and a long one wraps rather than overflowing.
const Url = ({ children }: { children: string }) => <span className="break-all normal-case">{children}</span>;

function ReadyRow({ row, onChange }: { row: Ready; onChange: (patch: Partial<Pick<Row, 'articleCode' | 'kind'>>) => void }) {
  const group = useId();
  const label = `${row.brand} — ${row.name}`;
  return (
    <RowShell>
      <GarmentImage src={row.imageUrl} alt={label} className={thumb} />
      <Status name={label} tone="ok">
        {row.byHand ? '✓ Added by hand' : `✓ Fetched${row.composition ? ` · ${row.composition}` : ''}`}
        {row.existing && <span className="mt-1 block font-semibold text-ink">Already on your page</span>}
        {row.imageUrl && (
          // The thumbnail is too small for the credit pill, so the photo's credit goes on the status line.
          <a href={row.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-muted underline">
            Photo: {new URL(row.url).hostname.replace(/^www\./, '')} ↗
          </a>
        )}
      </Status>
      <label className="max-[760px]:col-span-full">
        <span className="sr-only">Product code</span>
        <input value={row.articleCode} onChange={(e) => onChange({ articleCode: e.target.value })} maxLength={40} placeholder="Product code" className={input} />
      </label>
      <fieldset className="flex border border-ink max-[760px]:col-span-full">
        <legend className="sr-only">Your role for {label}</legend>
        {KINDS.map(([kind, text]) => (
          // Mockup .seg: the radio covers its label invisibly, so the whole segment is the click target.
          <label
            key={kind}
            className="relative flex-1 cursor-pointer px-1 py-2 text-center text-[10px] font-semibold has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent"
          >
            <input type="radio" name={group} value={kind} checked={row.kind === kind} onChange={() => onChange({ kind })} className="absolute inset-0 size-full cursor-pointer opacity-0" />
            {text}
          </label>
        ))}
      </fieldset>
    </RowShell>
  );
}

function NeedsDetailsRow({ row, onSaved }: { row: NeedsDetails; onSaved: (saved: PreviewRow) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '');
    startSave(async () => {
      const result = await addManualProductAction({ url: row.url, brand: text('brand'), name: text('name') });
      if (result.ok) onSaved(result.data);
      else setError(result.error);
    });
  }

  return (
    <RowShell>
      <div aria-hidden="true" className={`${thumb} bg-[#f4f4f4]`} />
      <Status name={<Url>{row.url}</Url>} tone="ink">
        {row.guess ? 'This page only has a title. Check the brand and name.' : <>Couldn&apos;t read this page. Add the brand and name by hand.</>}
      </Status>
      <form onSubmit={save} className="col-span-2 flex flex-col gap-2 max-[760px]:col-span-full">
        <div className="grid grid-cols-[1fr_1.6fr] gap-2">
          <label className="flex flex-col gap-1 text-[10px] font-semibold">
            Brand
            <input name="brand" required maxLength={60} defaultValue={row.guess?.brand} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-semibold">
            Name
            <input name="name" required maxLength={160} defaultValue={row.guess?.name} className={input} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" type="submit" disabled={saving}>
            Save
          </Button>
          {error && (
            <span role="alert" className="text-[11px] normal-case">
              {error}
            </span>
          )}
        </div>
      </form>
    </RowShell>
  );
}

function InvalidRow({ row }: { row: Invalid }) {
  return (
    <RowShell>
      <div aria-hidden="true" className={`${thumb} bg-[#f4f4f4]`} />
      <div className="col-span-3 max-[760px]:col-span-1">
        <Status name={<Url>{row.url}</Url>} tone="ink">
          {row.error}
        </Status>
      </div>
    </RowShell>
  );
}

export function AddGarmentsForm() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [fetching, startFetch] = useTransition();
  const [publishing, startPublish] = useTransition();
  const ready = rows.filter((r): r is Ready => r.state === 'ready');

  const edit = (url: string, change: (r: Row) => Row) => setRows((rs) => rs.map((r) => (r.url === url ? change(r) : r)));

  function fetchLinks(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const links = String(new FormData(e.currentTarget).get('links') ?? '');
    startFetch(async () => {
      const result = await previewGarmentsAction(links);
      if (!result.ok) return setFetchError(result.error);
      setFetchError(null);
      // Fetching again after adding a link keeps what was already typed for the links that are still there.
      setRows((old) =>
        result.data.map((r) => {
          const before = old.find((o) => o.url === r.url && o.state === 'ready'); // only a ready row has anything typed
          return { ...r, ...startingValues(r, before), byHand: before?.byHand };
        }),
      );
    });
  }

  function publish() {
    setPublishError(null);
    startPublish(async () => {
      // On success the action redirects to the company page, so only a failure comes back here.
      const result = await publishGarmentsAction(ready.map(({ productId, articleCode, kind }) => ({ productId, articleCode, kind })));
      if (!result.ok) setPublishError(result.error);
    });
  }

  return (
    <div className="grid min-h-[560px] grid-cols-[1fr_1.4fr] max-[1100px]:grid-cols-1">
      <div className="border-r border-ink px-5 py-7 max-[1100px]:border-r-0 max-[1100px]:border-b">
        <h1 className="mb-3.5 text-[44px] leading-[0.9] font-bold tracking-[-0.02em]">
          Add <br />
          products
        </h1>
        <p className="mb-[18px] text-[12px] leading-normal text-[#333] normal-case">
          Paste the brand links for products you&apos;ve made or can make. One per line. We fetch the photo, name and composition for you.
        </p>
        <form onSubmit={fetchLinks}>
          <label htmlFor="brand-links" className="sr-only">
            Brand links
          </label>
          <textarea
            id="brand-links"
            name="links"
            required
            placeholder="https://www.brand.com/denim-jacket"
            className="h-[170px] w-full resize-none border border-ink p-3 text-[12px] normal-case focus:outline-2 focus:outline-accent"
          />
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-[10px] text-muted">Up to 50 links at a time.</span>
            <Button variant="ghost" type="submit" disabled={fetching}>
              {fetching ? 'Fetching…' : 'Fetch'}
            </Button>
          </div>
          {fetchError && (
            <p role="alert" className={`mt-3 ${alertBox}`}>
              {fetchError}
            </p>
          )}
        </form>
      </div>

      <section aria-label="Preview" aria-busy={fetching}>
        <div className="flex justify-between gap-3 border-b border-ink px-5 py-3 text-[11px] font-semibold">
          <span aria-live="polite">{plural(ready.length)} found</span>
          <span>Product code · your role</span>
        </div>
        {rows.length > 0 ? (
          <ul>
            {rows.map((row) =>
              row.state === 'ready' ? (
                <ReadyRow key={row.url} row={row} onChange={(patch) => edit(row.url, (r) => ({ ...r, ...patch }))} />
              ) : row.state === 'needs_details' ? (
                <NeedsDetailsRow key={row.url} row={row} onSaved={(saved) => edit(row.url, () => ({ ...saved, ...startingValues(saved), byHand: true }))} />
              ) : (
                <InvalidRow key={row.url} row={row} />
              ),
            )}
          </ul>
        ) : (
          <p className="border-b border-ink px-5 py-6 text-[12px] text-muted normal-case">Fetched products appear here.</p>
        )}
        <div className="flex items-center justify-between gap-5 px-5 py-[18px] max-[760px]:flex-col max-[760px]:items-start [&>button]:px-[26px] [&>button]:py-[13px]">
          <span className="text-[11px] text-muted normal-case">&quot;We made this&quot; shows as declared until verified.</span>
          <Button variant="cta" type="button" onClick={publish} disabled={ready.length === 0 || publishing}>
            Publish {plural(ready.length)}
          </Button>
        </div>
        {publishError && (
          <p role="alert" className={`mx-5 mb-[18px] ${alertBox}`}>
            {publishError}
          </p>
        )}
      </section>
    </div>
  );
}
