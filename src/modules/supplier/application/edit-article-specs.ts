import { DomainError } from '@/shared/domain/errors';
import { withSpecs, type Article, type ArticleSpecs } from '../domain/article';
import type { ArticleRepository, CompanyRepository } from '../domain/repositories';

export async function editArticleSpecs(
  deps: { articles: ArticleRepository; companies: CompanyRepository },
  input: { userId: string; articleId: string; specs: Partial<ArticleSpecs> },
): Promise<Article> {
  const article = await deps.articles.findById(input.articleId);
  if (!article) throw new DomainError('article.not_found');
  const company = await deps.companies.findById(article.companyId);
  if (company?.ownerUserId !== input.userId) throw new DomainError('auth.forbidden');
  const updated = withSpecs(article, input.specs);
  await deps.articles.save(updated);
  return updated;
}
