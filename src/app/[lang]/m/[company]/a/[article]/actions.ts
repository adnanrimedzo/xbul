'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { actionLang } from '@/i18n/action';
import { errorMessage } from '@/app/_lib/error-messages';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { editArticleFabric, editArticleSpecs } from '@/modules/supplier';
import type { FabricSpecInput } from '@/shared/domain/taxonomy';
import { getContainer } from '@/server/container';
import { requireViewer } from '@/server/viewer';

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
  const { userId } = await requireViewer(); // never from the form; the use case checks the viewer owns the code's company
  const parsed = formSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: errorMessage('article.lead_time_check', await actionLang()) };
  const { articleId, ...specs } = parsed.data;

  const { articles, companies } = await getContainer();
  try {
    await editArticleSpecs({ articles, companies }, { userId, articleId, specs });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  revalidatePath('/m/[company]/a/[article]', 'page');
  return { ok: true, data: undefined };
}

// An empty construction clears the sheet. Blank fibre rows are skipped; everything else is the domain's to judge.
export async function editArticleFabricAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { userId } = await requireViewer();
  const articleId = z.uuid().safeParse(form.get('articleId'));
  if (!articleId.success) return { ok: false, error: errorMessage('generic', await actionLang()) };
  const str = (k: string) => String(form.get(k) ?? '');
  const input: FabricSpecInput | null = str('construction') === '' ? null : {
    construction: str('construction'),
    pattern: str('pattern'),
    twillRatio: str('twillRatio'),
    twillDirection: str('twillDirection'),
    fibres: [0, 1, 2, 3].map((i) => ({ code: str(`fibre${i}`), percent: str(`percent${i}`) })).filter((f) => f.code !== '' || f.percent.trim() !== ''),
    weight: str('weight'),
    weightUnit: str('weightUnit'),
    widthCm: str('widthCm'),
    dye: str('dye'),
    finishes: form.getAll('finishes').map(String),
  };

  const { articles, companies } = await getContainer();
  try {
    await editArticleFabric({ articles, companies }, { userId, articleId: articleId.data, input });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  revalidatePath('/m/[company]/a/[article]', 'page');
  return { ok: true, data: undefined };
}
