import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { RowActionButton } from '@/app/_components/row-action-button';
import { Chip } from '@/app/_components/ui/chip';
import { REGISTRATION } from '@/app/[lang]/m/[company]/registration/messages';
import { missingSentence, registrationFormValues } from '@/app/[lang]/m/[company]/registration/registration-values';
import { pageMessages } from '@/i18n/server';
import { getRegistrationReview } from '@/modules/discovery';
import { taxIdLabel, type Registration } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';
import { ADMIN_MANUFACTURERS } from '../messages';
import { approveRegistrationAction, rejectRegistrationAction, requestChangesAction, rerunChecksAction } from './actions';
import { NoteDecisionForm } from './decision-forms';
import { EditForm } from './edit-form';
import { manualChecksFor } from './manual-checks';
import { ADMIN_REVIEW } from './messages';

// The registration fields in the order of the owner's form.
const FIELDS = [
  'legalName', 'taxId', 'taxOffice', 'registryNumber', 'mersisNumber', 'industryRegistryNumber', 'lei', 'registeredAddress',
  'facilityAddress', 'naceCodes', 'employees', 'monthlyCapacity', 'openSupplyHubId',
] as const satisfies readonly (keyof Registration)[];

// A logged value as text: a list joined, a certificate's parts in a row, nothing as a dash.
function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length > 0 ? v.map(show).join(', ') : '—';
  if (typeof v === 'object') return Object.values(v).filter((x) => x !== null && x !== '').join(' ');
  return String(v);
}

const section = 'flex flex-col gap-3';
const heading = 'section-title';

export default async function RegistrationReviewPage({ params }: PageProps<'/[lang]/admin/manufacturers/[id]'>) {
  const viewer = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await getContainer();
  const review = (await getRegistrationReview(db, id)) ?? notFound();
  const [{ t, lang, href }, { t: q }, { t: r }] = await Promise.all([pageMessages(ADMIN_REVIEW), pageMessages(ADMIN_MANUFACTURERS), pageMessages(REGISTRATION)]);
  const { company, registration, documents, checks, events, missing } = review;
  const taxLabel = taxIdLabel(company.country);
  const own = viewer.userId === company.ownerUserId; // the use cases refuse it too; here nothing is offered
  const when = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' });
  const fieldLabel = (key: string): string => {
    if (key === 'taxId') return r.taxId[taxLabel];
    const label = (r as Record<string, unknown>)[key]; // naceCodes → "Activity codes (NACE)", documents → "Documents"
    return typeof label === 'string' ? label : key;
  };
  const value = (key: (typeof FIELDS)[number]) => {
    const v = registration?.[key];
    return key === 'employees' && typeof v === 'string' ? v.replace('-', '–') : show(v);
  };

  return (
    <div className="page flex flex-col gap-10">
      <div>
        <nav aria-label={t.breadcrumb}>
          <Link href={href('/admin/manufacturers')} className="link">
            {q.title}
          </Link>{' '}
          / {company.name}
        </nav>
        <h1 className="page-title mt-3">{company.name}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          {t.status}: <Chip>{q.statuses[company.status]}</Chip>
        </p>
        {own && <p className="alert mt-4 max-w-[720px] font-semibold">{t.ownCompany}</p>}
      </div>

      <section aria-labelledby="company-title" className={section}>
        <h2 id="company-title" className={heading}>{t.company}</h2>
        <dl className="grid max-w-[720px] gap-x-6 gap-y-2 sm:grid-cols-[14rem_1fr]">
          <dt className="text-muted">{t.kindAndPlace}</dt>
          <dd>{q.kinds[company.kind]}, {company.city}, {company.country}</dd>
          <dt className="text-muted">{t.contact}</dt>
          <dd>{show([company.contact.email, company.contact.phone, company.contact.website].filter(Boolean))}</dd>
          <dt className="text-muted">{t.owner}</dt>
          <dd>{company.ownerEmail ?? '—'}</dd>
          <dt className="text-muted">{t.companyPage}</dt>
          <dd><Link href={href(`/m/${company.slug}`)} className="link">/m/{company.slug}</Link></dd>
        </dl>
      </section>

      <section aria-labelledby="registration-title" className={section}>
        <h2 id="registration-title" className={heading}>{t.registration}</h2>
        {registration ? (
          <dl className="grid max-w-[720px] gap-x-6 gap-y-2 sm:grid-cols-[14rem_1fr]">
            {FIELDS.map((key) => (
              <div key={key} className="contents">
                <dt className="text-muted">{fieldLabel(key)}</dt>
                <dd className="break-words">{value(key)}</dd>
              </div>
            ))}
            <dt className="text-muted">{r.certifications}</dt>
            <dd>
              {registration.certifications.length > 0 ? (
                <ul>
                  {registration.certifications.map((c) => (
                    <li key={`${c.scheme}-${c.number}`}>
                      {r.schemes[c.scheme]} {c.number}{c.validUntil && `, ${t.validUntil(c.validUntil)}`}
                    </li>
                  ))}
                </ul>
              ) : (
                '—'
              )}
            </dd>
          </dl>
        ) : (
          <p className="text-muted">{t.noRegistration}</p>
        )}
      </section>

      <section aria-labelledby="checks-title" className={section}>
        <h2 id="checks-title" className={heading}>{t.checks}</h2>
        {checks.length > 0 ? (
          <ul className="flex max-w-[720px] flex-col">
            {checks.map((c) => (
              <li key={c.source} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line py-2">
                <Chip>{t.outcomes[c.outcome]}</Chip>
                <span className="font-semibold">{t.sources[c.source]}</span>
                <span className="text-muted">{c.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t.noChecks}</p>
        )}
        {!own && (
          <div>
            <RowActionButton action={rerunChecksAction.bind(null, company.id)} label={t.rerun} />
          </div>
        )}
      </section>

      <section aria-labelledby="manual-title" className={section}>
        <h2 id="manual-title" className={heading}>{t.manualChecks}</h2>
        <p className="max-w-[720px] text-muted">{t.manualHint}</p>
        <ul className="flex flex-col gap-1">
          {manualChecksFor(company.country, registration?.openSupplyHubId ?? null).map((m) => (
            <li key={m.url}>
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="link">
                {m.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="documents-title" className={section}>
        <h2 id="documents-title" className={heading}>{t.documents}</h2>
        {documents.length > 0 ? (
          <ul aria-labelledby="documents-title" className="flex flex-col gap-1">
            {documents.map((d) => (
              <li key={d.id}>
                <a href={`/api/company-documents/${d.id}`} className="link">
                  {d.fileName}
                </a>{' '}
                <span className="text-sm text-muted">· {r.kinds[d.kind]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t.noDocuments}</p>
        )}
      </section>

      <section aria-labelledby="missing-title" className={section}>
        <h2 id="missing-title" className={heading}>{t.missing}</h2>
        {missing.length > 0 ? (
          <ul className="list-disc pl-5">
            {missing.map((key) => (
              <li key={key}>{missingSentence(r, company.country, key)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t.nothingMissing}</p>
        )}
      </section>

      <section aria-labelledby="history-title" className={section}>
        <h2 id="history-title" className={heading}>{t.history}</h2>
        {events.length > 0 ? (
          <ol className="flex max-w-[720px] flex-col">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 border-t border-line py-2">
                <p>
                  <span className="font-semibold">{t.actions[e.action]}</span> {t.by(e.actorEmail ?? e.actorUserId)} ·{' '}
                  <time dateTime={e.createdAt.toISOString()}>{when.format(e.createdAt)}</time>
                </p>
                {e.note && <p className="whitespace-pre-line">{e.note}</p>}
                {e.changes && (
                  <ul className="text-sm text-muted">
                    {Object.entries(e.changes).map(([key, [before, after]]) => (
                      <li key={key}>
                        {fieldLabel(key)}: {show(before)} → {show(after)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">{t.noHistory}</p>
        )}
      </section>

      {!own && (
        <section aria-labelledby="decision-title" className={section}>
          <h2 id="decision-title" className={heading}>{t.decision}</h2>
          <div className="flex max-w-[720px] flex-col gap-6">
            {company.status === 'submitted' && (
              <>
                <RowActionButton action={approveRegistrationAction.bind(null, company.id)} label={t.approve} confirmLabel={t.confirmApprove} />
                <NoteDecisionForm action={requestChangesAction.bind(null, company.id)} label={t.changesNote} submit={t.requestChanges} />
              </>
            )}
            {(company.status === 'submitted' || company.status === 'approved') && (
              <NoteDecisionForm action={rejectRegistrationAction.bind(null, company.id)} label={t.rejectNote} submit={t.reject} />
            )}
            <EditForm companyId={company.id} country={company.country} saved={registrationFormValues(registration)} label={t.edit} />
          </div>
        </section>
      )}
    </div>
  );
}
