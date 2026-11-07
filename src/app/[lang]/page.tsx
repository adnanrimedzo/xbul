import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/app/_components/ui/button';
import { ClaimTag } from '@/app/_components/ui/claim-tag';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { VerifiedExplanation } from '@/app/_components/ui/verified';
import { alternates, jsonLd } from '@/app/_lib/seo';
import { OG_LOCALE } from '@/i18n/locales';
import { pageLang, pageMessages } from '@/i18n/server';
import { listRecentlyTagged, type GarmentTile as Tile } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { BRANDS, brandSlug, TURKIYE_FACT } from './brands/brands';
import { FindGarmentForm } from './find-garment-form';
import { HeroScene } from './hero-scene';
import { HOME } from './home-messages';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await pageLang();
  const t = HOME[lang];
  return {
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: alternates(lang, '/'),
    openGraph: { title: t.metaTitle, description: t.metaDescription, locale: OG_LOCALE[lang], url: alternates(lang, '/').canonical as string },
  };
}

export default async function Home() {
  const [{ db, config }, viewer, { t, lang, href }] = await Promise.all([getContainer(), getViewer(), pageMessages(HOME)]);
  const tiles = await listRecentlyTagged(db, 9);
  // Counts joined by " · ", each only when there is one: "1 made it · 2 can make it", "2 can make it", or "Tagged" if neither.
  const tileTag = ({ originals, equivalents }: Tile) =>
    [originals > 0 && t.madeIt(originals), equivalents > 0 && t.canMakeIt(equivalents)].filter(Boolean).join(' · ') || t.tagged;

  const base = config.baseUrl;
  const structured = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${base}/#organization`,
      name: 'xbul.io',
      url: base,
      logo: `${base}/logos/xbul-app-icon.svg`,
      email: 'hello@xbul.io',
      description: HOME.en.metaDescription,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${base}/#website`,
      name: 'xbul.io',
      url: base,
      inLanguage: ['en', 'tr'],
      publisher: { '@id': `${base}/#organization` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: lang,
      mainEntity: t.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />

      <section id="find" className="flex scroll-mt-6 flex-col items-center px-5 pt-20 text-center sm:pt-28">
        <h1 className="font-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] font-medium tracking-[-0.06em]">{t.title}</h1>
        <p className="mt-5 max-w-[40ch] text-lg text-muted">{t.subtitle}</p>
        <FindGarmentForm />
        <HeroScene />
      </section>

      <section aria-labelledby="brands-title" className="band mt-16 py-14 sm:py-16">
        <div className="px-5 text-center sm:px-8">
          <p className="eyebrow">{t.brandsEyebrow}</p>
          <h2 id="brands-title" className="section-title mx-auto mt-3 max-w-[30ch]">{t.brandsTitle}</h2>
          <p className="mx-auto mt-3 max-w-[60ch] text-muted">{t.brandsBody}</p>
        </div>
        <div className="marquee mt-10">
          <ul className="marquee-track">
            {[...BRANDS, ...BRANDS].map((b, i) => (
              <li key={i} aria-hidden={i >= BRANDS.length || undefined}>
                <Link
                  href={href(`/brands/${brandSlug(b.name)}`)}
                  tabIndex={i >= BRANDS.length ? -1 : undefined}
                  className="block px-8 font-display text-3xl font-medium tracking-[-0.04em] whitespace-nowrap text-muted transition-colors duration-150 hover:text-fg"
                >
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-8 text-center">
          <Link href={href('/brands')} className="link text-sm">{t.allBrands}</Link>
        </p>
      </section>

      <section aria-labelledby="recent-title" className="band px-5 py-16 sm:px-8 sm:py-20">
        <SectionHead eyebrow={t.latest} id="recent-title" title={t.recent} />
        {tiles.length > 0 ? (
          <GarmentGrid>
            {tiles.map((tile) => (
              <GarmentTile key={tile.productId} tile={tile} href={href(`/p/${tile.productId}`)} tag={tileTag(tile)} />
            ))}
          </GarmentGrid>
        ) : (
          <p className="text-center text-muted">{t.noProducts}</p>
        )}
      </section>

      <section id="how-it-works" aria-labelledby="how-title" className="band scroll-mt-6 pt-16 sm:pt-20">
        <SectionHead eyebrow={t.process} id="how-title" title={t.how} />
        <ol className="grid border-t border-line md:grid-cols-3">
          {t.steps.map(([title, body], i) => (
            <li key={title} className="flex flex-col gap-10 border-line px-5 py-8 not-first:border-t sm:px-8 md:not-first:border-t-0 md:not-first:border-l">
              <span className="font-mono text-sm text-muted">0{i + 1}</span>
              <div>
                <h3 className="section-title">{title}</h3>
                <p className="mt-2 text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="audience-title" className="band pt-16 sm:pt-20">
        <SectionHead eyebrow={t.audienceEyebrow} id="audience-title" title={t.audienceTitle} />
        <ul className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {t.audiences.map(([title, body]) => (
            <li key={title} className="border-line px-5 py-8 not-first:border-t sm:px-8 sm:[&:nth-child(even)]:border-l lg:not-first:border-t-0 lg:not-first:border-l sm:[&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0">
              <h3 className="section-title">{title}</h3>
              <p className="mt-2 text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="turkiye-title" className="band grid lg:grid-cols-2">
        <div className="px-5 py-12 sm:px-8 sm:py-16">
          <p className="eyebrow">{t.turkiyeEyebrow}</p>
          <h2 id="turkiye-title" className="page-title mt-3">{t.turkiyeTitle}</h2>
          <p className="mt-4 text-lg text-muted">{t.turkiyeBody}</p>
          <figure className="mt-8 border-l-2 border-accent pl-4">
            <blockquote className="text-lg">{TURKIYE_FACT[lang]}</blockquote>
            <figcaption className="mt-2 text-sm text-muted">
              {t.source}:{' '}
              <a href={TURKIYE_FACT.source!.url} target="_blank" rel="noopener noreferrer" className="link">{TURKIYE_FACT.source!.label}</a>
            </figcaption>
          </figure>
        </div>
        <dl className="grid content-start border-t border-line bg-surface sm:grid-cols-2 lg:border-t-0 lg:border-l">
          {t.hubs.map(([city, what]) => (
            <div key={city} className="border-b border-line px-5 py-6 sm:px-8 sm:odd:border-r">
              <dt className="font-display text-xl font-medium tracking-[-0.02em]">{city}</dt>
              <dd className="mt-1 text-sm text-muted">{what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="for-suppliers" className="band grid scroll-mt-6 lg:grid-cols-2">
        <div className="flex flex-col items-start justify-between gap-10 px-5 py-12 sm:px-8 sm:py-16">
          <div>
            <p className="eyebrow">{t.makers}</p>
            <h2 className="page-title mt-3">{t.makersTitle}</h2>
            <p className="mt-4 text-lg text-muted">{t.makersBody}</p>
          </div>
          <LinkButton variant="cta" href={href(viewer?.company ? '/add' : '/sign-in')}>
            {viewer?.company ? t.addProducts : t.createPage}
          </LinkButton>
        </div>
        <div className="flex flex-col justify-between gap-10 border-t border-line bg-surface px-5 py-12 sm:px-8 sm:py-16 lg:border-t-0 lg:border-l">
          <VerifiedExplanation />
          <div>
            <h2 className="section-title">{t.tagsMean}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <ClaimTag kind="original" />
              <ClaimTag kind="equivalent" />
            </div>
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="band scroll-mt-6 px-5 py-16 sm:px-8 sm:py-20">
        <SectionHead eyebrow={t.faqEyebrow} id="faq-title" title={t.faqTitle} />
        <div className="mx-auto max-w-[760px] border-t border-line">
          {t.faq.map(([q, a]) => (
            <details key={q} className="group border-b border-line">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 font-medium [&::-webkit-details-marker]:hidden">
                <h3>{q}</h3>
                <span aria-hidden="true" className="font-mono text-xl text-muted transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <p className="pb-6 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="band flex flex-col items-center px-5 py-16 text-center sm:py-20">
        <h2 className="page-title">{t.ctaTitle}</h2>
        <p className="mt-3 text-lg text-muted">{t.ctaBody}</p>
        <LinkButton variant="cta" href="#find" className="mt-8">{t.ctaButton}</LinkButton>
      </section>
    </>
  );
}

function SectionHead({ eyebrow, id, title }: { eyebrow: string; id: string; title: string }) {
  return (
    <div className="mb-10 flex flex-col items-center px-5 text-center sm:mb-12">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="page-title mt-3">
        {title}
      </h2>
    </div>
  );
}
