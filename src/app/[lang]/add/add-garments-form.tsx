'use client';

import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/app/_components/ui/button';
import { GarmentImage } from '@/app/_components/ui/garment-image';
import { useMessages } from '@/i18n/client';
import { PRODUCT_TYPES, type ProductTypeId } from '@/shared/domain/taxonomy';
import { addManualProductAction, previewGarmentsAction, publishGarmentsAction, type PreviewRow } from './actions';
import { ADD } from './messages';

type Kind = 'original' | 'equivalent';
// A fetched row plus what the supplier has typed for it so far (`byHand`: it was added with a brand and name, not fetched).
type Row = PreviewRow & { articleCode: string; kind: Kind; typeChoice: string; byHand?: boolean };
type Ready = Extract<Row, { state: 'ready' }>;
type NeedsDetails = Extract<Row, { state: 'needs_details' }>;
type Invalid = Extract<Row, { state: 'invalid' }>;

const KINDS = [
  ['original', 'kindOriginal'],
  ['equivalent', 'kindEquivalent'],
] as const;
const thumb = 'h-[90px] w-[72px] rounded-control';
// What a row starts with: what the supplier typed for it before, else the claim it already has (so publishing again restates that claim), else blank.
const startingValues = (row: PreviewRow, before?: { articleCode: string; kind: Kind; typeChoice: string }): { articleCode: string; kind: Kind; typeChoice: string } => {
  const existing = row.state === 'ready' ? row.existing : undefined;
  return {
    articleCode: before?.articleCode ?? existing?.articleCode ?? '',
    kind: before?.kind ?? existing?.kind ?? 'original',
    typeChoice: before?.typeChoice ?? (row.state === 'ready' ? (row.type ?? '') : ''),
  };
};

function RowShell({ children }: { children: ReactNode }) {
  return (
    <li data-testid="preview-row" className="card grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4!">
      {children}
    </li>
  );
}

// What the row is, then how it went. The status is always words, never colour alone.
function Status({ name, children }: { name: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold break-words">{name}</div>
      <div className="mt-0.5 text-sm text-muted">{children}</div>
    </div>
  );
}

// A pasted link is shown as typed (links are case-sensitive), and a long one wraps rather than overflowing.
const Url = ({ children }: { children: string }) => <span className="font-mono text-sm break-all">{children}</span>;

function ReadyRow({ row, onChange }: { row: Ready; onChange: (patch: Partial<Pick<Row, 'articleCode' | 'kind' | 'typeChoice'>>) => void }) {
  const group = useId();
  const { t, lang } = useMessages(ADD);
  const label = `${row.brand} — ${row.name}`;
  return (
    <RowShell>
      <GarmentImage src={row.imageUrl} alt={label} className={thumb} />
      <Status name={label}>
        {row.byHand ? t.addedByHand : t.fetched(row.composition)}
        {row.existing && <span className="mt-1 block font-semibold text-fg">{t.alreadyOnPage}</span>}
        {row.imageUrl && (
          // The thumbnail is too small for the credit pill, so the photo's credit goes on the status line.
          <a href={row.url} target="_blank" rel="noopener noreferrer" className="link mt-1 block">
            {t.photo(new URL(row.url).hostname.replace(/^www\./, ''))}
          </a>
        )}
      </Status>
      <div className="col-span-full grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <label>
          <span className="sr-only">{t.productCode}</span>
          <input value={row.articleCode} onChange={(e) => onChange({ articleCode: e.target.value })} maxLength={40} placeholder={t.productCode} className="field" />
        </label>
        <fieldset className="flex overflow-hidden rounded-control border border-line">
          <legend className="sr-only">{t.yourRoleFor(label)}</legend>
          {KINDS.map(([kind, text]) => (
            // The radio covers its label invisibly, so the whole segment is the click target.
            <label
              key={kind}
              className="relative flex min-h-12 flex-1 cursor-pointer items-center justify-center px-2 py-1 text-center text-sm leading-tight font-semibold transition-colors duration-150 has-checked:bg-inverse has-checked:text-on-inverse has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent"
            >
              <input type="radio" name={group} value={kind} checked={row.kind === kind} onChange={() => onChange({ kind })} className="absolute inset-0 size-full cursor-pointer opacity-0" />
              {t[text]}
            </label>
          ))}
        </fieldset>
        <label className="sm:col-span-full">
          <select aria-label={t.productType} value={row.typeChoice} disabled={row.typeLocked} onChange={(e) => onChange({ typeChoice: e.target.value })} className="field">
            <option value="">{t.notSure}</option>
            {(Object.entries(PRODUCT_TYPES) as [ProductTypeId, (typeof PRODUCT_TYPES)[ProductTypeId]][]).map(([id, type]) => (
              <option key={id} value={id}>
                {type.name[lang]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </RowShell>
  );
}

function NeedsDetailsRow({ row, onSaved }: { row: NeedsDetails; onSaved: (saved: PreviewRow) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const { t } = useMessages(ADD);

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
      <div aria-hidden="true" className={`${thumb} bg-surface`} />
      <Status name={<Url>{row.url}</Url>}>
        {row.guess ? t.onlyTitle : t.couldntRead}
      </Status>
      <form onSubmit={save} className="col-span-full flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <label className="field-label">
            {t.brand}
            <input name="brand" required maxLength={60} defaultValue={row.guess?.brand} className="field" />
          </label>
          <label className="field-label">
            {t.name}
            <input name="name" required maxLength={160} defaultValue={row.guess?.name} className="field" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" type="submit" disabled={saving}>
            {t.save}
          </Button>
          {error && <span role="alert">{error}</span>}
        </div>
      </form>
    </RowShell>
  );
}

function InvalidRow({ row }: { row: Invalid }) {
  return (
    <RowShell>
      <div aria-hidden="true" className={`${thumb} bg-surface`} />
      <Status name={<Url>{row.url}</Url>}>{row.error}</Status>
    </RowShell>
  );
}

export function AddGarmentsForm() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [fetching, startFetch] = useTransition();
  const [publishing, startPublish] = useTransition();
  const { t } = useMessages(ADD);
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
      const result = await publishGarmentsAction(ready.map(({ productId, articleCode, kind, typeChoice }) => ({ productId, articleCode, kind, type: typeChoice })));
      if (!result.ok) setPublishError(result.error);
    });
  }

  return (
    <div className="page grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="mt-3 mb-5">{t.intro}</p>
        <form onSubmit={fetchLinks}>
          <label htmlFor="brand-links" className="sr-only">
            {t.brandLinks}
          </label>
          <textarea id="brand-links" name="links" required placeholder="https://www.brand.com/products/item-123" className="field h-[200px] resize-none font-mono text-sm" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{t.upTo}</span>
            <Button variant="ghost" type="submit" disabled={fetching}>
              {fetching ? t.fetching : t.fetch}
            </Button>
          </div>
          {fetchError && (
            <p role="alert" className="alert mt-3">
              {fetchError}
            </p>
          )}
        </form>
      </div>

      <section aria-label={t.preview} aria-busy={fetching} className="panel">
        <p aria-live="polite" className="section-title px-2 pt-2 pb-4">
          {t.found(ready.length)}
        </p>
        {rows.length > 0 ? (
          <ul className="flex flex-col gap-2">
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
          <p className="card text-muted">{t.emptyPreview}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 px-2 pt-4 pb-1">
          <span className="max-w-[40ch] text-sm text-muted">{t.verifiedNote}</span>
          <Button variant="cta" type="button" onClick={publish} disabled={ready.length === 0 || publishing}>
            {t.publish(ready.length)}
          </Button>
        </div>
        {publishError && (
          <p role="alert" className="alert mx-2 mt-3">
            {publishError}
          </p>
        )}
      </section>
    </div>
  );
}
