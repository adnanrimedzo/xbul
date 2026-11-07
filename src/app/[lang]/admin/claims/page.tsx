import Link from 'next/link';
import { RowActionButton } from '@/app/_components/row-action-button';
import { pageMessages } from '@/i18n/server';
import { listPendingReviews } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';
import { approveReviewAction } from './actions';
import { ADMIN_CLAIMS } from './messages';
import { RejectForm } from './reject-form';

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default async function AdminClaimsPage() {
  await requireAdmin();
  const { t, href } = await pageMessages(ADMIN_CLAIMS);
  const { db } = await getContainer();
  const rows = await listPendingReviews(db);

  return (
    <div className="page">
      <h1 className="page-title">{t.toReview(rows.length)}</h1>
      <p className="mt-2 text-lg">{t.intro}</p>

      {rows.length > 0 ? (
        <ul className="panel mt-6 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.claimId} data-testid="pending-review" className="card flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Link href={href(`/p/${row.product.id}`)} className="section-title self-start hover:underline">
                  {row.product.brand} — {row.product.name}
                </Link>
                <p>
                  {row.company.name}, {t.scope[row.scope]}
                </p>
                <ul aria-label={t.documents} className="flex flex-col gap-1">
                  {row.evidence.map((file) => (
                    <li key={file.id}>
                      <a href={`/api/evidence/${file.id}`} className="link">
                        {file.fileName}
                      </a>{' '}
                      <span className="text-sm text-muted">{size(file.sizeBytes)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-start gap-3">
                <RowActionButton action={approveReviewAction.bind(null, row.claimId)} label={t.approve} confirmLabel={t.confirmApprove} />
                <RejectForm claimId={row.claimId} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel mt-6 p-8! text-muted">{t.nothing}</p>
      )}
    </div>
  );
}
