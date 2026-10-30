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
    <div className="px-5 pt-7 pb-10">
      <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Terms</h1>
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
