import { cache } from 'react';
import { createHttpProductPageFetcher, createProductRepository, type ProductPageFetcher, type ProductRepository } from '@/modules/catalog';
import { createClaimRepository, type ClaimRepository } from '@/modules/claims';
import { createAuth, createProfileRepository, createUserDirectory, type Auth, type ProfileRepository } from '@/modules/identity';
import { createInquiryRepository, type InquiryRepository } from '@/modules/inquiry';
import { createSupplierRepositories, type ArticleRepository, type CompanyRepository } from '@/modules/supplier';
import { createDb, type Db } from '@/shared/db/client';
import { createConsoleMailer, createResendMailer, type Mailer } from '@/shared/mail/mailer';
import { readConfig, type AppConfig } from './config';

export type Container = {
  config: AppConfig;
  db: Db;
  mailer: Mailer;
  auth: Auth;
  companies: CompanyRepository;
  articles: ArticleRepository;
  products: ProductRepository;
  fetcher: ProductPageFetcher;
  claims: ClaimRepository;
  inquiries: InquiryRepository;
  profiles: ProfileRepository;
  users: { getEmail(id: string): Promise<string | null> };
};

// Better Auth holds in-memory state (its rate limiter), so it is built once per Db; config is fixed per process.
const authByDb = new WeakMap<Db, Auth>();

// One container per request (React cache). The stateful pieces are shared: createDb memoises per URL/folder,
// and auth per Db.
export const getContainer = cache(async (): Promise<Container> => {
  const config = readConfig();
  const db = createDb(config.databaseUrl ?? './.data/dev');
  const mailer = config.resendApiKey
    ? createResendMailer(config.resendApiKey, config.mailFrom)
    : createConsoleMailer(config.mailLogFile ?? undefined);
  let auth = authByDb.get(db);
  if (!auth) {
    auth = createAuth({ db, mailer, baseUrl: config.baseUrl, secret: config.authSecret });
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
    claims: createClaimRepository(db),
    inquiries: createInquiryRepository(db),
    profiles: createProfileRepository(db),
    users: createUserDirectory(db),
  };
});
