import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';

export type InquiryKind = 'swatch' | 'quote';

export type Inquiry = Readonly<{
  id: string;
  companyId: string;
  productId: string | null;
  articleId: string | null;
  kind: InquiryKind;
  buyerName: string;
  buyerEmail: string;
  buyerCompany: string | null;
  quantityMeters: number | null;
  message: string | null;
  viaAgentHandle: string | null;
  status: 'new' | 'answered';
  createdAt: Date;
}>;

export type InquiryInput = {
  companyId: string;
  productId: string | null;
  articleId: string | null;
  kind: InquiryKind;
  buyerName: string;
  buyerEmail: string;
  buyerCompany?: string | null;
  quantityMeters?: number | null;
  message?: string | null;
};

const NAME_MAX = 100;
const COMPANY_MAX = 120;
const MESSAGE_MAX = 2000;
const EMAIL_MAX = 254;
const QUANTITY_MAX = 1_000_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createInquiry(input: InquiryInput & { viaAgentHandle: string | null }, now: Date = new Date()): Inquiry {
  const buyerName = input.buyerName.trim();
  if (buyerName.length < 1 || buyerName.length > NAME_MAX) throw new DomainError('inquiry.name_invalid');
  const buyerEmail = input.buyerEmail.trim().toLowerCase();
  if (buyerEmail.length > EMAIL_MAX || !EMAIL.test(buyerEmail)) throw new DomainError('inquiry.email_invalid');
  const buyerCompany = input.buyerCompany?.trim() || null;
  if (buyerCompany && buyerCompany.length > COMPANY_MAX) throw new DomainError('inquiry.company_invalid');
  const quantityMeters = input.quantityMeters ?? null;
  if (quantityMeters !== null && !(Number.isInteger(quantityMeters) && quantityMeters >= 1 && quantityMeters <= QUANTITY_MAX)) {
    throw new DomainError('inquiry.quantity_invalid');
  }
  const message = input.message?.trim() || null;
  if (message && message.length > MESSAGE_MAX) throw new DomainError('inquiry.message_too_long');
  if (!input.productId && !input.articleId) throw new DomainError('inquiry.target_required');

  return Object.freeze({
    id: newId(),
    companyId: input.companyId,
    productId: input.productId,
    articleId: input.articleId,
    kind: input.kind,
    buyerName,
    buyerEmail,
    buyerCompany,
    quantityMeters,
    message,
    viaAgentHandle: input.viaAgentHandle,
    status: 'new',
    createdAt: now,
  });
}

export const markAnswered = (i: Inquiry): Inquiry => Object.freeze({ ...i, status: 'answered' });
