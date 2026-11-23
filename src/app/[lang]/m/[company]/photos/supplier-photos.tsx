'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useRef, useState } from 'react';
import { PHOTO } from '@/app/_components/photo/messages';
import { PhotoDropzone } from '@/app/_components/photo/photo-dropzone';
import { photoForm, PrepareError, preparePhoto } from '@/app/_components/photo/prepare-photo';
import { RowActionButton } from '@/app/_components/row-action-button';
import { Button } from '@/app/_components/ui/button';
import { GarmentImage } from '@/app/_components/ui/garment-image';
import { useMessages } from '@/i18n/client';
import type { PhotoCategory, PhotoTags } from '@/modules/photos';
import { COLORS, CONSTRUCTIONS, DYES, PATTERNS, PATTERNS_BY_CONSTRUCTION, PRODUCT_TYPES, TWILL_DIRECTIONS, TWILL_RATIOS } from '@/shared/domain/taxonomy';
import { deleteSupplierPhotoAction, publishSupplierPhotoAction, unpublishSupplierPhotoAction, uploadSupplierPhotoAction } from './actions';
import { SUPPLIER_PHOTOS } from './messages';

export type PhotoView = { id: string; tags: PhotoTags; articleId: string | null };
type Article = { id: string; code: string };

// Passed from the server page: client code imports module barrels for types only, never values (they pull in the database).
export type Limits = { maxColors: number; maxBatch: number };

type Row = { key: number; name: string; status: 'preparing' | 'waiting' | 'checking' | 'ready' | 'unclear' | 'failed'; message?: string; blob?: Blob };

function Select({ name, label, value, options, none, suggested, onChange }: {
  name: string; label: string; value: string; options: [string, string][]; none: string; suggested?: string | null; onChange?: (v: string) => void;
}) {
  return (
    <label className="field-label">
      <span>
        {label}
        {suggested && <span className="ml-2 font-mono text-xs text-muted">{suggested}</span>}
      </span>
      <select name={name} defaultValue={onChange ? undefined : value} value={onChange ? value : undefined} onChange={onChange && ((e) => onChange(e.target.value))} className="field">
        <option value="">{none}</option>
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

// The review form for one photo: the AI's suggestions (marked) prefilled, the supplier corrects and publishes.
function ReviewForm({ photo, articles, draft, busy, n, limits }: { photo: PhotoView; articles: Article[]; draft: boolean; busy: boolean; n: number; limits: Limits }) {
  const { t, lang } = useMessages(SUPPLIER_PHOTOS);
  const { t: p } = useMessages(PHOTO);
  const [state, action, pending] = useActionState(publishSupplierPhotoAction.bind(null, photo.id), null);
  const f = photo.tags.fabric;
  const [construction, setConstruction] = useState<string>(f.construction ?? '');
  const [pattern, setPattern] = useState<string>(f.pattern ?? '');
  const [colors, setColors] = useState<string[]>([...photo.tags.colors]);
  const mark = (v: unknown) => (draft && v !== null && v !== undefined ? t.suggested : null);
  const patterns = construction in PATTERNS_BY_CONSTRUCTION ? PATTERNS_BY_CONSTRUCTION[construction as keyof typeof PATTERNS_BY_CONSTRUCTION] : [];

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" data-testid="photo-review-form">
      <Select name="category" label={t.category} value={photo.tags.category} none={t.none} suggested={mark(photo.tags.category)} options={(Object.keys(p.categories) as PhotoCategory[]).map((c) => [c, p.categories[c]])} />
      <Select name="productType" label={t.productType} value={photo.tags.productType ?? ''} none={t.none} suggested={mark(photo.tags.productType)} options={Object.entries(PRODUCT_TYPES).map(([id, x]) => [id, x.name[lang]])} />
      <fieldset className="col-span-full">
        <legend className="field-label">
          {t.colors}
          {mark(photo.tags.colors[0]) && <span className="ml-2 font-mono text-xs text-muted">{t.suggested}</span>}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(COLORS).map(([id, name]) => {
            const on = colors.includes(id);
            return (
              <label key={id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm ${on ? 'border-fg' : 'border-line'}`}>
                <input
                  type="checkbox"
                  name="colors"
                  value={id}
                  checked={on}
                  disabled={!on && colors.length >= limits.maxColors}
                  onChange={() => setColors(on ? colors.filter((c) => c !== id) : [...colors, id])}
                />
                {name[lang]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="col-span-full grid gap-4 sm:grid-cols-2">
        <legend className="field-label mb-2">{t.fabric}</legend>
        <Select name="construction" label={t.construction} value={construction} none={t.none} suggested={mark(f.construction)} options={Object.entries(CONSTRUCTIONS).map(([id, x]) => [id, x[lang]])} onChange={(v) => { setConstruction(v); setPattern(''); }} />
        <Select name="pattern" label={t.pattern} value={pattern} none={t.none} suggested={mark(f.pattern)} options={patterns.map((id) => [id, PATTERNS[id][lang]])} onChange={setPattern} />
        {pattern === 'twill' && (
          <>
            <Select name="twillRatio" label={t.twillRatio} value={f.twillRatio ?? ''} none={t.none} suggested={mark(f.twillRatio)} options={TWILL_RATIOS.map((r) => [r, r])} />
            <Select name="twillDirection" label={t.twillDirection} value={f.twillDirection ?? ''} none={t.none} suggested={mark(f.twillDirection)} options={Object.entries(TWILL_DIRECTIONS).map(([id, x]) => [id, x[lang]])} />
          </>
        )}
        <Select name="denim" label={t.denim} value={f.denim === null ? '' : f.denim ? 'yes' : 'no'} none={t.none} suggested={mark(f.denim)} options={[['yes', t.yes], ['no', t.no]]} />
        <Select name="dye" label={t.dye} value={f.dye ?? ''} none={t.none} suggested={mark(f.dye)} options={Object.entries(DYES).map(([id, x]) => [id, x[lang]])} />
      </fieldset>
      <label className="field-label">
        {t.titleLabel}
        <input name="title" maxLength={80} defaultValue={photo.tags.title ?? ''} className="field" />
      </label>
      {articles.length > 0 && (
        <label className="field-label">
          {t.article}
          <select name="articleId" defaultValue={photo.articleId ?? ''} className="field" aria-describedby={`article-help-${photo.id}`}>
            <option value="">{t.none}</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code}
              </option>
            ))}
          </select>
          <span id={`article-help-${photo.id}`} className="text-xs font-normal text-muted">
            {t.articleHelp}
          </span>
        </label>
      )}
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <Button variant="cta" type="submit" disabled={pending || busy} aria-label={`${draft ? t.publish : t.save}: ${t.photoAlt(n)}`}>
          {draft ? t.publish : t.save}
        </Button>
        {busy && <span className="text-sm text-muted">{t.reviewBusy}</span>}
        {state?.ok && !draft && <span role="status" className="text-sm">{t.saved}</span>}
      </div>
      {state && !state.ok && (
        <p role="alert" className="alert col-span-full">
          {state.error}
        </p>
      )}
    </form>
  );
}

function PhotoCard({ photo, articles, draft, busy, n, limits }: { photo: PhotoView; articles: Article[]; draft: boolean; busy: boolean; n: number; limits: Limits }) {
  const { t } = useMessages(SUPPLIER_PHOTOS);
  const [editing, setEditing] = useState(draft);
  return (
    <li className="card grid gap-5 md:grid-cols-[200px_minmax(0,1fr)]" data-testid={draft ? 'draft-photo' : 'published-photo'}>
      <GarmentImage src={`/api/supplier-photos/${photo.id}`} alt={photo.tags.title ?? t.photoAlt(n)} className="aspect-square rounded-control border border-line" />
      <div className="flex min-w-0 flex-col gap-4">
        {editing ? (
          <ReviewForm photo={photo} articles={articles} draft={draft} busy={busy} n={n} limits={limits} />
        ) : (
          <Button variant="ghost" type="button" onClick={() => setEditing(true)} className="self-start">
            {t.edit}
          </Button>
        )}
        <div className="flex flex-wrap gap-3">
          {!draft && <RowActionButton action={unpublishSupplierPhotoAction.bind(null, photo.id)} label={t.unpublish} disabled={busy} />}
          <RowActionButton action={deleteSupplierPhotoAction.bind(null, photo.id)} label={t.delete} confirmLabel={t.confirmDelete} disabled={busy} />
        </div>
      </div>
    </li>
  );
}

export function SupplierPhotos({ drafts, published, articles, enabled, limits }: { drafts: PhotoView[]; published: PhotoView[]; articles: Article[]; enabled: boolean; limits: Limits }) {
  const { t } = useMessages(SUPPLIER_PHOTOS);
  const { t: p } = useMessages(PHOTO);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const nextKey = useRef(0);
  const patch = (key: number, change: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...change } : r)));

  // One at a time: Next runs a client's server actions in sequence anyway, and each upload refreshes the review list.
  const upload = async (row: Row) => {
    if (!row.blob) return;
    patch(row.key, { status: 'checking', message: undefined });
    const r = await uploadSupplierPhotoAction(photoForm(row.blob)).catch(() => null);
    if (!r || !r.ok) return patch(row.key, { status: 'failed', message: r?.ok === false ? r.error : p.prepare.unreadable });
    if (r.data.decision === 'rejected') {
      const reason = r.data.reason ?? 'not_textile';
      return patch(row.key, { status: 'failed', message: `${p.reasons[reason]} ${p.tips[reason]}`, blob: undefined });
    }
    patch(row.key, { status: r.data.decision === 'unclear' ? 'unclear' : 'ready', blob: undefined });
    router.refresh();
  };

  const add = async (files: File[]) => {
    const batch: Row[] = files.slice(0, limits.maxBatch).map((f) => ({ key: nextKey.current++, name: f.name, status: 'preparing' }));
    setRows((all) => [...batch, ...all]);
    setRunning(true);
    try {
      for (const [i, row] of batch.entries()) {
        try {
          row.blob = await preparePhoto(files[i]);
          patch(row.key, { status: 'waiting', blob: row.blob });
        } catch (e) {
          patch(row.key, { status: 'failed', message: e instanceof PrepareError ? p.prepare[e.problem] : p.prepare.unreadable });
        }
      }
      for (const row of batch) await upload(row);
    } finally {
      setRunning(false);
    }
  };

  const retry = async (row: Row) => {
    setRunning(true);
    try {
      await upload(row);
    } finally {
      setRunning(false);
    }
  };

  const label: Record<Row['status'], string> = { preparing: t.preparing, waiting: t.waiting, checking: t.checking, ready: t.ready, unclear: t.readyUnclear, failed: '' };

  return (
    <div className="flex flex-col gap-10">
      {enabled ? (
        <section className="flex flex-col gap-4">
          <PhotoDropzone onFiles={add} multiple disabled={running} />
          <p className="text-sm text-muted">{t.rights}</p>
          {rows.length > 0 && (
            <div>
              <h2 className="section-title mb-3">{t.queue}</h2>
              <ul className="flex flex-col gap-2" aria-live="polite" data-testid="upload-queue">
                {rows.map((row) => (
                  <li key={row.key} className="card flex flex-wrap items-center justify-between gap-3" data-testid="upload-row" data-status={row.status}>
                    <span className="min-w-0 truncate font-mono text-sm">{row.name}</span>
                    {row.status === 'failed' ? (
                      <span className="flex flex-wrap items-center gap-3">
                        <span role="alert" className="text-sm">{row.message}</span>
                        {row.blob && (
                          <Button variant="ghost" size="sm" type="button" disabled={running} onClick={() => retry(row)}>
                            {t.retry}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" type="button" onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))}>
                          {t.remove}
                        </Button>
                      </span>
                    ) : (
                      <span className="text-sm text-muted">{label[row.status]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <p className="alert">{t.off}</p>
      )}

      <section aria-labelledby="review-title" className="flex flex-col gap-3">
        <h2 id="review-title" className="section-title">{t.reviewTitle}</h2>
        {drafts.length > 0 ? (
          <>
            <p className="text-muted">{t.reviewHelp}</p>
            <ul className="flex flex-col gap-3">
              {drafts.map((photo, i) => (
                <PhotoCard key={photo.id} photo={photo} articles={articles} draft busy={running} n={i + 1} limits={limits} />
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted">{t.noDrafts}</p>
        )}
      </section>

      <section aria-labelledby="published-title" className="flex flex-col gap-3">
        <h2 id="published-title" className="section-title">{t.publishedTitle}</h2>
        {published.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {published.map((photo, i) => (
              <PhotoCard key={photo.id} photo={photo} articles={articles} draft={false} busy={running} n={drafts.length + i + 1} limits={limits} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t.noPublished}</p>
        )}
      </section>
    </div>
  );
}
