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
    { key: 'searchers', label: 'Searchers', value: stats.distinctSearchers, note: 'Target: 10–20' },
    { key: 'searches', label: 'Searches', value: stats.searches, note: `${stats.matchedSearches} found` },
  ];

  return (
    <div>
      <div className="px-5 pt-7 pb-[18px]">
        <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Stats</h1>
        <div className="mt-2 text-[12px]">Progress against the launch targets</div>
      </div>

      <ul>
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-ink px-5 py-4">
            <h2 className="text-[12px] font-semibold">{row.label}</h2>
            <div className="flex items-baseline gap-4 text-[12px]">
              <span className="text-muted">{row.note}</span>
              <span data-testid={`stat-${row.key}`} className="text-[44px] leading-none font-bold">
                {row.value}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
