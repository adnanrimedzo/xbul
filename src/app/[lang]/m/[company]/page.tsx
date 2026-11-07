import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { RowActionButton } from '@/app/_components/row-action-button';
import { SupplierContact } from '@/app/_components/supplier-contact';
import { Chip } from '@/app/_components/ui/chip';
import { ClaimTag } from '@/app/_components/ui/claim-tag';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { VerifiedExplanation, VerifiedInline } from '@/app/_components/ui/verified';
import { canSeeCompany, getCompanyPageView, type CompanyPageView } from '@/modules/discovery';
import { alternates, jsonLd } from '@/app/_lib/seo';
import { OG_LOCALE } from '@/i18n/locales';
import { pageMessages } from '@/i18n/server';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { withdrawClaimAction } from './actions';
import { EditContactForm } from './edit-contact-form';
import { COMPANY } from './messages';
import { REGISTRATION } from './registration/messages';

type T = (typeof COMPANY)['en'];

const SLUG = /^[a-z0-9-]{1,120}$/;

// What the owner can do next about an original: nothing once it is verified, wait while an admin reviews it, otherwise send documents
// (or, after a rejection, read why and send new ones).
function VerifyStep({ garment, t, href }: { garment: CompanyPageView['garments'][number]; t: T; href: (path: string) => string }) {
  if (garment.kind !== 'original' || garment.claimStatus !== 'declared') return null;
  if (garment.reviewStatus === 'pending') return <span className="inline-flex min-h-12 items-center font-semibold">{t.underReview}</span>;
  return (
    <Link href={href(`/verify/${garment.claimId}`)} className="inline-flex min-h-12 items-center rounded-control border border-line px-5 font-semibold transition-colors duration-150 hover:bg-surface">
      {garment.reviewStatus === 'rejected' ? t.rejected : t.getVerified}
    </Link>
  );
}

// Shared by generateMetadata and the page, so the view is read once per request.
const loadView = cache(async (slug: string) => {
  if (!SLUG.test(slug)) notFound();
  const { db } = await getContainer();
  const view = (await getCompanyPageView(db, slug)) ?? notFound();
  if (!canSeeCompany(view.company, await getViewer())) notFound(); // not approved: only the owner and admins can open it
  return view;
});

export async function generateMetadata({ params }: PageProps<'/[lang]/m/[company]'>): Promise<Metadata> {
  const [{ company }, { config }, { t, lang, href }] = await Promise.all([loadView((await params).company), getContainer(), pageMessages(COMPANY)]);
  const place = `${company.city}, ${company.country}`;
  const path = `/m/${company.slug}`;
  const title = t.metaTitle(company.name, company.kind, place);
  const description = t.metaDescription(company.name, company.kind, place);
  return {
    title,
    description,
    alternates: alternates(lang, path),
    openGraph: { siteName: 'xbul.io', type: 'website', locale: OG_LOCALE[lang], title, description, url: `${config.baseUrl}${href(path)}` },
  };
}

export default async function MillPage({ params }: PageProps<'/[lang]/m/[company]'>) {
  const [{ company, articles, garments }, viewer, { config, registrations }, { t, href }, { t: reg }] = await Promise.all([
    loadView((await params).company), getViewer(), getContainer(), pageMessages(COMPANY), pageMessages(REGISTRATION),
  ]);
  // Certificates are public once an admin has approved the company (and checked them).
  const certifications = company.status === 'approved' ? ((await registrations.find(company.id))?.certifications ?? []) : [];
  const isOwner = viewer?.userId === company.ownerUserId;
  const ownStatus = isOwner ? viewer?.company?.status : undefined; // the owner's company is the viewer's
  const pendingStatus = ownStatus && ownStatus !== 'approved' ? ownStatus : null;
  const place = `${company.city}, ${company.country}`;
  const pageUrl = `${config.baseUrl}${href(`/m/${company.slug}`)}`;
  const { email, phone, website } = company.contact;
  // The same public contact details the page shows. url is the company's own website when it has one, otherwise this page.
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    description: t.metaDescription(company.name, company.kind, place),
    address: { '@type': 'PostalAddress', addressLocality: company.city, addressCountry: company.country },
    url: website ?? pageUrl,
    ...(website && { mainEntityOfPage: pageUrl }),
    ...(email && { email }),
    ...(phone && { telephone: phone }),
  };

  return (
    <div className="page flex flex-col gap-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} />
      {pendingStatus && (
        <p className="alert flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold">{t.notPublic[pendingStatus]}</span>
          <Link href={href(`/m/${company.slug}/registration`)} className="link">
            {t.goToRegistration}
          </Link>
        </p>
      )}
      <div className="panel p-6! sm:p-10!">
        <h1 className="page-title">{company.name}</h1>
        <p className="mt-3 text-lg">
          {t.kindIn(company.kind, place)}
        </p>
        <div className="mt-5">
          <h2 className="mb-1 font-semibold">{t.contact}</h2>
          <SupplierContact contact={company.contact} />
        </div>
        {isOwner && (
          <div className="mt-5">
            <EditContactForm contact={company.contact} />
          </div>
        )}
        {certifications.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-1 font-semibold">{t.certifications}</h2>
            <ul>
              {certifications.map((c) => (
                <li key={`${c.scheme}-${c.number}`}>
                  {reg.schemes[c.scheme]} {c.number}
                  {c.validUntil && <span className="text-muted">, {t.validUntil(c.validUntil)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {articles.length > 0 && (
        <section aria-labelledby="codes-title">
          <h2 id="codes-title" className="section-title mb-3">
            {t.codes}
          </h2>
          <div className="flex flex-wrap gap-2">
            {articles.map((a) => (
              <Link key={a.slug} href={href(`/m/${company.slug}/a/${a.slug}`)} className="rounded-control hover:underline">
                <Chip>
                  {a.code} · {t.productCount(a.garmentCount)}
                </Chip>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="products-title">
        <h2 id="products-title" className="section-title mb-5">
          {t.products}
        </h2>
        {garments.length > 0 ? (
          <GarmentGrid>
            {garments.map((g) => (
              <div key={g.productId} data-testid="mill-garment">
                <GarmentTile
                  tile={g}
                  href={href(`/p/${g.productId}`)}
                  tag={
                    <>
                      {g.kind && <ClaimTag kind={g.kind} />}
                      {g.claimStatus === 'verified' && <VerifiedInline />}
                    </>
                  }
                />
                {/* Below the tile link, not inside it: the owner can take a product back off its page. */}
                {isOwner && (
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <RowActionButton action={withdrawClaimAction.bind(null, g.claimId)} label={t.remove} confirmLabel={t.confirmRemove} />
                    <VerifyStep garment={g} t={t} href={href} />
                  </div>
                )}
              </div>
            ))}
          </GarmentGrid>
        ) : (
          <p className="text-muted">{t.none}</p>
        )}
      </section>

      {garments.some((g) => g.claimStatus === 'verified') && <VerifiedExplanation className="border-t border-line pt-6" />}
    </div>
  );
}
