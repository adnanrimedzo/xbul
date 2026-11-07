import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { RowActionButton } from '@/app/_components/row-action-button';
import { alternates } from '@/app/_lib/seo';
import { VerifiedBadge } from '@/app/_components/ui/verified';
import { pageLang, pageMessages } from '@/i18n/server';
import { getProduct } from '@/modules/catalog';
import { MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES, type Evidence } from '@/modules/claims';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';
import { removeEvidenceAction, submitForReviewAction } from './actions';
import { VERIFY } from './messages';
import { UploadEvidenceForm } from './upload-evidence-form';

export async function generateMetadata({ params }: PageProps<'/[lang]/verify/[claim]'>) {
  const lang = await pageLang();
  return { title: VERIFY[lang].title, alternates: alternates(lang, `/verify/${(await params).claim}`) };
}

// The supplier's own documents; the download route lets only this supplier and admins fetch them.
async function FileList({ files, claimId, editable }: { files: readonly Evidence[]; claimId: string; editable: boolean }) {
  if (files.length === 0) return null;
  const { t } = await pageMessages(VERIFY);
  return (
    <ul aria-label={t.documents} className="flex max-w-[640px] flex-col">
      {files.map((file) => (
        <li key={file.id} className="flex items-center justify-between gap-4 border-t border-line py-2">
          <a href={`/api/evidence/${file.id}`} className="link min-w-0">
            {file.fileName}
          </a>
          {editable && <RowActionButton action={removeEvidenceAction.bind(null, claimId, file.id)} label={t.remove} />}
        </li>
      ))}
    </ul>
  );
}

export default async function VerifyPage({ params }: PageProps<'/[lang]/verify/[claim]'>) {
  const { company } = await requireMill();
  const { t, href } = await pageMessages(VERIFY);
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
    <div className="page">
      <nav aria-label={t.breadcrumb}>
        <Link href={href(`/m/${company.slug}`)} className="link">
          {company.name}
        </Link>{' '}
        / {t.title}
      </nav>
      <h1 className="page-title mt-3">{t.title}</h1>
      <p className="mt-2 text-lg">
        <Link href={href(`/p/${product.id}`)} className="link">
          {product.brand} — {product.name}
        </Link>
      </p>

      <div className="panel mt-6">
        <div className="card flex flex-col gap-4">
          {verified ? (
            <p>
              <VerifiedBadge />
            </p>
          ) : pending ? (
            <>
              <h2 className="section-title">{t.underReview}</h2>
              <p className="max-w-[70ch]">{t.underReviewBody}</p>
              <FileList files={files} claimId={claim.id} editable={false} />
            </>
          ) : (
            <>
              {rejected && <p className="alert max-w-[640px]">{t.rejected(claim.reviewNote?.replace(/\.$/, '') ?? '')}</p>}
              <p className="max-w-[70ch]">
                {t.uploadIntro}{' '}
                <Link href={href('/privacy')} className="link">
                  {t.privacy}
                </Link>
              </p>
              <FileList files={files} claimId={claim.id} editable />
              <UploadEvidenceForm claimId={claim.id} maxBytes={MAX_EVIDENCE_BYTES} maxFiles={MAX_EVIDENCE_FILES} />
              {files.length > 0 && (
                <div>
                  <RowActionButton action={submitForReviewAction.bind(null, claim.id)} label={t.submit} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
