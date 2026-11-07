export type UploadType = 'application/pdf' | 'image/jpeg' | 'image/png';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const FILE_NAME_MAX = 120;

const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((b, i) => bytes[i] === b);

// The type comes from the file's own first bytes. Neither its name nor the type the browser claimed is trusted.
export function sniffFileType(bytes: Uint8Array): UploadType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  return null;
}

// The extensions each type may carry; the first is the one added to a name that has none of them.
const EXTENSIONS: Record<UploadType, { canonical: string; ending: RegExp }> = {
  'application/pdf': { canonical: 'pdf', ending: /\.pdf$/i },
  'image/png': { canonical: 'png', ending: /\.png$/i },
  'image/jpeg': { canonical: 'jpg', ending: /\.jpe?g$/i },
};

// What the uploader called the file, for display and as the name it downloads under; it never reaches a path. Only the
// last path part is kept, without control or direction-override characters (a right-to-left override, U+202E, can
// reorder a name so that ".exe" reads as ".pdf"). The operating system picks the program that opens a saved file from
// its extension, and the type check reads only the first bytes, so a name always ends in an extension of the type found
// in the bytes: one it has already is kept, otherwise it is added (`invoice.hta` becomes `invoice.hta.pdf`).
// The length limit cuts the name before the extension, never the extension.
export function safeFileName(raw: string, type: UploadType): string {
  const name = raw.slice(Math.max(raw.lastIndexOf('/'), raw.lastIndexOf('\\')) + 1).replace(/[\p{Cc}\p{Cf}]/gu, '').trim() || 'evidence';
  const { canonical, ending } = EXTENSIONS[type];
  const kept = ending.exec(name)?.[0];
  const extension = kept ?? `.${canonical}`;
  const stem = kept ? name.slice(0, -kept.length) : name;
  return Array.from(stem).slice(0, FILE_NAME_MAX - extension.length).join('') + extension;
}
