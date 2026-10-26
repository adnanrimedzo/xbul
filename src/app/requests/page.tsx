import Link from 'next/link';
import { RowActionButton } from '@/app/_components/row-action-button';
import { Badge } from '@/app/_components/ui/badge';
import { listCompanyInquiries } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';
import { markAnsweredAction } from './actions';

export default async function RequestsPage() {
  const { company } = await requireMill();
  const { db } = await getContainer();
  const rows = await listCompanyInquiries(db, company.id);

  return (
    <div>
      <div className="px-5 pt-7 pb-[18px]">
        <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Requests</h1>
        <div className="mt-2 text-[12px]">{company.name}</div>
      </div>

      <div className="flex justify-between border-t border-ink px-5 py-3 text-[12px] font-semibold">
        <h2>Inbox</h2>
        <span>{rows.length}</span>
      </div>
      {rows.length > 0 ? (
        <ul>
          {rows.map((row) => (
            <li key={row.id} data-testid="inquiry-row" className="flex flex-wrap justify-between gap-x-6 gap-y-3 border-t border-ink px-5 py-4">
              <div className="flex min-w-0 max-w-[720px] flex-1 flex-col gap-2 text-[12px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold">
                  <Badge tone={row.status === 'new' ? 'accent' : 'outline'}>{row.status === 'new' ? 'New' : 'Answered'}</Badge>
                  <span>{row.kind}</span>
                  <span className="font-normal text-muted">{row.createdAt.toLocaleDateString('en-GB')}</span>
                </div>
                <div className="break-words">
                  <span className="text-[16px] font-semibold">{row.buyerName}</span>
                  {row.buyerCompany && <span> · {row.buyerCompany}</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <a href={`mailto:${encodeURIComponent(row.buyerEmail).replace('%40', '@')}`} className="border-b border-ink break-all normal-case">
                    {row.buyerEmail}
                  </a>
                  {row.quantityMeters !== null && <span>{row.quantityMeters.toLocaleString('en-US')} m</span>}
                </div>
                {row.message && <p className="break-words whitespace-pre-wrap normal-case">{row.message}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  <Link href={row.target.href} className="border-b border-ink">
                    {row.target.label}
                  </Link>
                  {row.viaAgentHandle && <span className="text-accent">{`Via agent @${row.viaAgentHandle}`}</span>}
                </div>
              </div>
              {row.status === 'new' && <RowActionButton action={markAnsweredAction.bind(null, row.id)} label="Mark answered" />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-ink px-5 py-6 text-[12px] text-muted normal-case">No requests yet.</p>
      )}
    </div>
  );
}
