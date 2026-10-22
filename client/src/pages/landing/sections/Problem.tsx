import { useT } from '@/i18n/I18nProvider';
import { Card, Tile, type IconName } from '@/components/ui';

const ITEMS: [IconName, 'part' | 'nr' | 'leak', string, string][] = [
  ['share', 'part', 'Copies stay with partners', 'Your request reaches the app, never the ad network or delivery partner it passed your number to.'],
  ['mailc', 'nr', '"Deleted" is just an email', 'There is no record you can check, show a court, or hold a company to.'],
  ['siren', 'leak', 'Leaks show up months later', 'Spam calls from companies you never signed up with, and no way to know who sold you out.']
];

export function Problem() {
  const t = useT();
  return (
    <section className="px-10 py-28 max-[820px]:px-4 max-[820px]:py-16">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12">
        <div className="flex max-w-[760px] flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-[.08em] text-brand">{t('The problem')}</span>
          <h2 className="text-5xl font-extrabold leading-[56px] tracking-tight max-[820px]:text-4xl">{t("Deleting your account doesn't delete your data.")}</h2>
          <p className="text-lg leading-[30px] text-mute">{t('Apps share your details with payment, delivery and advertising partners. When you leave, those copies stay behind, and nobody can show you otherwise.')}</p>
        </div>
        <div className="grid grid-cols-3 gap-6 max-[1100px]:grid-cols-1">
          {ITEMS.map(([icon, tone, h, p]) => (
            <Card key={h} className="gap-3.5 p-8"><Tile icon={icon} tone={tone} size="lg" /><h3 className="text-xl font-bold">{t(h)}</h3><p className="text-mute">{t(p)}</p></Card>
          ))}
        </div>
      </div>
    </section>
  );
}
