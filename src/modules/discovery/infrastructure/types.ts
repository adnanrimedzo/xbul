import type { ClaimKind, ClaimStatus } from '@/modules/claims';
import type { ArticleSpecs } from '@/modules/supplier';

export type CompanyRef = { id: string; slug: string; name: string; city: string; country: string };

export type ClaimView = {
  claimId: string;
  kind: ClaimKind;
  status: ClaimStatus;
  note: string | null;
  createdAt: Date;
  company: CompanyRef;
  article: { id: string; slug: string; code: string; specs: ArticleSpecs } | null;
};

export type ProductPageView = {
  product: { id: string; brand: string; name: string; imageUrl: string | null; composition: string | null; sourceUrl: string };
  originals: ClaimView[];
  equivalents: ClaimView[];
};

export type GarmentTile = {
  productId: string;
  brand: string;
  name: string;
  imageUrl: string | null;
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
  garments: GarmentTile[];
};

export type DeclaredOriginal = {
  claimId: string;
  createdAt: Date;
  product: { id: string; brand: string; name: string };
  company: { slug: string; name: string };
};

export type InquiryRow = {
  id: string;
  kind: 'swatch' | 'quote';
  status: 'new' | 'answered';
  buyerName: string;
  buyerEmail: string;
  buyerCompany: string | null;
  quantityMeters: number | null;
  message: string | null;
  viaAgentHandle: string | null;
  createdAt: Date;
  target: { href: string; label: string };
};
