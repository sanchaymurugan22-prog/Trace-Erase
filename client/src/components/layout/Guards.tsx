import { useEffect } from 'react';
import { useNavigate, useRouter, type RouteComponent } from '@/lib/router';
import { useSession } from '@/lib/session';
import { LogoMark, Spinner } from '@/components/ui';

export function FullScreenLoader() {
  return (
    <div className="dots flex min-h-screen flex-col items-center justify-center gap-5 bg-navy">
      <LogoMark size={64} /><Spinner className="text-accent-b" />
    </div>
  );
}

/** Only for signed-in, verified users. Others go to log in. */
export function requireUser(C: RouteComponent): RouteComponent {
  return function Guarded(props) {
    const { loading, user } = useSession();
    const navigate = useNavigate();
    const { path } = useRouter();
    useEffect(() => {
      if (loading) return;
      if (!user) navigate('/login?next=' + encodeURIComponent(path), { replace: true });
      else if (!user.verified) navigate(user.authProvider && user.authProvider !== 'code' ? '/signup/check-email' : '/signup', { replace: true });
    }, [loading, user, navigate, path]);
    if (loading || !user?.verified) return <FullScreenLoader />;
    return <C {...props} />;
  };
}

/** Only for regulator accounts. Others go to the regulator log-in. */
export function requireRegulator(C: RouteComponent): RouteComponent {
  return function Guarded(props) {
    const { loading, staff } = useSession();
    const navigate = useNavigate();
    useEffect(() => { if (!loading && !staff) navigate('/regulator/login', { replace: true }); }, [loading, staff, navigate]);
    if (loading || !staff) return <FullScreenLoader />;
    return <C {...props} />;
  };
}
