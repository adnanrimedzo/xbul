import { defineMessages } from '@/i18n/locales';
import { pageMessages } from '@/i18n/server';
import type { CompanyContact } from '@/modules/supplier';

const CONTACT = defineMessages({ en: { label: 'Contact details' }, tr: { label: 'İletişim bilgileri' } });

const link = 'link font-mono text-sm';

// Contact details are public: a buyer reaches the supplier straight from the page, with no account and nothing relayed.
// Server only: every page that shows it is a Server Component.
export async function SupplierContact({ contact }: { contact: CompanyContact }) {
  const { email, phone, website } = contact;
  const { t } = await pageMessages(CONTACT);
  return (
    <ul data-testid="supplier-contact" aria-label={t.label} className="flex flex-wrap gap-x-4 gap-y-1.5">
      {email && (
        <li>
          <a href={`mailto:${encodeURIComponent(email).replace('%40', '@')}`} className={link}>
            {email}
          </a>
        </li>
      )}
      {phone && (
        <li>
          <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={link}>
            {phone}
          </a>
        </li>
      )}
      {website && (
        <li>
          <a href={website} target="_blank" rel="noopener nofollow ugc" className={link}>
            {new URL(website).hostname.replace(/^www\./, '')}
          </a>
        </li>
      )}
    </ul>
  );
}
