import type { Article } from './article';
import type { Company } from './company';

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
