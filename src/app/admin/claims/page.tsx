import Link from 'next/link';
import { RowActionButton } from '@/app/_components/row-action-button';
import { listDeclaredOriginals } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';
import { verifyClaimAction } from './actions';

export default async function AdminClaimsPage() {
  await requireAdmin();
  const { db } = await getContainer();
  const rows = await listDeclaredOriginals(db);

  return (
    <div>
      <div className="px-5 pt-7 pb-[18px]">
        <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Admin</h1>
        <div className="mt-2 text-[12px]">Declared originals, oldest first</div>
      </div>

      <div className="flex justify-between border-t border-ink px-5 py-3 text-[12px] font-semibold">
        <h2>To verify</h2>
        <span>{rows.length}</span>
      </div>
      {rows.length > 0 ? (
        <ul>
          {rows.map((row) => (
            <li key={row.claimId} data-testid="declared-original" className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-t border-ink px-5 py-4">
              <div className="flex min-w-0 flex-col gap-1.5 text-[12px]">
                <Link href={`/p/${row.product.id}`} className="self-start border-b border-ink text-[16px] font-semibold">
                  {row.product.brand} — {row.product.name}
                </Link>
                <div>
                  {row.company.name} <span className="text-muted">· {row.createdAt.toLocaleDateString('en-GB')}</span>
                </div>
              </div>
              <RowActionButton action={verifyClaimAction.bind(null, row.claimId)} label="Verify" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-ink px-5 py-6 text-[12px] text-muted normal-case">Nothing to verify.</p>
      )}
    </div>
  );
}
