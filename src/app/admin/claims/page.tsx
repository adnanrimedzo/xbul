import Link from 'next/link';
import { RowActionButton } from '@/app/_components/row-action-button';
import { listPendingReviews } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';
import { approveReviewAction } from './actions';
import { RejectForm } from './reject-form';

const SCOPE_LABEL = { fabric: 'Fabric', garment: 'Garment' };

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default async function AdminClaimsPage() {
  await requireAdmin();
  const { db } = await getContainer();
  const rows = await listPendingReviews(db);

  return (
    <div>
      <div className="px-5 pt-7 pb-[18px]">
        <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Admin</h1>
        <div className="mt-2 text-[12px]">Originals sent in for review, longest waiting first</div>
      </div>

      <div className="flex justify-between border-t border-ink px-5 py-3 text-[12px] font-semibold">
        <h2>To review</h2>
        <span>{rows.length}</span>
      </div>
      {rows.length > 0 ? (
        <ul>
          {rows.map((row) => (
            <li key={row.claimId} data-testid="pending-review" className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-t border-ink px-5 py-4">
              <div className="flex min-w-0 flex-col gap-1.5 text-[12px]">
                <Link href={`/p/${row.product.id}`} className="self-start border-b border-ink text-[16px] font-semibold">
                  {row.product.brand} — {row.product.name}
                </Link>
                <div>
                  {row.company.name} <span className="text-muted">· {SCOPE_LABEL[row.scope]}</span>
                </div>
                <ul aria-label="Documents" className="flex flex-col gap-1">
                  {row.evidence.map((file) => (
                    <li key={file.id}>
                      <a href={`/api/evidence/${file.id}`} className="border-b border-ink normal-case">
                        {file.fileName}
                      </a>{' '}
                      <span className="text-muted">{size(file.sizeBytes)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-start gap-3">
                <RowActionButton action={approveReviewAction.bind(null, row.claimId)} label="Approve" />
                <RejectForm claimId={row.claimId} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-ink px-5 py-6 text-[12px] text-muted normal-case">Nothing to review.</p>
      )}
    </div>
  );
}
