'use server';

import { z } from 'zod';
import { errorMessage } from '@/app/_lib/error-messages';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { resolveAgent } from '@/app/_lib/resolve-agent';
import { submitInquiry } from '@/modules/inquiry';
import { getContainer } from '@/server/container';

const GENERIC = 'Something went wrong. Please try again.';
const blankTo = (empty: null | undefined) => (v: unknown) => (v === '' ? empty : v);

// Lengths, email shape and the 1–1,000,000 range are the domain's (they have messages); this is the wire shape.
const formSchema = z.object({
  companyId: z.uuid(),
  productId: z.preprocess(blankTo(null), z.uuid().nullable().default(null)),
  articleId: z.preprocess(blankTo(null), z.uuid().nullable().default(null)),
  kind: z.enum(['swatch', 'quote']),
  buyerName: z.string().trim(),
  buyerEmail: z.string().trim(),
  buyerCompany: z.string().trim().optional(),
  quantityMeters: z.preprocess(blankTo(undefined), z.coerce.number().int().optional()),
  message: z.string().trim().optional(),
  via: z.string().trim().optional(),
});

export async function submitInquiryAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  // Real buyers never see the `website` field, so a filled one is a bot: pretend it worked and save nothing.
  if (form.get('website')) return { ok: true, data: undefined };

  const parsed = formSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const badQuantity = parsed.error.issues.some((i) => i.path[0] === 'quantityMeters');
    return { ok: false, error: badQuantity ? errorMessage('inquiry.quantity_invalid') : GENERIC };
  }
  const { via, ...input } = parsed.data;

  const { inquiries, mailer, claims, articles, companies, users, config } = await getContainer();
  // The ids are public form fields: only accept a product and an article that really belong to this company.
  const productOk = !input.productId || (await claims.findByProductAndCompany(input.productId, input.companyId)) !== null;
  const articleOk = !input.articleId || (await articles.findById(input.articleId))?.companyId === input.companyId;
  if (!productOk || !articleOk) return { ok: false, error: GENERIC };

  try {
    await submitInquiry(
      {
        inquiries,
        mailer,
        agentHandleExists: async (handle) => (await resolveAgent(handle)) !== null,
        companyOwnerEmail: async (companyId) => {
          const company = await companies.findById(companyId);
          return company ? users.getEmail(company.ownerUserId) : null;
        },
        baseUrl: config.baseUrl,
      },
      { ...input, quantityMeters: input.quantityMeters ?? null, viaAgentHandle: via || null },
    );
  } catch (e) {
    return toActionError(e);
  }
  return { ok: true, data: undefined };
}
