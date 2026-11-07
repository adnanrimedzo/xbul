import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter, Space_Grotesk } from 'next/font/google';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { SiteFooter } from './_components/chrome/site-footer';
import { SiteHeader } from './_components/chrome/site-header';
import { THEME_SCRIPT } from './_components/chrome/theme-toggle';
import './globals.css';

// latin-ext carries Turkish ş, ğ, ı, İ.
const spaceGrotesk = Space_Grotesk({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], variable: '--font-space-grotesk' });
const inter = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-inter' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], variable: '--font-plex-mono' });

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getContainer();
  return {
    metadataBase: new URL(config.baseUrl), // the social image's address has to be absolute
    title: 'xbul.io: Who made this?',
    description: 'Find the supplier behind any product.',
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const viewer = await getViewer();
  return (
    // The theme script sets data-theme before the first paint, so React must accept the attribute it finds.
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-bg font-sans text-base leading-relaxed text-fg">
        {/* First in <body>, so it runs before anything paints. In <head> React re-creates it on every server-action refresh. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <div className="frame flex min-h-dvh flex-col">
          <SiteHeader viewer={viewer} />
          <main className="band flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
