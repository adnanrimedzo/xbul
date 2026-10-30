import type { ClaimKind, ClaimScope, ClaimStatus, ReviewStatus } from '@/modules/claims';
import type { ArticleSpecs, CompanyContact, CompanyKind } from '@/modules/supplier';

export type CompanyRef = { id: string; slug: string; name: string; kind: CompanyKind; city: string; country: string; contact: CompanyContact };

export type ClaimView = {
  claimId: string;
  kind: ClaimKind;
  status: ClaimStatus;
  note: string | null;
  createdAt: Date;
  company: CompanyRef;
  article: { id: string; slug: string; code: string; specs: ArticleSpecs } | null;
};

// Each list is ranked: the verified original first, then declared originals, then equivalents (see rankClaims).
export type ClaimGroup = { originals: ClaimView[]; equivalents: ClaimView[] };

// Who made the fabric and who made the garment are separate lists, each with its own verified original.
export type ProductPageView = {
  product: { id: string; brand: string; name: string; imageUrl: string | null; composition: string | null; sourceUrl: string };
  fabric: ClaimGroup;
  garment: ClaimGroup;
};

export type GarmentTile = {
  productId: string;
  brand: string;
  name: string;
  imageUrl: string | null;
  sourceUrl: string;
  kind: ClaimKind | null;
  originals: number;
  equivalents: number;
};

export type ArticlePageView = {
  company: CompanyRef & { ownerUserId: string };
  article: { id: string; slug: string; code: string; specs: ArticleSpecs };
  garments: GarmentTile[];
};

export type CompanyPageView = {
  company: CompanyRef & { ownerUserId: string };
  articles: { slug: string; code: string; garmentCount: number }[];
  // The claimId is this mill's claim on the garment, with where its claim and its review stand.
  garments: (GarmentTile & { claimId: string; claimStatus: ClaimStatus; reviewStatus: ReviewStatus })[];
};

// An original waiting for an admin, with the documents the supplier sent in.
export type PendingReview = {
  claimId: string;
  scope: ClaimScope;
  product: { id: string; brand: string; name: string };
  company: { slug: string; name: string };
  evidence: { id: string; fileName: string; sizeBytes: number }[];
};

// How the platform stands against the launch targets of 20-30 suppliers, 200-300 products and 10-20 searching customers.
export type PlatformStats = { suppliers: number; taggedProducts: number; searches: number; matchedSearches: number; distinctSearchers: number };
