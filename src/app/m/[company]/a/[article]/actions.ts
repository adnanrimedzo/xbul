'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { editArticleSpecs } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireViewer } from '@/server/viewer';

const GENERIC = 'Check the lead time and try again.';
// The form posts every field, so a blank lead time clears it, as a blank text field does. Lengths and the whole-number
// range are the domain's (they have messages).
const number = z.preprocess((v) => (v === '' ? null : v), z.coerce.number().nullable().optional());

const formSchema = z.object({
  articleId: z.uuid(),
  weight: z.string().trim().optional(),
  composition: z.string().trim().optional(),
  finish: z.string().trim().optional(),
  moq: z.string().trim().optional(),
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
