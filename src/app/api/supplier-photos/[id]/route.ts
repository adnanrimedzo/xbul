import { z } from 'zod';
import { readSupplierPhoto } from '@/modules/photos';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';

// A supplier's product photo. Public once published by an approved company (search results, the company page);
// before that only its owner and admins see it. Everything else gets the same empty 404, so an id confirms nothing.
const notFound = () => new Response(null, { status: 404 });

export async function GET(_request: Request, { params }: RouteContext<'/api/supplier-photos/[id]'>): Promise<Response> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  const { supplierPhotos, evidenceStore, companies } = await getContainer();
  const found = await readSupplierPhoto({ photos: supplierPhotos, store: evidenceStore }, id, async (photo) => {
    const company = await companies.findById(photo.companyId);
    if (!company) return null;
    // Public access is decided first, so most requests never look up a session.
    if (photo.status === 'published' && company.status === 'approved') return { public: true };
    const viewer = await getViewer();
    return viewer && (viewer.isAdmin || viewer.userId === company.ownerUserId) ? { public: false } : null;
  });
  if (!found) return notFound();
  return new Response(found.bytes as BodyInit, {
    headers: {
      'Content-Type': 'image/jpeg', // only JPEGs are ever stored (analysePhoto)
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      // Short, so an unpublished or deleted photo doesn't linger in browsers.
      'Cache-Control': found.public ? 'public, max-age=300' : 'private, no-store',
    },
  });
}
