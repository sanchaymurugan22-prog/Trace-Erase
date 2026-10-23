import { Suspense } from 'react';
import { Routes } from '@/lib/router';
import { useI18n } from '@/i18n/I18nProvider';
import { FullScreenLoader } from '@/components/layout/Guards';
import { TranslatingOverlay } from '@/components/layout/TranslatingOverlay';
import { WakeBanner } from '@/components/layout/WakeBanner';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { ROUTES, NotFoundPage } from './routes';

export default function App() {
  const { ready } = useI18n();
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <ErrorBoundary><Routes routes={ROUTES} fallback={NotFoundPage} /></ErrorBoundary>
      {!ready && <TranslatingOverlay />}
      <WakeBanner />
    </Suspense>
  );
}
