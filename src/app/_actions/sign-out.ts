'use server';

import { localePath } from '@/i18n/locales';
import { actionLang } from '@/i18n/action';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getContainer } from '@/server/container';

export async function signOutAction(): Promise<void> {
  const { auth } = await getContainer();
  await auth.api.signOut({ headers: await headers() });
  redirect(localePath(await actionLang(), '/'));
}
