import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter, Space_Grotesk } from 'next/font/google';
import { SiteFooter } from '@/app/_components/chrome/site-footer';
import { SiteHeader } from '@/app/_components/chrome/site-header';
import { THEME_SCRIPT } from '@/app/_components/chrome/theme-toggle';
import { LangProvider } from '@/i18n/client';
import { defineMessages, HTML_LANG, OG_LOCALE } from '@/i18n/locales';
import { pageLang } from '@/i18n/server';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { alternates } from '@/app/_lib/seo';
import '../globals.css';

// latin-ext carries Turkish ş, ğ, ı, İ.
const spaceGrotesk = Space_Grotesk({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], variable: '--font-space-grotesk' });
const inter = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-inter' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], variable: '--font-plex-mono' });

const META = defineMessages({
  en: {
    title: 'xbul.io: Find who made any clothing product',
    template: '%s · xbul.io',
    description:
      'Paste a product link from Zara, H&M, Mango or any brand and see the fabric mills and garment makers that made it or can make an equivalent. Contact them directly, free.',
  },
  tr: {
    title: 'xbul.io: Bir kıyafeti kimin ürettiğini bulun',
    template: '%s · xbul.io',
    description:
      'Zara, H&M, Mango ya da herhangi bir markanın ürün linkini yapıştırın; onu üreten veya muadilini üretebilen kumaş fabrikalarını ve konfeksiyon atölyelerini görün. Doğrudan ve ücretsiz iletişime geçin.',
  },
});

export async function generateMetadata(): Promise<Metadata> {
  const [{ config }, lang] = await Promise.all([getContainer(), pageLang()]);
  const m = META[lang];
  return {
    metadataBase: new URL(config.baseUrl), // the social image's address has to be absolute
    title: { default: m.title, template: m.template },
    description: m.description,
    applicationName: 'xbul.io',
    alternates: alternates(lang, '/'),
    openGraph: { siteName: 'xbul.io', type: 'website', locale: OG_LOCALE[lang], title: m.title, description: m.description },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description },
  };
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const [viewer, lang] = await Promise.all([getViewer(), pageLang()]);
  return (
    // The theme script sets data-theme before the first paint, so React must accept the attribute it finds.
    <html lang={HTML_LANG[lang]} className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-bg font-sans text-base leading-relaxed text-fg">
        {/* First in <body>, so it runs before anything paints. In <head> React re-creates it on every server-action refresh. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <LangProvider lang={lang}>
          <div className="frame flex min-h-dvh flex-col">
            <SiteHeader viewer={viewer} />
            <main className="band flex-1">{children}</main>
            <SiteFooter />
          </div>
        </LangProvider>
      </body>
    </html>
  );
}
