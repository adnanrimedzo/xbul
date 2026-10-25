import type { Inquiry } from './inquiry';

export interface InquiryRepository {
  save(i: Inquiry): Promise<void>;
  findById(id: string): Promise<Inquiry | null>;
  countRecentFrom(companyId: string, buyerEmail: string, since: Date): Promise<number>;
  countNew(companyId: string): Promise<number>;
}
