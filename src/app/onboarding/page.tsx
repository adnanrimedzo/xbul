import { redirect } from 'next/navigation';
import { requireViewer } from '@/server/viewer';
import { OnboardingForm } from './onboarding-form';

export default async function OnboardingPage() {
  const { company, email } = await requireViewer();
  if (company) redirect('/add');
  return (
    <div className="grid min-h-[420px] grid-cols-[1fr_1.4fr] max-[1100px]:grid-cols-1">
      <div className="border-r border-ink px-5 py-7 max-[1100px]:border-r-0 max-[1100px]:border-b">
        <h1 className="mb-3.5 text-[44px] leading-[0.9] font-bold tracking-[-0.02em]">Welcome</h1>
        <p className="text-[12px] leading-normal text-[#333] normal-case">Tell us who you are so we can set up your account.</p>
      </div>
      <div className="px-5 py-7">
        <OnboardingForm defaultEmail={email} />
      </div>
    </div>
  );
}
