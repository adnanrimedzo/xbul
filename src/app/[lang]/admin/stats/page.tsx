import { pageMessages } from '@/i18n/server';
import { getPlatformStats } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';
import { ADMIN_STATS } from './messages';

export default async function AdminStatsPage() {
  await requireAdmin();
  const { t } = await pageMessages(ADMIN_STATS);
  const { db } = await getContainer();
  const stats = await getPlatformStats(db);
  const rows = [
    { key: 'suppliers', label: t.suppliers, value: stats.suppliers, note: t.suppliersNote },
    { key: 'products', label: t.products, value: stats.taggedProducts, note: t.productsNote },
    { key: 'searchers', label: t.searchers, value: stats.distinctSearchers, note: t.searchersNote },
    { key: 'searches', label: t.searches, value: stats.searches, note: t.searchesNote(stats.matchedSearches) },
  ];

  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <p className="mt-2 text-lg">{t.intro}</p>

      <ul className="panel mt-6 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.key} className="card flex flex-col gap-3">
            <h2 className="font-semibold">{row.label}</h2>
            <span data-testid={`stat-${row.key}`} className="font-display text-5xl leading-none font-medium tracking-[-0.04em]">
              {row.value}
            </span>
            <p className="text-sm text-muted">{row.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
