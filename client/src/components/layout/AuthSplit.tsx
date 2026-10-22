import { Link } from '@/lib/router';
import { Logo } from '@/components/ui';
import { LanguageMenu } from './LanguageMenu';

/** Two-column layout for sign-up and log-in: navy story on the left, form on the right. */
export function AuthSplit({ left, children }: { left: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen max-[820px]:flex-col">
      <aside className="dots relative flex flex-[0_0_44%] flex-col gap-8 overflow-hidden bg-navy px-14 py-10 text-on max-[1100px]:basis-[40%] max-[1100px]:p-8 max-[820px]:basis-auto">
        <Link to="/welcome" aria-label="TraceErase"><Logo /></Link>
        {left}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-card px-14 py-10 max-[1100px]:p-8">
        <div className="flex justify-end"><LanguageMenu showLabel /></div>
        <div className="m-auto flex w-full max-w-[440px] flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}
