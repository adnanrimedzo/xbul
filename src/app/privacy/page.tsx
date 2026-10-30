import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy · xbul' };

const SECTIONS = [
  ['Who runs this site', 'This site is run by xbul. Contact: hello@xbul.ai.'],
  ['Your account', 'We keep your email address to send you sign-in links. When you sign in, your session records your IP address and browser, and that record can stay after you stop using the site. We also count sign-in attempts by IP address to limit abuse.'],
  ['Supplier details', 'A supplier’s company name, city, country and contact details are public, because buyers use them to get in touch. So are the products it tags and their specifications. The contact email starts as your sign-in email unless you change it.'],
  ['Documents you upload', 'Invoices and similar documents can be seen only by the supplier who uploaded them and by our admins. They are deleted when the claim is decided, withdrawn or changed, and in any case after 90 days.'],
  ['Searches', 'When you search, we count the search and whether it found a product. That count stores no IP address, only a hash that changes daily.'],
  ['Backups', 'Database backups are kept for 90 days. Uploaded documents are not in them, but their file names are.'],
  ['Service providers', 'We use Cloudflare for hosting and file storage, Neon for the database, Resend for email and GitHub to run backups. They process this data for us. Cloudflare’s logs can hold request details, such as IP addresses, for a short time. Product images load directly from brand sites, which can see your IP address.'],
  ['Your choices', 'To see, correct or delete your data, email hello@xbul.ai.'],
];

export default function PrivacyPage() {
  return (
    <div className="px-5 pt-7 pb-10">
      <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Privacy</h1>
      <div className="mt-6 flex max-w-[640px] flex-col gap-5 text-[12px]">
        {SECTIONS.map(([title, body]) => (
          <section key={title}>
            <h2 className="text-[16px] font-bold">{title}</h2>
            <p className="mt-1 normal-case">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
