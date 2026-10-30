import { getCloudflareContext } from '@opennextjs/cloudflare';
import { after } from 'next/server';
import { cache } from 'react';
import {
  createHttpProductPageFetcher,
  createProductRepository,
  createSearchLog,
  type ProductPageFetcher,
  type ProductRepository,
  type SearchLog,
} from '@/modules/catalog';
import {
  createClaimRepository,
  createEvidenceRepository,
  createLocalEvidenceStore,
  createR2EvidenceStore,
  type ClaimRepository,
  type EvidenceBucket,
  type EvidenceRepository,
  type EvidenceStore,
} from '@/modules/claims';
import { createAuth, type Auth } from '@/modules/identity';
import { createSupplierRepositories, type ArticleRepository, type CompanyRepository } from '@/modules/supplier';
import { createDb, createPostgresDb, type Db } from '@/shared/db/client';
import { createConsoleMailer, createResendMailer, type Mailer } from '@/shared/mail/mailer';
import { readConfig, resolveDatabaseUrl, type AppConfig } from './config';

export type Container = {
  config: AppConfig;
  db: Db;
  mailer: Mailer;
  auth: Auth;
  companies: CompanyRepository;
  articles: ArticleRepository;
  products: ProductRepository;
  fetcher: ProductPageFetcher;
  searches: SearchLog;
  claims: ClaimRepository;
  evidence: EvidenceRepository;
  evidenceStore: EvidenceStore;
};

declare global {
  interface CloudflareEnv {
    HYPERDRIVE?: { connectionString: string }; // the wrangler.jsonc binding
    EVIDENCE?: EvidenceBucket; // the private R2 bucket for supplier documents
  }
}

// Better Auth is built once per Db; config is fixed per process. On Workers the Db, and so auth, is per request,
// which is why its rate limiter keeps counts in the database.
const authByDb = new WeakMap<Db, Auth>();

// Outside Workers (next dev/start, scripts) there is no Cloudflare context and the sync call throws. The async
// call isn't used because under Node it would start a local wrangler proxy instead of failing.
function cloudflareContext() {
  try {
    return getCloudflareContext();
  } catch {
    return null;
  }
}

// One container per request (React cache). On Node the stateful pieces are shared: createDb memoises per
// URL/folder, and auth per Db. Workers can't share I/O across requests, so a Hyperdrive pool lives for one
// request and is closed once the response is done.
export const getContainer = cache(async (): Promise<Container> => {
  const config = readConfig();
  const cf = cloudflareContext();
  const url = resolveDatabaseUrl(config, cf);
  let db: Db;
  let evidenceStore: EvidenceStore;
  if (cf) {
    // No fallback on Workers: DATABASE_URL would open PGlite or a pool shared across requests.
    if (config.databaseUrl) throw new Error('DATABASE_URL must not be set on Workers; the database comes from the HYPERDRIVE binding');
    if (!url.startsWith('postgres')) throw new Error('Workers need the HYPERDRIVE binding with a Postgres connection string (see wrangler.jsonc)');
    // Likewise for documents (customers' invoices): there is no local-disk fallback on Workers.
    if (!cf.env.EVIDENCE) throw new Error('Workers need the EVIDENCE R2 binding for supplier documents (see wrangler.jsonc)');
    const { ctx } = cf;
    const postgres = createPostgresDb(url);
    after(() => ctx.waitUntil(postgres.pool.end()));
    db = postgres.db;
    evidenceStore = createR2EvidenceStore(cf.env.EVIDENCE);
  } else {
    db = await createDb(url);
    evidenceStore = createLocalEvidenceStore(config.evidenceDir);
  }
  const mailer = config.resendApiKey
    ? createResendMailer(config.resendApiKey, config.mailFrom)
    : createConsoleMailer(config.mailLogFile ?? undefined);
  let auth = authByDb.get(db);
  if (!auth) {
    // On Workers the limiter is forced on, so it never depends on Better Auth detecting production from the bundle.
    auth = createAuth({ db, mailer, baseUrl: config.baseUrl, secret: config.authSecret, rateLimit: cf ? true : undefined });
    authByDb.set(db, auth);
  }
  const { companies, articles } = createSupplierRepositories(db);
  return {
    config,
    db,
    mailer,
    auth,
    companies,
    articles,
    products: createProductRepository(db),
    fetcher: createHttpProductPageFetcher({ allowPrivateHosts: config.allowPrivateHosts }),
    searches: createSearchLog(db),
    claims: createClaimRepository(db),
    evidence: createEvidenceRepository(db),
    evidenceStore,
  };
});
