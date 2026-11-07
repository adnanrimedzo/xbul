import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RowActionButton } from '@/app/_components/row-action-button';
import { pageLang, pageMessages } from '@/i18n/server';
import { missingForSubmit, taxIdLabel } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';
import { removeCompanyDocumentAction, saveRegistrationAction, submitRegistrationAction } from './actions';
import { DocumentUploader } from './document-uploader';
import { REGISTRATION } from './messages';
import { RegistrationForm } from './registration-form';
import { missingSentence, registrationFormValues } from './registration-values';

export async function generateMetadata() {
  return { title: REGISTRATION[await pageLang()].title };
}

// The owner's own registration only: any other slug is as missing as one that doesn't exist.
export default async function RegistrationPage({ params }: PageProps<'/[lang]/m/[company]/registration'>) {
  const { company } = await requireMill();
  if ((await params).company !== company.slug) notFound();
  const { t, href } = await pageMessages(REGISTRATION);
  const { registrations, documents, reviewEvents } = await getContainer();
  const [registration, files, events] = await Promise.all([
    registrations.find(company.id),
    documents.listByCompany(company.id),
    reviewEvents.listByCompany(company.id),
  ]);
  const missing = missingForSubmit(company.country, registration, files.map((f) => f.kind));
  const editable = company.status === 'draft' || company.status === 'changes_requested';
  const note = events.findLast((e) => e.action === company.status)?.note ?? ''; // the admin's note behind changes_requested or rejected
  const tr = company.country === 'TR';

  return (
    <div className="page flex flex-col gap-8">
      <div>
        <nav aria-label={t.breadcrumb}>
          <Link href={href(`/m/${company.slug}`)} className="link">
            {company.name}
          </Link>{' '}
          / {t.title}
        </nav>
        <h1 className="page-title mt-3">{t.title}</h1>
        <p className="mt-2 text-muted">{t.privacy}</p>
      </div>

      <p className={`max-w-[720px] font-semibold ${company.status === 'changes_requested' || company.status === 'rejected' ? 'alert' : 'panel'}`}>
        {t.banner(company.status, note)}
      </p>

      <RegistrationForm action={saveRegistrationAction} saved={registrationFormValues(registration)} tr={tr} taxLabel={taxIdLabel(company.country)} locked={!editable} />

      <section aria-labelledby="documents-title" className="flex flex-col gap-4">
        <h2 id="documents-title" className="section-title">
          {t.documents}
        </h2>
        {files.length > 0 ? (
          <ul aria-labelledby="documents-title" className="flex max-w-[640px] flex-col">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-4 border-t border-line py-2">
                <span className="min-w-0">
                  <a href={`/api/company-documents/${file.id}`} className="link">
                    {file.fileName}
                  </a>{' '}
                  <span className="text-sm text-muted">· {t.kinds[file.kind]}</span>
                </span>
                {editable && <RowActionButton action={removeCompanyDocumentAction.bind(null, file.id)} label={t.remove} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t.noDocuments}</p>
        )}
        {editable && <DocumentUploader tr={tr} />}
      </section>

      {editable && (
        <section aria-labelledby="submit-title" className="card flex max-w-[720px] flex-col gap-4">
          <h2 id="submit-title" className="section-title">
            {t.beforeSubmit}
          </h2>
          {missing.length > 0 ? (
            <ul className="list-disc pl-5">
              {missing.map((key) => (
                <li key={key}>{missingSentence(t, company.country, key)}</li>
              ))}
            </ul>
          ) : (
            <p>{t.nothingMissing}</p>
          )}
          <div>
            <RowActionButton action={submitRegistrationAction} label={t.submit} disabled={missing.length > 0} />
          </div>
        </section>
      )}
    </div>
  );
}
