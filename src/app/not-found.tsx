import { LinkButton } from '@/app/_components/ui/button';

// Rendered inside the root layout, so a missing page keeps the site chrome.
export default function NotFound() {
  return (
    <div className="page">
      <h1 className="page-title">Not found</h1>
      <p className="mt-3 mb-6">This page doesn&apos;t exist, or it has been removed.</p>
      <LinkButton variant="cta" href="/">
        Back to xbul.io
      </LinkButton>
    </div>
  );
}
