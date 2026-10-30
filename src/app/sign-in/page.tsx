import { SignInForm } from './sign-in-form';

export default function SignInPage() {
  return (
    <div className="page">
      <div className="panel grid gap-3 lg:grid-cols-2">
        <div className="p-4 sm:p-6">
          <h1 className="page-title">Sign in</h1>
          <p className="mt-3 text-lg">We email you a link, so there is no password to remember.</p>
        </div>
        <div className="card">
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
