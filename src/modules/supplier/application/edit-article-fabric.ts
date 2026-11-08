import { DomainError } from '@/shared/domain/errors';
import type { FabricSpecInput } from '@/shared/domain/taxonomy';
import { withFabric, type Article } from '../domain/article';
import type { ArticleRepository, CompanyRepository } from '../domain/repositories';

export async function editArticleFabric(
  deps: { articles: ArticleRepository; companies: CompanyRepository },
  input: { userId: string; articleId: string; input: FabricSpecInput | null },
): Promise<Article> {
  const article = await deps.articles.findById(input.articleId);
  if (!article) throw new DomainError('article.not_found');
  const company = await deps.companies.findById(article.companyId);
  if (company?.ownerUserId !== input.userId) throw new DomainError('auth.forbidden');
  const updated = withFabric(article, input.input);
  await deps.articles.save(updated);
  return updated;
}
