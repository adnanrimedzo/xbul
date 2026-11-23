import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageLang, pageMessages } from '@/i18n/server';
import { listArticleChoices } from '@/modules/discovery';
import { MAX_COMPANY_PHOTOS, MAX_PHOTO_BATCH, MAX_PHOTO_COLORS } from '@/modules/photos';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';
import { SUPPLIER_PHOTOS } from './messages';
import { SupplierPhotos, type PhotoView } from './supplier-photos';

export async function generateMetadata() {
  return { title: SUPPLIER_PHOTOS[await pageLang()].title, robots: { index: false } };
}

// The owner's own photos only: any other slug is as missing as one that doesn't exist (admins included).
export default async function SupplierPhotosPage({ params }: PageProps<'/[lang]/m/[company]/photos'>) {
  const { company } = await requireMill();
  if ((await params).company !== company.slug) notFound();
  const [{ t, href }, { db, supplierPhotos, photoModel }] = await Promise.all([pageMessages(SUPPLIER_PHOTOS), getContainer()]);
  const [photos, articles] = await Promise.all([supplierPhotos.listByCompany(company.id), listArticleChoices(db, company.id)]);
  const view = (p: (typeof photos)[number]): PhotoView => ({ id: p.id, tags: p.tags, articleId: p.articleId });

  return (
    <div className="page flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={href(`/m/${company.slug}`)} className="link self-start">
          {company.name}
        </Link>
        <h1 className="page-title">{t.title}</h1>
        <p className="max-w-[65ch] text-muted">{t.intro}</p>
        <p className="font-mono text-sm text-muted">{t.count(photos.length, MAX_COMPANY_PHOTOS)}</p>
      </div>
      <SupplierPhotos
        drafts={photos.filter((p) => p.status === 'draft').map(view)}
        published={photos.filter((p) => p.status === 'published').map(view)}
        articles={articles}
        enabled={photoModel !== null}
        limits={{ maxColors: MAX_PHOTO_COLORS, maxBatch: MAX_PHOTO_BATCH }}
      />
    </div>
  );
}
