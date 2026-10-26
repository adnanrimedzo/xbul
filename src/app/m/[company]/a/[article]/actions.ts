'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { editArticleSpecs } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireViewer } from '@/server/viewer';

const GENERIC = 'Check the numbers and try again.';
// A blank number field means "leave it as it is". Ranges and whole-number checks are the domain's (they have messages).
const number = z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().optional());

const formSchema = z.object({
  articleId: z.uuid(),
  weightOz: number,
  composition: z.string().trim().optional(),
  finish: z.string().trim().optional(),
  moqMeters: number,
  leadTimeWeeks: number,
});

export async function editArticleSpecsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { userId } = await requireViewer(); // never from the form; the use case checks the viewer owns the article's mill
  const parsed = formSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: GENERIC };
  const { articleId, ...specs } = parsed.data;

  const { articles, companies } = await getContainer();
  try {
    await editArticleSpecs({ articles, companies }, { userId, articleId, specs });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath('/m/[company]/a/[article]', 'page');
  return { ok: true, data: undefined };
}
