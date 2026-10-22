import { useT } from '@/i18n/I18nProvider';
import { ButtonLink, CardLink, DarkPanel, Icon, Tile } from '@/components/ui';

export function Audiences() {
  const t = useT();
  return (
    <section className="px-10 py-28 max-[820px]:px-4 max-[820px]:py-16">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10">
        <h2 className="text-center text-4xl font-extrabold tracking-tight">{t('Built for people. Fair to companies.')}</h2>
        <div className="grid grid-cols-2 gap-6 max-[820px]:grid-cols-1">
          <CardLink to="/signup" className="p-8">
            <Tile icon="user" size="lg" /><h3 className="text-xl font-bold">{t('For people')}</h3>
            <p className="text-mute">{t('Find, delete and prove, for free. Your real email and number stay private.')}</p>
            <span className="flex items-center gap-1.5 font-semibold text-brand">{t('Get started')}<Icon name="ar" size="sm" /></span>
          </CardLink>
          <CardLink to="/scores" className="p-8">
            <Tile icon="building" tone="accent" size="lg" /><h3 className="text-xl font-bold">{t('For companies')}</h3>
            <p className="text-mute">{t('Nothing to install. Answer requests by email on time, and your public score shows it.')}</p>
            <span className="flex items-center gap-1.5 font-semibold text-accent">{t('See the public scores')}<Icon name="ar" size="sm" /></span>
          </CardLink>
        </div>
        <DarkPanel className="items-center gap-5 p-14 text-center max-[820px]:p-8">
          <h2 className="text-5xl font-extrabold tracking-tight text-white max-[820px]:text-3xl">{t('Take back your data today.')}</h2>
          <p className="text-lg text-onm">{t('Takes 3 minutes. No company has to sign up first.')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink to="/signup" size="lg">{t('Create your free account')}</ButtonLink>
            <ButtonLink to="/scores" size="lg" variant="outline">{t('See company scores')}</ButtonLink>
          </div>
        </DarkPanel>
      </div>
    </section>
  );
}
