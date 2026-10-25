import { createArticle, normalizeArticleCode, type Article } from '../domain/article';
import type { ArticleRepository } from '../domain/repositories';

export async function upsertArticle(
  deps: { articles: ArticleRepository },
  input: { companyId: string; code: string },
): Promise<Article> {
  const existing = await deps.articles.findByCode(input.companyId, normalizeArticleCode(input.code));
  if (existing) return existing;
  const article = createArticle(input);
  let slug = article.slug;
  for (let n = 2; await deps.articles.slugExists(article.companyId, slug); n++) slug = `${article.slug}-${n}`;
  const saved = Object.freeze({ ...article, slug });
  await deps.articles.save(saved);
  return saved;
}
