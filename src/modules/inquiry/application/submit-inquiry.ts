import type { Mailer } from '@/shared/mail/mailer';
import { DomainError } from '@/shared/domain/errors';
import { createInquiry, type Inquiry, type InquiryInput } from '../domain/inquiry';
import type { InquiryRepository } from '../domain/repositories';

const HANDLE = /^[a-z0-9-]{3,40}$/;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const ownerEmailBody = (i: Inquiry, baseUrl: string): string =>
  [
    `Name: ${i.buyerName}`,
    `Email: ${i.buyerEmail}`,
    i.buyerCompany && `Company: ${i.buyerCompany}`,
    i.quantityMeters !== null && `Quantity: ${i.quantityMeters} m`,
    i.message && `Message: ${i.message}`,
    i.viaAgentHandle && `Via agent: @${i.viaAgentHandle}`,
    '',
    `Open your requests: ${baseUrl}/requests`,
  ]
    .filter((line): line is string => line !== false && line !== null)
    .join('\n');

export async function submitInquiry(
  deps: {
    inquiries: InquiryRepository;
    mailer: Mailer;
    agentHandleExists: (h: string) => Promise<boolean>;
    companyOwnerEmail: (companyId: string) => Promise<string | null>;
    baseUrl: string;
    now?: () => Date;
  },
  input: InquiryInput & { viaAgentHandle?: string | null },
): Promise<Inquiry> {
  const now = (deps.now ?? (() => new Date()))();
  // The format check comes first so a malformed value never reaches the lookup.
  const handle = input.viaAgentHandle;
  const viaAgentHandle = handle && HANDLE.test(handle) && (await deps.agentHandleExists(handle)) ? handle : null;

  const inquiry = createInquiry({ ...input, viaAgentHandle }, now);
  // ponytail: count-then-insert is not atomic, so concurrent requests can overshoot the limit slightly.
  const recent = await deps.inquiries.countRecentFrom(inquiry.companyId, inquiry.buyerEmail, new Date(now.getTime() - RATE_WINDOW_MS));
  if (recent >= RATE_LIMIT) throw new DomainError('inquiry.rate_limited');
  await deps.inquiries.save(inquiry);

  // The saved inquiry is the durable record; the email is only a notification, so a failure here must not fail the submit.
  try {
    const ownerEmail = await deps.companyOwnerEmail(inquiry.companyId);
    if (ownerEmail) {
      await deps.mailer.send({
        to: ownerEmail,
        subject: `New ${inquiry.kind} request from ${inquiry.buyerCompany ?? inquiry.buyerName}`,
        text: ownerEmailBody(inquiry, deps.baseUrl),
        replyTo: inquiry.buyerEmail,
      });
    }
  } catch (e) {
    console.error(`[inquiry] owner notification failed for ${inquiry.id}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return inquiry;
}
