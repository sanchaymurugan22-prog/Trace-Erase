// Screen 2: Language. Picking a language switches the whole app to it immediately.
import { useNavigate } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useI18n } from '@/i18n/I18nProvider';
import { LANGUAGES } from '@/i18n/languages';
import { Button, Icon, Logo, Spinner } from '@/components/ui';
import { cn } from '@/lib/format';

const GLYPHS = ['A', 'अ', 'அ', 'అ', 'ಅ', 'അ', 'অ', 'અ'];

export default function LanguageScreen() {
  const { lang, t, ready } = useI18n();
  const { user, setLanguage } = useSession();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen max-[820px]:flex-col">
      <aside className="dots relative flex flex-[0_0_42%] flex-col gap-8 overflow-hidden bg-navy px-14 py-10 text-on max-[1100px]:p-8 max-[820px]:basis-auto">
        <Logo />
        <div className="mt-auto flex flex-col gap-4">
          <h1 className="text-5xl font-extrabold leading-[1.15] tracking-tight text-white max-[820px]:text-3xl">{t('Your privacy, in your language.')}</h1>
          <p className="max-w-md text-lg leading-8 text-onm">{t('Every screen, every AI explanation and every legal request is shown in the language you pick.')}</p>
        </div>
        <div className="grid w-fit grid-cols-4 gap-3" aria-hidden="true" translate="no">
          {GLYPHS.map((g, i) => (
            <span key={i} className={cn('flex size-20 items-center justify-center rounded-[18px] border border-white/8 font-display text-[34px] font-semibold',
              i === 0 || i === 5 ? 'bg-accent-b/15 text-accent-b' : 'bg-white/6 text-on')}>{g}</span>
          ))}
        </div>
        <span className="mt-auto text-[13px] text-onm">{t('You can change this anytime with the globe button.')}</span>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-card px-14 py-10 max-[1100px]:p-8">
        <div className="m-auto flex w-full max-w-[680px] flex-col gap-7">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Step 1 of 2')}</span>
            <h2 className="text-4xl font-extrabold tracking-tight">{t('Choose your language')}</h2>
            <p className="text-mute">{t('Tap a language. The whole app changes to it right away.')}</p>
          </div>
          <div role="radiogroup" aria-label={t('Language')} className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-2">
            {LANGUAGES.map(l => (
              <button key={l.code} role="radio" aria-checked={lang === l.code} onClick={() => setLanguage(l.code)} translate="no"
                className={cn('flex items-center gap-3.5 rounded-2xl border-[1.5px] bg-card px-[18px] py-4 text-left transition',
                  lang === l.code ? 'border-brand bg-brand-s/60 ring-[3px] ring-brand/12' : 'border-line hover:border-line2')}>
                <span className={cn('size-5 flex-none rounded-full border-[1.5px]', lang === l.code ? 'border-[6px] border-brand' : 'border-line2')} />
                <span className="flex flex-col">
                  <span className="font-display text-lg font-bold leading-[26px] text-ink">{l.native}</span>
                  <span className="text-[13px] text-mute">{l.english}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-[13px] text-mute">
              {ready ? <Icon name="check" size="sm" className="text-ok" /> : <Spinner />}
              {t('Screens and legal letters will be in this language')}
            </span>
            <Button size="lg" onClick={() => navigate(user?.verified ? '/app' : '/welcome')}>{t('Continue')}<Icon name="ar" /></Button>
          </div>
        </div>
      </main>
    </div>
  );
}
