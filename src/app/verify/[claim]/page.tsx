import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { RowActionButton } from '@/app/_components/row-action-button';
import { Badge } from '@/app/_components/ui/badge';
import { getProduct } from '@/modules/catalog';
import { MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES, type Evidence } from '@/modules/claims';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';
import { removeEvidenceAction, submitForReviewAction } from './actions';
import { UploadEvidenceForm } from './upload-evidence-form';

export const metadata: Metadata = { title: 'Get verified' };

// The supplier's own documents; the download route lets only this supplier and admins fetch them.
function FileList({ files, claimId, editable }: { files: readonly Evidence[]; claimId: string; editable: boolean }) {
  if (files.length === 0) return null;
  return (
    <ul aria-label="Documents" className="max-w-[640px]">
      {files.map((file) => (
        <li key={file.id} className="flex items-start justify-between gap-4 border-t border-ink py-2.5 text-[12px]">
          <a href={`/api/evidence/${file.id}`} className="min-w-0 self-center border-b border-ink break-all normal-case">
            {file.fileName}
          </a>
          {editable && <RowActionButton action={removeEvidenceAction.bind(null, claimId, file.id)} label="Remove" />}
        </li>
      ))}
    </ul>
  );
}

export default async function VerifyPage({ params }: PageProps<'/verify/[claim]'>) {
  const { company } = await requireMill();
  const { claim: claimId } = await params;
  if (!z.uuid().safeParse(claimId).success) notFound();

  // Another supplier's claim is as missing as one that doesn't exist. Only originals can be verified.
  const { claims, evidence, products } = await getContainer();
  const claim = await claims.findById(claimId);
  if (!claim || claim.companyId !== company.id || claim.kind !== 'original') notFound();
  const [files, product] = await Promise.all([evidence.listByClaim(claim.id), getProduct({ products }, claim.productId)]);
  if (!product) notFound();

  // Verified is the claim's status, whatever else is recorded about its review.
  const verified = claim.status === 'verified';
  const pending = !verified && claim.reviewStatus === 'pending';
  const rejected = !verified && !pending && claim.reviewStatus === 'rejected';

  return (
    <div>
      <div className="px-5 pt-7 pb-[18px]">
        <nav aria-label="Breadcrumb" className="mb-3 text-[11px]">
          <Link href={`/m/${company.slug}`}>{company.name}</Link> / <span className="text-accent">Get verified</span>
        </nav>
        <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Get verified</h1>
        <div className="mt-2 text-[12px] font-semibold">
          <Link href={`/p/${product.id}`} className="border-b border-ink">
            {product.brand} — {product.name}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-ink px-5 py-5 text-[12px]">
        {verified ? (
          <p>
            <Badge tone="accent">Verified</Badge>
          </p>
        ) : pending ? (
          <>
            <h2 className="text-[16px] font-bold">Under review</h2>
            <p className="max-w-[640px] normal-case">An admin is checking these documents. They are deleted as soon as the decision is made.</p>
            <FileList files={files} claimId={claim.id} editable={false} />
          </>
        ) : (
          <>
            {rejected && (
              <p className="max-w-[640px] border border-accent px-3 py-2 normal-case">
                Rejected: {claim.reviewNote}. Add new documents and submit again.
              </p>
            )}
            <p className="max-w-[640px] normal-case">
              Upload an invoice, order or correspondence with the customer. Cover prices if you like. Files are private and deleted once reviewed.
            </p>
            <FileList files={files} claimId={claim.id} editable />
            <UploadEvidenceForm claimId={claim.id} maxBytes={MAX_EVIDENCE_BYTES} maxFiles={MAX_EVIDENCE_FILES} />
            {files.length > 0 && (
              <div>
                <RowActionButton action={submitForReviewAction.bind(null, claim.id)} label="Submit for review" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
