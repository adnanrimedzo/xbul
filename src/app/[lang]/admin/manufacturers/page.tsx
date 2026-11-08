import Link from 'next/link';
import { pageMessages } from '@/i18n/server';
import { listRegistrations } from '@/modules/discovery';
import type { CompanyStatus } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';
import { ADMIN_MANUFACTURERS } from './messages';

const TABS: CompanyStatus[] = ['submitted', 'changes_requested', 'approved', 'rejected', 'draft'];

// "3 days ago", in the page's language.
function ago(date: Date, lang: string): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(minutes) < 60 * 24) return rtf.format(Math.round(minutes / 60), 'hour');
  return rtf.format(Math.round(minutes / 60 / 24), 'day');
}

export default async function AdminManufacturersPage({ searchParams }: PageProps<'/[lang]/admin/manufacturers'>) {
  await requireAdmin();
  const { t, lang, href } = await pageMessages(ADMIN_MANUFACTURERS);
  const requested = (await searchParams).status;
  const status = TABS.find((s) => s === requested) ?? 'submitted';
  const { db } = await getContainer();
  const rows = await listRegistrations(db, status);

  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <p className="mt-2 text-lg">{t.intro}</p>

      <nav aria-label={t.tabs} className="mt-6 flex flex-wrap gap-2">
        {TABS.map((s) => (
          <Link
            key={s}
            href={href(`/admin/manufacturers?status=${s}`)}
            aria-current={s === status ? 'page' : undefined}
            className="inline-flex min-h-11 items-center rounded-control border border-line px-4 text-sm aria-[current=page]:bg-inverse aria-[current=page]:text-on-inverse"
          >
            {t.statuses[s]}
          </Link>
        ))}
      </nav>

      {rows.length > 0 ? (
        <ul className="panel mt-6 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.companyId} className="card flex flex-col gap-1.5">
              <Link href={href(`/admin/manufacturers/${row.companyId}`)} className="section-title self-start hover:underline">
                {row.name}
              </Link>
              <p>
                {t.kinds[row.kind]}, {row.country} · {row.submittedAt ? t.submittedAgo(ago(row.submittedAt, lang)) : t.neverSubmitted}
              </p>
              <p className="text-sm text-muted">{t.checks(row.checks)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel mt-6 p-8! text-muted">{t.nothing}</p>
      )}
    </div>
  );
}
