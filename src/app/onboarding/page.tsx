import { redirect } from 'next/navigation';
import { requireViewer } from '@/server/viewer';
import { OnboardingForm } from './onboarding-form';

export default async function OnboardingPage() {
  const { company, email, isAdmin } = await requireViewer();
  if (company) redirect('/add');
  if (isAdmin) redirect('/admin/claims'); // an admin is here to review, and filling this form in would publish a supplier
  return (
    <div className="page">
      <div className="panel grid gap-3 lg:grid-cols-2">
        <div className="p-4 sm:p-6">
          <h1 className="page-title">Welcome</h1>
          <p className="mt-3 text-lg">Tell us who you are so we can set up your account.</p>
        </div>
        <div className="card">
          <OnboardingForm defaultEmail={email} />
        </div>
      </div>
    </div>
  );
}
