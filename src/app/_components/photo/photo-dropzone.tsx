'use client';

import { useEffect, useEffectEvent, useId, useRef, useState, type DragEvent } from 'react';
import { Button } from '@/app/_components/ui/button';
import { useMessages } from '@/i18n/client';
import { PHOTO } from './messages';

export function CameraIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== 'file'));

// A real file input behind a visible button, plus drag and drop onto the zone and paste anywhere on the page (except into
// a text field). The parent prepares and uploads; this only hands over the files and says why a drop had none.
export function PhotoDropzone({ onFiles, multiple = false, disabled = false }: { onFiles: (files: File[]) => void; multiple?: boolean; disabled?: boolean }) {
  const { t } = useMessages(PHOTO);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const depth = useRef(0); // dragenter/leave fire for every child, so count them instead of flickering
  const hintId = useId();
  const take = (files: File[]) => {
    // Non-images go through too, so the parent can say what's wrong with each instead of ignoring it.
    if (disabled || files.length === 0) return;
    setNotice(!multiple && files.length > 1 ? t.firstOnly : null);
    onFiles(multiple ? files : files.slice(0, 1));
  };

  // Reads the latest props without re-subscribing on every render.
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    if (isTextField(e.target)) return;
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) {
      e.preventDefault();
      take(files);
    } else if (/^https?:\/\//i.test(e.clipboardData?.getData('text') ?? '')) {
      setNotice(t.pasteLink);
    }
  });
  useEffect(() => {
    const listener = (e: ClipboardEvent) => onPaste(e);
    document.addEventListener('paste', listener);
    return () => document.removeEventListener('paste', listener);
  }, []);

  const drag = (e: DragEvent, delta: number) => {
    e.preventDefault();
    depth.current = Math.max(0, depth.current + delta);
    setOver(depth.current > 0);
  };

  return (
    <div
      data-testid="photo-dropzone"
      data-over={over || undefined}
      onDragEnter={(e) => drag(e, 1)}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => drag(e, -1)}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) take(files);
        else setNotice(t.noFile); // an image dragged out of another page arrives as a link, not a file
      }}
      className={`flex flex-col items-center gap-3 rounded-card border border-dashed px-6 py-12 text-center transition-colors duration-150 ${over ? 'border-fg bg-surface' : 'border-line'}`}
    >
      <span className="text-muted">
        <CameraIcon />
      </span>
      <p className="font-display text-xl">{over ? t.dropNow : multiple ? t.dropMany : t.drop}</p>
      <p className="text-sm text-muted">{t.orPaste}</p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        // The visible button opens it; hidden from assistive tech so there is one "Choose a photo", not two.
        aria-hidden="true"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(e) => {
          take([...(e.target.files ?? [])]);
          e.target.value = ''; // so choosing the same file again still fires
        }}
      />
      <Button variant="cta" type="button" disabled={disabled} onClick={() => input.current?.click()} aria-describedby={hintId}>
        {multiple ? t.chooseMany : t.choose}
      </Button>
      <p id={hintId} className="text-xs text-muted">
        {t.hint}
      </p>
      <p role="status" className="min-h-5 text-sm">
        {notice}
      </p>
    </div>
  );
}
