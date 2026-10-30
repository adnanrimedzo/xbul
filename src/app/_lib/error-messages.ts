// One English sentence per DomainError code. action-result.test.ts fails when a thrown code has no entry.
const MESSAGES: Record<string, string> = {
  'article.code_invalid': 'Product code must be 1–40 characters.',
  'article.lead_time_invalid': 'Lead time must be a whole number of weeks from 0 to 52.',
  'article.not_found': 'That product code no longer exists.',
  'article.text_too_long': 'Weight and MOQ must be 60 characters or fewer, composition 120 and finish 80.',
  'auth.forbidden': "You don't have permission to do that.",
  'claim.already_verified_original': 'Another supplier is already verified as the original for this product.',
  'claim.not_found': 'That claim no longer exists.',
  'claim.note_too_long': 'Notes must be 280 characters or fewer.',
  'claim.only_original_verifiable': 'Only original claims can be verified.',
  'claims.batch_size_invalid': 'Add between 1 and 50 products at a time.',
  'company.already_registered': 'You have already registered a company.',
  'company.city_invalid': 'City must be 1–60 characters.',
  'company.contact_required': 'Add an email, phone or website so buyers can reach you.',
  'company.country_invalid': 'Country must be a two-letter code, such as TR.',
  'company.email_invalid': 'Enter a valid email address.',
  'company.kind_invalid': 'Choose fabric or garments.',
  'company.name_invalid': 'Company name must be 2–80 characters.',
  'company.phone_invalid': 'Enter a valid phone number.',
  'company.website_invalid': 'Enter a valid website address.',
  'product.brand_invalid': 'Brand must be 1–60 characters.',
  'product.name_invalid': 'Name must be 1–160 characters.',
  'product.not_found': 'That product no longer exists.',
  'product.url_invalid': 'Not a valid link.',
  'product.url_not_public': "We can't fetch private addresses.",
};

export const errorMessage = (code: string): string =>
  Object.hasOwn(MESSAGES, code) ? MESSAGES[code]! : 'Something went wrong. Please try again.';
