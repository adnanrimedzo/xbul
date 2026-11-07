export type { Company, CompanyContact, CompanyKind, CompanyStatus, ContactInput } from './domain/company';
export { claimScopeOf, createCompany, normalizeContact } from './domain/company';
export type {
  CertificationScheme, DocumentKind, EmployeeBand, Registration, RegistrationInput, ReviewAction, ReviewEvent,
} from './domain/registration';
export {
  approveCompany, assertOwnerCanEdit, diffRegistration, missingForSubmit, normalizeRegistration, rejectCompany,
  requestCompanyChanges, requiredDocuments, submitCompany,
} from './domain/registration';
export type { Article, ArticleSpecs } from './domain/article';
export { createArticle, normalizeArticleCode, withSpecs } from './domain/article';
export type { ArticleRepository, CompanyRepository, RegistrationRepository, ReviewEventRepository } from './domain/repositories';
export { registerCompany } from './application/register-company';
export { updateCompanyContact } from './application/update-company-contact';
export { upsertArticle } from './application/upsert-article';
export { editArticleSpecs } from './application/edit-article-specs';
export { createSupplierRepositories } from './infrastructure/drizzle-repositories';
export { articles, companies, companyRegistrations, companyReviewEvents } from './infrastructure/schema';
