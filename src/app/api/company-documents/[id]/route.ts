import { z } from 'zod';
import { attachmentDisposition } from '@/app/_lib/content-disposition';
import { readCompanyDocument } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';

// The only way to a registration document: the owning company and admins get the file, and everyone else gets the same
// empty 404 as for an id that doesn't exist, so a guessed id confirms nothing.
const notFound = () => new Response(null, { status: 404 });

export async function GET(_request: Request, { params }: RouteContext<'/api/company-documents/[id]'>): Promise<Response> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  const viewer = await getViewer();
  if (!viewer) return notFound();

  const { companies, documents, evidenceStore } = await getContainer();
  const found = await readCompanyDocument(
    { companies, documents, store: evidenceStore },
    { documentId: id, viewer: { userId: viewer.userId, isAdmin: viewer.isAdmin } },
  );
  if (!found) return notFound();

  // A Uint8Array is a valid body; the cast is only because TypeScript widens its buffer to ArrayBufferLike.
  return new Response(found.bytes as BodyInit, {
    headers: {
      'Content-Type': found.document.contentType,
      'Content-Disposition': attachmentDisposition(found.document.fileName), // a download, never shown inside the site
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
