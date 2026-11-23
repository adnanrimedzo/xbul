import { z } from 'zod';
import { findBuyerSearch } from '@/modules/photos';
import { getContainer } from '@/server/container';

// A buyer's own photo, for their results page. Whoever has the (unguessable) search id may see it for 7 days;
// any other id, an expired search or a rejected photo gets the same empty 404.
const notFound = () => new Response(null, { status: 404 });

export async function GET(_request: Request, { params }: RouteContext<'/api/photo-searches/[id]'>): Promise<Response> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  const { photoChecks, evidenceStore } = await getContainer();
  const search = await findBuyerSearch({ checks: photoChecks }, id);
  if (!search?.photoKey) return notFound();
  const bytes = await evidenceStore.get(search.photoKey);
  if (!bytes) return notFound();
  return new Response(bytes as BodyInit, {
    headers: {
      'Content-Type': 'image/jpeg', // only JPEGs are ever stored (analysePhoto)
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
