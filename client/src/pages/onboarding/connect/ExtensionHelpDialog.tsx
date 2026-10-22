// How to load the TraceErase browser extension in Chrome.
import { useT } from '@/i18n/I18nProvider';
import { ButtonLink, Modal } from '@/components/ui';

const STEPS = [
  'Open Chrome and go to chrome://extensions',
  'Turn on "Developer mode" (top right).',
  'Press "Load unpacked" and choose the "extension" folder inside your TraceErase folder.',
  'In TraceErase, open Settings → Browser extension and copy your extension token.',
  'Click the TraceErase icon in Chrome and paste the token. On any sign-up form, press "Fill protected details".'
];

export function ExtensionHelpDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Modal label={t('Install the browser extension')} onClose={onClose}>
      <h2 className="pr-8 text-2xl font-bold">{t('Install the browser extension')}</h2>
      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="inline-flex size-7 flex-none items-center justify-center rounded-full bg-brand-s text-[13px] font-bold text-brand">{i + 1}</span>
            <span className="pt-0.5 text-sm">{t(s)}</span>
          </li>
        ))}
      </ol>
      <ButtonLink to="/app/settings#extension" variant="secondary" className="self-start">{t('Open Settings')}</ButtonLink>
    </Modal>
  );
}
