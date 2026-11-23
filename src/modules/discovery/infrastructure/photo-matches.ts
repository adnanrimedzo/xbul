import { and, asc, cosineDistance, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { rankMatches, supplierPhotos, type BuyerQuery, type MatchCandidate, type MatchLabel, type PhotoTags, type Reason } from '@/modules/photos';
import { articles, companies, type CompanyKind } from '@/modules/supplier';
import type { FabricSpec } from '@/shared/domain/taxonomy';
import type { CompanyRef } from './types';

export type PhotoMatchView = {
  photoId: string | null;
  label: MatchLabel;
  similarity: number | null;
  agree: readonly Reason[];
  tags: PhotoTags | null;
  article: { slug: string; code: string } | null;
};
export type PhotoResultsView = { company: CompanyRef; matches: PhotoMatchView[] }[];

const VISUAL_CANDIDATES = 100;
const SPEC_CANDIDATES = 200;

// Buyer photo search: the nearest published supplier photos of approved companies (exact cosine scan, same embedding
// model only), plus for fabric close-ups the approved companies' articles whose fabric spec may match on its own.
// Ranking and grouping are rankMatches; this only gathers the candidates and the details to show.
export async function findPhotoMatches(db: Db, input: { embedding: readonly number[]; embeddingModel: string; query: BuyerQuery }): Promise<PhotoResultsView> {
  const distance = cosineDistance(supplierPhotos.imageEmbedding, [...input.embedding]);
  const visual = await db
    .select({ photoId: supplierPhotos.id, companyId: supplierPhotos.companyId, articleId: supplierPhotos.articleId, tags: supplierPhotos.tags, distance, spec: articles.fabric })
    .from(supplierPhotos)
    .innerJoin(companies, eq(companies.id, supplierPhotos.companyId))
    .leftJoin(articles, eq(articles.id, supplierPhotos.articleId))
    .where(and(eq(supplierPhotos.status, 'published'), eq(companies.status, 'approved'), eq(supplierPhotos.embeddingModel, input.embeddingModel)))
    .orderBy(distance, asc(supplierPhotos.id))
    .limit(VISUAL_CANDIDATES);

  const candidates: MatchCandidate[] = visual.map((r) => ({
    companyId: r.companyId, photoId: r.photoId, articleId: r.articleId, similarity: 1 - Number(r.distance), tags: r.tags, spec: r.spec,
  }));

  const a = input.query.attributes;
  if (input.query.category === 'fabric' && a.construction) {
    const specRows = await db
      .select({ articleId: articles.id, companyId: articles.companyId, spec: articles.fabric })
      .from(articles)
      .innerJoin(companies, eq(companies.id, articles.companyId))
      .where(and(
        eq(companies.status, 'approved'),
        isNotNull(articles.fabric),
        sql`${articles.fabric}->>'construction' = ${a.construction}`,
        a.pattern ? sql`${articles.fabric}->>'pattern' = ${a.pattern}` : undefined,
      ))
      .orderBy(desc(articles.createdAt))
      .limit(SPEC_CANDIDATES);
    for (const r of specRows) candidates.push({ companyId: r.companyId, photoId: null, articleId: r.articleId, similarity: null, tags: null, spec: r.spec as FabricSpec });
  }

  const ranked = rankMatches(candidates, input.query);
  if (ranked.length === 0) return [];

  const companyRows = await db.select().from(companies).where(inArray(companies.id, ranked.map((c) => c.companyId)));
  const articleIds = ranked.flatMap((c) => c.matches.map((m) => m.articleId)).filter((id): id is string => id !== null);
  const articleRows = articleIds.length
    ? await db.select({ id: articles.id, slug: articles.slug, code: articles.code }).from(articles).where(inArray(articles.id, articleIds))
    : [];
  const tagsByPhoto = new Map(visual.map((r) => [r.photoId, r.tags]));

  return ranked.flatMap(({ companyId, matches }) => {
    const c = companyRows.find((x) => x.id === companyId);
    if (!c) return [];
    return [{
      company: { id: c.id, slug: c.slug, name: c.name, kind: c.kind as CompanyKind, city: c.city, country: c.country, contact: { email: c.contactEmail, phone: c.contactPhone, website: c.website } },
      matches: matches.map((m) => {
        const art = articleRows.find((x) => x.id === m.articleId);
        return {
          photoId: m.photoId, label: m.label, similarity: m.similarity, agree: m.agree,
          tags: m.photoId ? (tagsByPhoto.get(m.photoId) ?? null) : null,
          article: art ? { slug: art.slug, code: art.code } : null,
        };
      }),
    }];
  });
}

// A supplier's published photos for its public page, newest first.
export async function listPublishedPhotos(db: Db, companyId: string): Promise<{ id: string; tags: PhotoTags }[]> {
  return db
    .select({ id: supplierPhotos.id, tags: supplierPhotos.tags })
    .from(supplierPhotos)
    .where(and(eq(supplierPhotos.companyId, companyId), eq(supplierPhotos.status, 'published')))
    .orderBy(desc(supplierPhotos.publishedAt), desc(supplierPhotos.id));
}

// The product codes a supplier can link a photo to.
export async function listArticleChoices(db: Db, companyId: string): Promise<{ id: string; code: string }[]> {
  return db.select({ id: articles.id, code: articles.code }).from(articles).where(eq(articles.companyId, companyId)).orderBy(asc(articles.code));
}
