import { redirect } from 'next/navigation';
import { pageMessages } from '@/i18n/server';
import { switchModeAction } from '@/app/_actions/switch-mode';
import { onboardingRedirect } from '@/server/modes';
import { requireViewer } from '@/server/viewer';
import { ONBOARDING } from './messages';
import { OnboardingForm } from './onboarding-form';

export default async function OnboardingPage() {
  const viewer = await requireViewer();
  const { t, href } = await pageMessages(ONBOARDING);
  const to = onboardingRedirect(viewer);
  if (to) redirect(href(to));
  return (
    <div className="page">
      <div className="panel grid gap-3 lg:grid-cols-2">
        <div className="p-4 sm:p-6">
          <h1 className="page-title">{t.welcome}</h1>
          <p className="mt-3 text-lg">{t.intro}</p>
        </div>
        <div className="card">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">{t.onlySearching}</p>
            <form action={switchModeAction.bind(null, 'search')}>
              <button type="submit" className="min-h-11 rounded-control border border-line px-3 text-sm hover:text-fg">{t.searchManufacturers}</button>
            </form>
          </div>
          <OnboardingForm defaultEmail={viewer.email} />
        </div>
      </div>
    </div>
  );
}
