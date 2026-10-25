import { DomainError } from '@/shared/domain/errors';
import { markAnswered, type Inquiry } from '../domain/inquiry';
import type { InquiryRepository } from '../domain/repositories';

export async function markInquiryAnswered(
  deps: { inquiries: InquiryRepository },
  input: { companyId: string; inquiryId: string },
): Promise<Inquiry> {
  const inquiry = await deps.inquiries.findById(input.inquiryId);
  if (!inquiry) throw new DomainError('inquiry.not_found');
  if (inquiry.companyId !== input.companyId) throw new DomainError('auth.forbidden');
  const answered = markAnswered(inquiry);
  await deps.inquiries.save(answered);
  return answered;
}

export const countNewInquiries = (deps: { inquiries: InquiryRepository }, companyId: string): Promise<number> =>
  deps.inquiries.countNew(companyId);
