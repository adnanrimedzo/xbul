import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { reasonLabels, seenLabels, type Seen } from '@/app/_components/photo/labels';
import { PHOTO } from '@/app/_components/photo/messages';
import { SupplierContact } from '@/app/_components/supplier-contact';
import { Button, LinkButton } from '@/app/_components/ui/button';
import { Chip } from '@/app/_components/ui/chip';
import { GarmentImage } from '@/app/_components/ui/garment-image';
import type { Locale } from '@/i18n/locales';
import { pageLang, pageMessages } from '@/i18n/server';
import { findPhotoMatches, type PhotoResultsView } from '@/modules/discovery';
import { buyerAttributes, findBuyerSearch, hasFilters, type FabricFilters } from '@/modules/photos';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { CONSTRUCTIONS, FIBRES, PATTERNS, TWILL_DIRECTIONS, TWILL_RATIOS } from '@/shared/domain/taxonomy';
import { PHOTO_RESULTS } from './messages';
import { refine, type RefineParams } from './refine';

type T = (typeof PHOTO_RESULTS)['en'];

// Results are private to whoever holds the link: never indexed, never cached by a shared cache.
export async function generateMetadata(): Promise<Metadata> {
  const lang = await pageLang();
  return { title: PHOTO_RESULTS[lang].metaTitle, robots: { index: false, follow: false } };
}

function Notice({ title, body, t, href }: { title: string; body: string; t: T; href: (p: string) => string }) {
  return (
    <div className="page flex flex-col items-start gap-4">
      <h1 className="page-title">{title}</h1>
      <p className="text-muted">{body}</p>
      <LinkButton variant="cta" href={href('/photo')}>
        {t.searchAgain}
      </LinkButton>
    </div>
  );
}

function Select({ name, label, value, options, any }: { name: string; label: string; value: string; options: [string, string][]; any: string }) {
  return (
    <label className="field-label">
      {label}
      <select name={name} defaultValue={value || 'any'} className="field">
        <option value="any">{any}</option>
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function RefineForm({ seen, filters, params, t, lang, action }: { seen: Seen; filters: FabricFilters; params: RefineParams; t: T; lang: Locale; action: string }) {
  const a = seen.attributes;
  const raw = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : '');
  return (
    <details className="panel" open={hasFilters(filters) || Object.keys(params).length > 0}>
      <summary className="cursor-pointer px-2 py-1 font-medium">{t.refine}</summary>
      <form method="get" action={action} className="mt-3 grid gap-4 px-2 pb-2 sm:grid-cols-2">
        <p className="col-span-full text-sm text-muted">{t.refineHelp}</p>
        <Select name="construction" label={t.construction} value={a.construction ?? ''} any={t.any} options={Object.entries(CONSTRUCTIONS).map(([id, n]) => [id, n[lang]])} />
        <Select name="pattern" label={t.pattern} value={a.pattern ?? ''} any={t.any} options={Object.entries(PATTERNS).map(([id, n]) => [id, n[lang]])} />
        <Select name="twillRatio" label={t.twillRatio} value={a.twillRatio ?? ''} any={t.any} options={TWILL_RATIOS.map((r) => [r, r])} />
        <Select name="twillDirection" label={t.twillDirection} value={a.twillDirection ?? ''} any={t.any} options={Object.entries(TWILL_DIRECTIONS).map(([id, n]) => [id, n[lang]])} />
        <Select name="denim" label={t.denim} value={a.denim === undefined ? '' : a.denim ? 'yes' : 'no'} any={t.any} options={[['yes', t.yes], ['no', t.no]]} />
        <Select name="fibre" label={t.fibre} value={filters.fibre ?? ''} any={t.any} options={Object.entries(FIBRES).map(([code, f]) => [code, f.name[lang]])} />
        <fieldset className="col-span-full flex flex-wrap items-end gap-3">
          <legend className="field-label">{t.weight}</legend>
          <label className="field-label">
            {t.weightMin}
            <input name="wmin" type="number" min={1} step="any" inputMode="decimal" defaultValue={raw('wmin')} className="field w-28" />
          </label>
          <label className="field-label">
            {t.weightMax}
            <input name="wmax" type="number" min={1} step="any" inputMode="decimal" defaultValue={raw('wmax')} className="field w-28" />
          </label>
          <select name="unit" defaultValue={raw('unit') || 'gsm'} aria-label={t.weight} className="field w-28">
            <option value="gsm">g/m²</option>
            <option value="oz">oz/yd²</option>
          </select>
        </fieldset>
        <div className="col-span-full flex flex-wrap gap-3">
          <Button variant="cta" type="submit">
            {t.apply}
          </Button>
          {Object.keys(params).length > 0 && (
            <Link href={action} className="link self-center">
              {t.clearFilters}
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}

function Results({ results, seen, t, lang, href, showScores }: { results: PhotoResultsView; seen: Seen; t: T; lang: Locale; href: (p: string) => string; showScores: boolean }) {
  return (
    <ul className="flex flex-col gap-3" data-testid="photo-results">
      {results.map(({ company, matches }) => (
        <li key={company.id} data-testid="photo-result" className="card flex flex-col gap-4">
          <div>
            <h2 className="section-title">
              <Link href={href(`/m/${company.slug}`)} className="hover:underline">
                {company.name}
              </Link>
            </h2>
            <p className="text-muted">
              {company.city}, {company.country}
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {matches.map((m) => {
              const reasons = reasonLabels(lang, m.agree, seen);
              return (
                <li key={m.photoId ?? m.article?.slug} className="flex flex-col gap-2" data-testid="photo-match">
                  {m.photoId ? (
                    <GarmentImage src={`/api/supplier-photos/${m.photoId}`} alt={m.tags?.title ?? t.matchedPhoto(company.name)} className="aspect-square rounded-control border border-line" />
                  ) : null}
                  <span className="self-start">
                    <Chip>{t.labels[m.label]}</Chip>
                  </span>
                  {m.tags?.title && <p className="text-sm">{m.tags.title}</p>}
                  {reasons.length > 0 && (
                    <p className="text-sm text-muted">
                      {t.matches} {reasons.join(' · ')}
                    </p>
                  )}
                  {m.article && (
                    <Link href={href(`/m/${company.slug}/a/${m.article.slug}`)} className="link font-mono text-sm">
                      {t.article(m.article.code)}
                    </Link>
                  )}
                  {showScores && m.similarity !== null && <p className="font-mono text-xs text-muted">{t.score(m.similarity)}</p>}
                </li>
              );
            })}
          </ul>
          <SupplierContact contact={company.contact} />
        </li>
      ))}
    </ul>
  );
}

export default async function PhotoResultsPage({ params, searchParams }: PageProps<'/[lang]/photo/[id]'>) {
  const [{ id }, query, container, viewer, { t, lang, href }] = await Promise.all([params, searchParams, getContainer(), getViewer(), pageMessages(PHOTO_RESULTS)]);
  if (!container.photoSearchPublic) notFound();
  const p = PHOTO[lang];
  const search = z.uuid().safeParse(id).success ? await findBuyerSearch({ checks: container.photoChecks }, id) : null;
  if (!search) return <Notice title={t.expiredTitle} body={t.expiredBody} t={t} href={href} />;
  if (search.decision === 'rejected' || !search.embedding) {
    const reason = search.reason ?? 'not_textile';
    return <Notice title={t.rejectedTitle} body={`${p.reasons[reason]} ${p.tips[reason]}`} t={t} href={href} />;
  }

  const v = search.verdict;
  const { attributes, filters } = refine(buyerAttributes(v, search.closeUp), query);
  const seen: Seen = { category: v.category, productType: v.productType, colors: v.colors, attributes };
  const results = await findPhotoMatches(container.db, {
    embedding: search.embedding,
    embeddingModel: search.embeddingModel,
    query: { attributes, category: v.category, productType: v.productType, colors: v.colors, filters },
  });
  const self = href(`/photo/${search.id}`);

  return (
    <div className="page flex flex-col gap-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {search.photoKey && (
          // eslint-disable-next-line @next/next/no-img-element -- our own private route, already sized
          <img src={`/api/photo-searches/${search.id}`} alt={t.yourPhoto} className="aspect-square w-full rounded-card border border-line object-cover sm:w-40" />
        )}
        <div className="flex flex-col gap-3">
          <h1 className="page-title">{t.title}</h1>
          <div>
            <p className="mb-2 text-sm text-muted">{t.lookedFor}</p>
            <ul className="flex flex-wrap gap-2" data-testid="photo-seen">
              {seenLabels(lang, seen).map((l) => (
                <li key={l}>
                  <Chip>{l}</Chip>
                </li>
              ))}
            </ul>
          </div>
          <Link href={href('/photo')} className="link self-start">
            {t.newSearch}
          </Link>
        </div>
      </div>

      <RefineForm seen={seen} filters={filters} params={query} t={t} lang={lang} action={self} />

      <section aria-labelledby="results-title" className="flex flex-col gap-3">
        <h2 id="results-title" className="sr-only">
          {t.resultsCount(results.length)}
        </h2>
        {results.length > 0 ? (
          <Results results={results} seen={seen} t={t} lang={lang} href={href} showScores={!!viewer?.isAdmin} />
        ) : (
          <div className="card flex flex-col items-start gap-3" data-testid="photo-no-results">
            <p className="font-medium">{hasFilters(filters) ? t.noneFiltered : t.noneTitle}</p>
            {hasFilters(filters) ? (
              <Link href={self} className="link">
                {t.clearFilters}
              </Link>
            ) : (
              <p className="text-muted">{t.tryClearer}</p>
            )}
            <Link href={href('/')} className="link">
              {t.linkInstead}
            </Link>
            <Link href={href('/sign-in')} className="link">
              {t.forSuppliers}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
