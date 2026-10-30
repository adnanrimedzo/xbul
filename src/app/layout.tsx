import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { SiteFooter } from './_components/chrome/site-footer';
import { SiteHeader } from './_components/chrome/site-header';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin', 'latin-ext'], // latin-ext carries Turkish ş, ğ, ı, İ
  weight: ['400', '600', '700', '800'],
  variable: '--font-archivo',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
});

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
    <html lang="en" className={`${archivo.variable} ${plexMono.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-base leading-relaxed text-ink">
        <SiteHeader viewer={viewer} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
