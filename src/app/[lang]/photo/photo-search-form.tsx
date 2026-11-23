'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { PHOTO } from '@/app/_components/photo/messages';
import { PhotoDropzone } from '@/app/_components/photo/photo-dropzone';
import { photoForm, PrepareError, preparePhoto } from '@/app/_components/photo/prepare-photo';
import { Button, LinkButton } from '@/app/_components/ui/button';
import { Chip } from '@/app/_components/ui/chip';
import { useMessages } from '@/i18n/client';
import type { GateReason } from '@/modules/photos';
import { addCloseUpAction, checkPhotoAction, type PhotoCheckAnswer } from './actions';
import { PHOTO_SEARCH } from './messages';

type State =
  | { step: 'idle' }
  | { step: 'preparing' | 'checking' }
  | { step: 'failed'; message: string; retry: Blob | null } // retry: the prepared photo, when sending it again may work
  | { step: 'rejected'; reason: GateReason | null }
  | { step: 'checked'; answer: PhotoCheckAnswer; closeUp: 'none' | 'open' | 'checking' | 'added' | { message: string } };

export function PhotoSearchForm() {
  const { t, href } = useMessages(PHOTO_SEARCH);
  const { t: p } = useMessages(PHOTO);
  const [state, setState] = useState<State>({ step: 'idle' });
  const [preview, setPreview] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const again = useRef<HTMLButtonElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  // After a rejection, focus goes to the way out, so keyboard and screen reader users land on it.
  useEffect(() => {
    if (state.step === 'rejected' || state.step === 'failed') again.current?.focus();
  }, [state.step]);

  const check = (blob: Blob) => {
    setState({ step: 'checking' });
    startTransition(async () => {
      const r = await checkPhotoAction(photoForm(blob)).catch(() => null);
      if (!r) return setState({ step: 'failed', message: p.prepare.unreadable, retry: blob }); // offline or the request failed
      if (!r.ok) return setState({ step: 'failed', message: r.error, retry: blob });
      if (r.data.decision === 'rejected') return setState({ step: 'rejected', reason: r.data.reason });
      setState({ step: 'checked', answer: r.data, closeUp: 'none' });
    });
  };

  const choose = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setState({ step: 'preparing' });
    try {
      const blob = await preparePhoto(file);
      setPreview(URL.createObjectURL(blob));
      check(blob);
    } catch (e) {
      setPreview(null);
      setState({ step: 'failed', message: e instanceof PrepareError ? p.prepare[e.problem] : p.prepare.unreadable, retry: null });
    }
  };

  const addCloseUp = async (files: File[], answer: PhotoCheckAnswer) => {
    const file = files[0];
    if (!file) return;
    setState({ step: 'checked', answer, closeUp: 'checking' });
    try {
      const blob = await preparePhoto(file);
      const r = await addCloseUpAction(answer.id, photoForm(blob)).catch(() => null);
      if (!r || !r.ok) return setState({ step: 'checked', answer, closeUp: { message: r?.ok === false ? r.error : p.prepare.unreadable } });
      if (r.data.decision === 'rejected') {
        const reason = r.data.reason ?? 'not_textile';
        return setState({ step: 'checked', answer, closeUp: { message: `${t.closeUpRejected} ${p.reasons[reason]}` } });
      }
      setState({ step: 'checked', answer: { ...answer, labels: r.data.labels }, closeUp: 'added' });
    } catch (e) {
      setState({ step: 'checked', answer, closeUp: { message: e instanceof PrepareError ? p.prepare[e.problem] : p.prepare.unreadable } });
    }
  };

  const reset = () => {
    setPreview(null);
    setState({ step: 'idle' });
  };

  const busy = state.step === 'preparing' || state.step === 'checking';
  const tryAnother = (
    <Button ref={again} variant="ghost" type="button" onClick={reset}>
      {t.tryAnother}
    </Button>
  );

  return (
    <div className="mt-10 w-full max-w-[680px] text-left">
      {state.step === 'idle' ? (
        <PhotoDropzone onFiles={choose} />
      ) : (
        <div className="panel flex flex-col gap-5 sm:flex-row" aria-busy={busy}>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for next/image to optimise
            <img src={preview} alt={t.yourPhoto} className="aspect-square w-full rounded-control border border-line object-cover sm:w-48" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* One live region for every step, so each change is announced. */}
            <div role="status" aria-live="polite" className="flex flex-col gap-3">
              {state.step === 'preparing' && <p>{t.preparing}</p>}
              {state.step === 'checking' && <p>{t.checking}</p>}
              {state.step === 'checked' && (
                <>
                  {state.answer.decision === 'unclear' && state.answer.reason && (
                    <p>
                      {p.reasons[state.answer.reason]} {p.tips[state.answer.reason]}
                    </p>
                  )}
                  {state.answer.labels.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm text-muted">{t.weSee}</p>
                      <ul className="flex flex-wrap gap-2" data-testid="photo-seen">
                        {state.answer.labels.map((l) => (
                          <li key={l}>
                            <Chip>{l}</Chip>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {state.closeUp === 'checking' && <p>{t.closeUpChecking}</p>}
                  {state.closeUp === 'added' && <p>{t.closeUpAdded}</p>}
                </>
              )}
            </div>
            {(state.step === 'rejected' || state.step === 'failed') && (
              <div role="alert" className="alert">
                {state.step === 'rejected' ? (
                  <p>
                    {p.reasons[state.reason ?? 'not_textile']} {p.tips[state.reason ?? 'not_textile']}
                  </p>
                ) : (
                  <p>{state.message}</p>
                )}
              </div>
            )}
            {state.step === 'checked' && typeof state.closeUp === 'object' && (
              <p role="alert" className="alert">
                {state.closeUp.message}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {state.step === 'checked' && (
                <LinkButton variant="cta" href={href(`/photo/${state.answer.id}`)}>
                  {state.answer.decision === 'unclear' ? t.searchAnyway : t.findSuppliers}
                </LinkButton>
              )}
              {state.step === 'failed' && state.retry && (
                <Button variant="cta" type="button" onClick={() => state.retry && check(state.retry)}>
                  {t.retry}
                </Button>
              )}
              {!busy && tryAnother}
            </div>
            {state.step === 'checked' && state.closeUp === 'none' && (
              <button type="button" className="link self-start text-left text-sm" onClick={() => setState({ ...state, closeUp: 'open' })}>
                {t.addCloseUp}
              </button>
            )}
          </div>
        </div>
      )}
      {state.step === 'checked' && (state.closeUp === 'open' || typeof state.closeUp === 'object') && (
        <section aria-label={t.closeUpTitle} className="mt-6">
          <PhotoDropzone onFiles={(files) => addCloseUp(files, state.answer)} />
        </section>
      )}
      <p className="mt-6 text-sm text-muted">{t.privacy}</p>
      <p className="mt-2 text-sm">
        <Link href={href('/')} className="link">
          {t.linkInstead}
        </Link>
      </p>
    </div>
  );
}
