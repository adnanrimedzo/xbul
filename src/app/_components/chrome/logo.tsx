import Image from 'next/image';

// The logo files have their colours baked in, so each theme shows its own copy. `fit` drops the .io on a phone, beside the nav.
export function Logo({ fit = false }: { fit?: boolean }) {
  const full = fit ? 'max-sm:hidden' : '';
  return (
    <>
      {(['ink', 'white'] as const).map((tone) => (
        <span key={tone} className={tone === 'ink' ? 'only-light' : 'only-dark'}>
          <Image src={`/logos/xbul-logo-${tone}.svg`} alt="" width={120} height={35} className={full} />
          {fit && <Image src={`/logos/xbul-logo-short-${tone}.svg`} alt="" width={80} height={35} className="sm:hidden" />}
        </span>
      ))}
    </>
  );
}
