export type { Inquiry, InquiryInput, InquiryKind } from './domain/inquiry';
export { createInquiry, markAnswered } from './domain/inquiry';
export type { InquiryRepository } from './domain/repositories';
export { submitInquiry } from './application/submit-inquiry';
export { countNewInquiries, markInquiryAnswered } from './application/manage-inquiries';
export { createInquiryRepository } from './infrastructure/drizzle-inquiry-repository';
export { inquiries } from './infrastructure/schema';
