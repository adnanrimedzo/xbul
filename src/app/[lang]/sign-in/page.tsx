import { pageMessages } from '@/i18n/server';
import { readConfig } from '@/server/config';
import { SIGN_IN } from './messages';
import { SignInForm, type Provider } from './sign-in-form';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { t } = await pageMessages(SIGN_IN);
  const { oauth } = readConfig();
  const providers = (['google', 'microsoft'] as const).filter((p): p is Provider => oauth[p] !== null);
  // Better Auth sends a refused provider sign-in back here with ?error=<code>.
  const providerFailed = Boolean((await searchParams).error);
  return (
    <div className="page">
      <div className="panel grid gap-3 lg:grid-cols-2">
        <div className="p-4 sm:p-6">
          <h1 className="page-title">{t.title}</h1>
          <p className="mt-3 text-lg">{t.intro}</p>
        </div>
        <div className="card">
          <SignInForm providers={providers} providerFailed={providerFailed} />
        </div>
      </div>
    </div>
  );
}
