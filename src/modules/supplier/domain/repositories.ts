import type { Article } from './article';
import type { Company } from './company';
import type { CompanyDocument } from './company-document';
import type { Registration, ReviewEvent } from './registration';

export interface CompanyRepository {
  save(c: Company): Promise<void>;
  findById(id: string): Promise<Company | null>;
  findBySlug(slug: string): Promise<Company | null>;
  findByOwner(userId: string): Promise<Company | null>;
  slugExists(slug: string): Promise<boolean>;
}

export interface ArticleRepository {
  save(a: Article): Promise<void>;
  findById(id: string): Promise<Article | null>;
  findByCode(companyId: string, code: string): Promise<Article | null>;
  slugExists(companyId: string, slug: string): Promise<boolean>;
}

export interface RegistrationRepository {
  find(companyId: string): Promise<Registration | null>;
  save(r: Registration): Promise<void>;
  // True when another company in this country that is submitted, awaiting changes or approved uses the tax number.
  taxIdTaken(country: string, taxId: string, exceptCompanyId: string): Promise<boolean>;
}

export interface ReviewEventRepository {
  add(e: ReviewEvent): Promise<void>;
  listByCompany(companyId: string): Promise<ReviewEvent[]>; // oldest first
}

export interface CompanyDocumentRepository {
  save(d: CompanyDocument): Promise<void>;
  findById(id: string): Promise<CompanyDocument | null>;
  listByCompany(companyId: string): Promise<CompanyDocument[]>; // oldest first
  delete(id: string): Promise<void>;
  deleteByCompany(companyId: string): Promise<void>;
}
