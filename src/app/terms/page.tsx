import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms · xbul' };

const SECTIONS = [
  ['Who runs this site', 'This site is run by xbul. Contact: hello@xbul.io.'],
  ['What suppliers agree to', 'Suppliers are responsible for what they claim. You must have the right to share anything you upload, including documents that name your customers.'],
  ['What Verified means', 'Verified means an admin reviewed the supplier’s evidence for that product. It is not a guarantee of quality, price or delivery.'],
  ['Dealing with suppliers', 'Buyers and suppliers deal directly. xbul is not a party to their deals and is not responsible for them.'],
  ['Removing content', 'We can remove a claim or a supplier that is wrong or misleading.'],
];

export default function TermsPage() {
  return (
    <div className="page">
      <h1 className="page-title">Terms</h1>
      <div className="mt-8 flex max-w-[70ch] flex-col gap-6">
        {SECTIONS.map(([title, body]) => (
          <section key={title}>
            <h2 className="section-title">{title}</h2>
            <p className="mt-2">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
