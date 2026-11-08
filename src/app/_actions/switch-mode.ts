'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { actionLang } from '@/i18n/action';
import { localePath } from '@/i18n/locales';
import { getContainer } from '@/server/container';
import { MODE_COOKIE, modeHome, type Mode } from '@/server/modes';
import { requireViewer } from '@/server/viewer';

export async function switchModeAction(mode: Mode): Promise<void> {
  const viewer = await requireViewer();
  if (viewer.modes.includes(mode)) {
    const { config } = await getContainer();
    (await cookies()).set(MODE_COOKIE, mode, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.baseUrl.startsWith('https:'),
      path: '/',
      maxAge: 31_536_000,
    });
  }
  redirect(localePath(await actionLang(), modeHome(mode, viewer.company?.slug ?? null)));
}
