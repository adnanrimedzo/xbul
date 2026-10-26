import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { countNewInquiries } from '@/modules/inquiry';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { SiteFooter } from './_components/chrome/site-footer';
import { SiteHeader } from './_components/chrome/site-header';
import { SiteNav } from './_components/chrome/site-nav';
import { Ticker } from './_components/chrome/ticker';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'], // latin-ext carries Turkish ş, ğ, ı
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'xmanufacture',
  description: 'Find the mill behind any garment.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const viewer = await getViewer();
  const newRequests = viewer?.company ? await countNewInquiries(await getContainer(), viewer.company.id) : 0;
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-paper text-[13px] leading-[normal] tracking-[0.01em] text-ink uppercase">
        <Ticker />
        <SiteHeader />
        <SiteNav viewer={viewer} newRequests={newRequests} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
