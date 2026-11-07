import { readConfig } from '@/server/config';
import { SignInForm, type Provider } from './sign-in-form';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { oauth } = readConfig();
  const providers = (['google', 'microsoft'] as const).filter((p): p is Provider => oauth[p] !== null);
  // Better Auth sends a refused provider sign-in back here with ?error=<code>.
  const providerFailed = Boolean((await searchParams).error);
  return (
    <div className="page">
      <div className="panel grid gap-3 lg:grid-cols-2">
        <div className="p-4 sm:p-6">
          <h1 className="page-title">Sign in</h1>
          <p className="mt-3 text-lg">We email you a link, so there is no password to remember. New here? The same steps create your account.</p>
        </div>
        <div className="card">
          <SignInForm providers={providers} providerFailed={providerFailed} />
        </div>
      </div>
    </div>
  );
}
