import { getPlatformStats } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';

export default async function AdminStatsPage() {
  await requireAdmin();
  const { db } = await getContainer();
  const stats = await getPlatformStats(db);
  const rows = [
    { key: 'suppliers', label: 'Suppliers', value: stats.suppliers, note: 'Target: 20–30' },
    { key: 'products', label: 'Products', value: stats.taggedProducts, note: 'Target: 200–300' },
    { key: 'searchers', label: 'Visitor-days', value: stats.distinctSearchers, note: 'Target: 10–20 customers. One address counts once a day, so this overstates customers.' },
    { key: 'searches', label: 'Searches', value: stats.searches, note: `${stats.matchedSearches} found` },
  ];

  return (
    <div className="page">
      <h1 className="page-title">Stats</h1>
      <p className="mt-2 text-lg">Progress against the launch targets.</p>

      <ul className="panel mt-6 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.key} className="card flex flex-col gap-3">
            <h2 className="font-semibold">{row.label}</h2>
            <span data-testid={`stat-${row.key}`} className="text-5xl leading-none font-extrabold">
              {row.value}
            </span>
            <p className="text-sm text-muted">{row.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
