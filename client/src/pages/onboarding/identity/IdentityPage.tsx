// Onboarding step 1: meet your protected identity (protected number + one email per app).
import { useNavigate } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Banner, Button, CompanyAvatar, DarkPanel, Icon, Tile, type IconName } from '@/components/ui';
import { cn } from '@/lib/format';

function Pill({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'ok' | 'bad' }) {
  return (
    <span className={cn('inline-flex h-9 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-2.5 text-[12.5px] font-semibold',
      tone === 'ok' ? 'bg-accent-b/16 text-accent-b' : tone === 'bad' ? 'bg-[#E5484D]/18 text-[#FF8A8F]' : 'bg-white/7 text-on')}>
      {children}
    </span>
  );
}

export default function IdentityPage() {
  const { user, flags, updateMe } = useSession();
  const navigate = useNavigate();
  const t = useT();
  const points: [IconName, 'brand' | 'accent', string, string][] = [
    ['mail', 'brand', 'A different email for every app', "If spam arrives on your Zomato address, you know Zomato's data leaked."],
    ['phone', 'brand', 'One protected phone number', 'Calls and SMS from apps you use ring through. Strangers are stopped.'],
    ['sparkle', 'accent', 'AI decides who gets through', 'Each address knows its allowed senders and learns from your choices.']
  ];
  const flows: { name: string; color: string; mid: string; end: string; icon: IconName; tone: 'ok' | 'bad' }[] = [
    { name: 'Zomato', color: 'k8', mid: 'Allowed sender', end: 'Your inbox', icon: 'inbox', tone: 'ok' },
    { name: 'PizzaPoint', color: 'k7', mid: 'Unknown sender', end: 'Blocked + flagged', icon: 'ban', tone: 'bad' }
  ];

  return (
    <div className="min-h-screen bg-bg">
      <OnboardingHeader step="identity" />
      <main className="mx-auto max-w-[1200px] px-10 py-14 max-[820px]:px-4">
        <div className="grid grid-cols-2 items-center gap-16 max-[1000px]:grid-cols-1">
          <div className="flex flex-col gap-6">
            <span className="text-xs font-bold uppercase tracking-[.08em] text-brand">{t('Your new shield')}</span>
            <h1 className="text-5xl font-extrabold tracking-tight max-[820px]:text-4xl">{t('Meet your protected identity.')}</h1>
            <p className="text-lg leading-[30px] text-mute">{t("From now on, give apps these instead of your real email and number. We forward what matters and stop what doesn't.")}</p>
            {points.map(([ic, tone, h, p]) => (
              <div key={h} className="flex items-start gap-4"><Tile icon={ic} tone={tone} /><span className="flex flex-col gap-0.5"><span className="text-[17px] font-bold">{t(h)}</span><span className="text-sm text-mute">{t(p)}</span></span></div>
            ))}
            <Banner tone="warn" icon="alert"><span className="text-sm">{t('Keep using your real number for banks, UPI and government services.')}</span></Banner>
            <Button size="lg" className="self-start" onClick={async () => { await updateMe({ onboarding: { identity: true } }); navigate('/onboarding/connect'); }}>{t('Continue')}<Icon name="ar" /></Button>
          </div>

          <DarkPanel className="gap-5 p-8 shadow-modal">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Icon name="shieldc" className="text-accent-b" /><span className="font-bold text-white" translate="no">{user?.name}</span></span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[13px] font-semibold">{t('Active')}</span>
            </div>
            <div className="flex flex-col gap-1"><span className="text-[13px] text-onm">{t('Protected number')}</span>{user?.protectedNumber ? <span className="font-mono text-[40px] font-bold leading-[48px] tracking-tight text-white max-[640px]:text-3xl" translate="no">{user.protectedNumber}</span> : <span className="text-[15px] text-onm">{t('Not available yet: phone protection needs a paid phone service. Your protected emails work now.')}</span>}</div>
            <div className="flex flex-col gap-1"><span className="text-[13px] text-onm">{t('Example email for Zomato')}</span><span className="font-mono text-xl text-accent-b" translate="no">zomato.xxxx@{flags.protectedDomain || 'te.mail'}</span></div>
            <hr className="h-px border-0 bg-white/10" />
            <span className="text-xs font-bold uppercase tracking-[.08em] text-onm">{t('How a message reaches you')}</span>
            <div className="grid grid-cols-[auto_14px_auto_14px_minmax(0,1fr)] items-center gap-x-2 gap-y-3">
              {flows.map(f => (
                <div key={f.name} className="contents">
                  <Pill><CompanyAvatar company={{ name: f.name, color: f.color }} size="sm" className="!size-6 !rounded-md !text-[11px]" /><span translate="no">{f.name}</span></Pill>
                  <Icon name="cr" size="sm" className="text-[#7F8DA8]" />
                  <Pill><Icon name="sparkle" size="sm" className="text-accent-b" />{t(f.mid)}</Pill>
                  <Icon name="cr" size="sm" className="text-[#7F8DA8]" />
                  <span className="min-w-0 justify-self-start"><Pill tone={f.tone}><Icon name={f.icon} size="sm" /><span className="truncate">{t(f.end)}</span></Pill></span>
                </div>
              ))}
            </div>
          </DarkPanel>
        </div>
      </main>
    </div>
  );
}
