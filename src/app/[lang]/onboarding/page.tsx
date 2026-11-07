import { redirect } from 'next/navigation';
import { pageMessages } from '@/i18n/server';
import { requireViewer } from '@/server/viewer';
import { ONBOARDING } from './messages';
import { OnboardingForm } from './onboarding-form';

export default async function OnboardingPage() {
  const { company, email, isAdmin } = await requireViewer();
  const { t, href } = await pageMessages(ONBOARDING);
  if (company) redirect(href('/add'));
  if (isAdmin) redirect(href('/admin/claims')); // an admin is here to review, and filling this form in would publish a supplier
  return (
    <div className="page">
      <div className="panel grid gap-3 lg:grid-cols-2">
        <div className="p-4 sm:p-6">
          <h1 className="page-title">{t.welcome}</h1>
          <p className="mt-3 text-lg">{t.intro}</p>
        </div>
        <div className="card">
          <OnboardingForm defaultEmail={email} />
        </div>
      </div>
    </div>
  );
}
