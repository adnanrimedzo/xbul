import { switchModeAction } from '@/app/_actions/switch-mode';
import { pageMessages } from '@/i18n/server';
import type { Viewer } from '@/server/viewer';
import { CHROME } from './messages';

export async function ModeSwitcher({ viewer }: { viewer: Viewer }) {
  const { t } = await pageMessages(CHROME);
  const labels = { search: t.modeSearch, manufacturer: t.modeManufacturer, admin: t.modeAdmin };
  return (
    <div role="group" aria-label={t.mode} className="inline-flex rounded-control border border-line p-0.5">
      {viewer.modes.map((m) => (
        <form key={m} action={switchModeAction.bind(null, m)}>
          <button
            type="submit"
            aria-current={m === viewer.mode ? 'true' : undefined}
            className="min-h-9 rounded-control px-3 text-sm text-muted transition-colors duration-150 hover:text-fg aria-[current=true]:bg-surface aria-[current=true]:text-fg"
          >
            {labels[m]}
          </button>
        </form>
      ))}
    </div>
  );
}
