import { useT } from '@/i18n/I18nProvider';
import { Icon, type IconName } from '@/components/ui';

const STEPS: [IconName, string, string][] = [
  ['search', 'Find', 'AI reads who emailed you and which apps you signed into with Google, and lists every company that has your data.'],
  ['shield', 'Protect', 'Each app gets its own protected email, and you get one protected phone number. Your real ones stay hidden.'],
  ['trash', 'Delete', 'One request, signed with your fingerprint, goes to the company and every partner it names in its reply.'],
  ['shieldc', 'Prove', 'AI checks every reply, silence on the company-only address verifies it, and a tamper-proof ledger keeps the evidence.']
];

export function HowItWorks() {
  const t = useT();
  return (
    <section id="how" className="border-y border-line bg-card px-10 py-28 max-[820px]:px-4 max-[820px]:py-16">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs font-bold uppercase tracking-[.08em] text-brand">{t('How it works')}</span>
          <h2 className="text-5xl font-extrabold tracking-tight max-[820px]:text-4xl">{t('Find. Protect. Delete. Prove.')}</h2>
        </div>
        <div className="grid grid-cols-4 gap-6 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
          {STEPS.map(([icon, h, p], i) => (
            <div key={h} className="flex flex-col gap-3">
              <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-line bg-card text-brand shadow-card"><Icon name={icon} size="lg" /></span>
              <span className="text-[13px] font-bold text-brand">0{i + 1}</span>
              <h3 className="text-xl font-bold">{t(h)}</h3>
              <p className="text-mute">{t(p)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
