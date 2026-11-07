import { pageMessages } from '@/i18n/server';
import { SIGN_IN } from './messages';
import { SignInForm } from './sign-in-form';

export default async function SignInPage() {
  const { t } = await pageMessages(SIGN_IN);
  return (
    <div className="page">
      <div className="panel grid gap-3 lg:grid-cols-2">
        <div className="p-4 sm:p-6">
          <h1 className="page-title">{t.title}</h1>
          <p className="mt-3 text-lg">{t.intro}</p>
        </div>
        <div className="card">
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
