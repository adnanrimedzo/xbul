import { SignInForm } from './sign-in-form';

export default function SignInPage() {
  return (
    <div className="grid min-h-[420px] grid-cols-[1fr_1.4fr] max-[1100px]:grid-cols-1">
      <div className="border-r border-ink px-5 py-7 max-[1100px]:border-r-0 max-[1100px]:border-b">
        <h1 className="mb-3.5 text-[44px] leading-[0.9] font-bold tracking-[-0.02em]">Sign in</h1>
        <p className="text-[12px] leading-normal text-[#333] normal-case">We email you a link, so there is no password to remember.</p>
      </div>
      <div className="px-5 py-7">
        <SignInForm />
      </div>
    </div>
  );
}
