export { COMPANY_KINDS } from './domain/company';
export type { Company, CompanyContact, CompanyKind, CompanyStatus, ContactInput } from './domain/company';
export { claimScopeOf, createCompany, normalizeContact } from './domain/company';
export type {
  CertificationScheme, DocumentKind, EmployeeBand, Registration, RegistrationInput, ReviewAction, ReviewEvent,
} from './domain/registration';
export {
  approveCompany, assertOwnerCanEdit, diffRegistration, editedEvent, missingForSubmit, normalizeRegistration, rejectCompany,
  requestCompanyChanges, requiredDocuments, submitCompany,
} from './domain/registration';
export { taxIdLabel } from './domain/legal-identifiers';
export type { Article, ArticleSpecs } from './domain/article';
export { createArticle, normalizeArticleCode, withFabric, withSpecs } from './domain/article';
export type { CompanyDocument } from './domain/company-document';
export { createCompanyDocument, MAX_COMPANY_DOCUMENTS } from './domain/company-document';
export type { ArticleRepository, CheckRepository, CompanyDocumentRepository, CompanyRepository, RegistrationRepository, ReviewEventRepository } from './domain/repositories';
export type { DocumentDeps, DocumentStore, RegistryChecker } from './application/ports';
export { addCompanyDocument, purgeCompanyDocuments, readCompanyDocument, removeCompanyDocument } from './application/company-documents';
export { registerCompany } from './application/register-company';
export type { ReviewDeps } from './application/review-registration';
export { approveRegistration, editRegistrationAsAdmin, rejectRegistration, requestRegistrationChanges } from './application/review-registration';
export { saveRegistration, submitRegistration } from './application/registration';
export { updateCompanyContact } from './application/update-company-contact';
export { upsertArticle } from './application/upsert-article';
export { editArticleFabric } from './application/edit-article-fabric';
export { editArticleSpecs } from './application/edit-article-specs';
export { createSupplierRepositories } from './infrastructure/drizzle-repositories';
export { articles, companies, companyChecks, companyDocuments, companyRegistrations, companyReviewEvents } from './infrastructure/schema';
export { createGleifChecker, createViesChecker } from './infrastructure/registry-checkers';
export { runRegistrationChecks } from './application/run-checks';
export type { CheckResult, CheckSource, CheckOutcome } from './domain/checks';
