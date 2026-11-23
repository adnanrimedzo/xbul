// Runs in the browser before upload: decodes the photo, scales it to at most MAX_EDGE on its long side and re-encodes it
// as JPEG. That keeps uploads small (phone photos over 10 MB still work), applies EXIF rotation, paints transparent PNGs
// on white instead of black, and drops every bit of metadata, GPS included, before anything leaves the device.
export const MAX_EDGE = 1024;
export const MIN_EDGE = 200;
export const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;

export type PrepareProblem = 'type' | 'too_large' | 'too_small' | 'unreadable';
export class PrepareError extends Error {
  constructor(readonly problem: PrepareProblem) {
    super(problem);
  }
}

const READABLE = /^image\/(jpeg|png|webp)$/;

export async function preparePhoto(file: File): Promise<Blob> {
  if (file.type && (!file.type.startsWith('image/') || file.type === 'image/svg+xml')) throw new PrepareError('type');
  if (file.size > MAX_ORIGINAL_BYTES) throw new PrepareError('too_large');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC on a browser that can't decode it lands here too: ask for a format every browser reads.
    throw new PrepareError(READABLE.test(file.type) ? 'unreadable' : 'type');
  }
  try {
    const { width, height } = bitmap;
    if (Math.min(width, height) < MIN_EDGE) throw new PrepareError('too_small');
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PrepareError('unreadable');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new PrepareError('unreadable');
    return blob;
  } finally {
    bitmap.close();
  }
}

// What a prepared photo goes up as. The name is fixed: the server never uses it.
export function photoForm(blob: Blob, fields: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set('photo', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}
