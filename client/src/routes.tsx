// Every screen of the app and its address. Each page lives in its own folder under src/pages.
// Pages are loaded on demand, so the first screen opens fast.
import { lazy } from 'react';
import type { RouteComponent } from '@/lib/router';
import { requireRegulator, requireUser } from '@/components/layout/Guards';

const page = (load: () => Promise<{ default: RouteComponent }>) => lazy(load) as unknown as RouteComponent;

// Public
const SplashScreen = page(() => import('@/pages/splash/SplashScreen'));
const LanguageScreen = page(() => import('@/pages/language/LanguageScreen'));
const LandingPage = page(() => import('@/pages/landing/LandingPage'));
const ScoresPage = page(() => import('@/pages/public/scores/ScoresPage'));
const VerifyReceiptPage = page(() => import('@/pages/public/verify-receipt/VerifyReceiptPage'));

// Sign up and log in
const SignupPage = page(() => import('@/pages/auth/signup/SignupPage'));
const VerifyCodesPage = page(() => import('@/pages/auth/verify-codes/VerifyCodesPage'));
const CheckEmailPage = page(() => import('@/pages/auth/check-email/CheckEmailPage'));
const PasskeySetupPage = page(() => import('@/pages/auth/passkey/PasskeySetupPage'));
const LoginPage = page(() => import('@/pages/auth/login/LoginPage'));
const RegulatorLoginPage = page(() => import('@/pages/auth/regulator-login/RegulatorLoginPage'));

// Onboarding
const IdentityPage = page(() => import('@/pages/onboarding/identity/IdentityPage'));
const ConnectPage = page(() => import('@/pages/onboarding/connect/ConnectPage'));
const ScanPage = page(() => import('@/pages/onboarding/scan/ScanPage'));
const ResultsPage = page(() => import('@/pages/onboarding/results/ResultsPage'));

// The signed-in app
const DashboardPage = page(() => import('@/pages/dashboard/DashboardPage'));
const DataMapPage = page(() => import('@/pages/data-map/DataMapPage'));
const CompaniesPage = page(() => import('@/pages/companies/list/CompaniesPage'));
const CompanyDetailPage = page(() => import('@/pages/companies/detail/CompanyDetailPage'));
const FixAccountPage = page(() => import('@/pages/companies/fix-account/FixAccountPage'));
const ReceiptPage = page(() => import('@/pages/receipt/ReceiptPage'));
const ProtectPage = page(() => import('@/pages/protect/ProtectPage'));
const DeletePage = page(() => import('@/pages/deletion/choose/DeletePage'));
const RequestsPage = page(() => import('@/pages/deletion/requests/RequestsPage'));
const RequestStatusPage = page(() => import('@/pages/deletion/request-status/RequestStatusPage'));
const TargetDetailPage = page(() => import('@/pages/deletion/target-detail/TargetDetailPage'));
const AlertsPage = page(() => import('@/pages/alerts/AlertsPage'));
const LeakPage = page(() => import('@/pages/leaks/LeakPage'));
const EvidencePage = page(() => import('@/pages/evidence/list/EvidencePage'));
const EvidencePackPage = page(() => import('@/pages/evidence/pack/EvidencePackPage'));
const ComplaintPage = page(() => import('@/pages/complaints/ComplaintPage'));
const CertificatePage = page(() => import('@/pages/certificates/CertificatePage'));
const AssistantPage = page(() => import('@/pages/assistant/AssistantPage'));
const ActivityPage = page(() => import('@/pages/activity/ActivityPage'));
const SettingsPage = page(() => import('@/pages/settings/SettingsPage'));

// Regulator console
const RegulatorDashboardPage = page(() => import('@/pages/regulator/dashboard/RegulatorDashboardPage'));

export const NotFoundPage = page(() => import('@/pages/not-found/NotFoundPage'));

const U = requireUser;

export const ROUTES: [string, RouteComponent][] = [
  ['/', SplashScreen],
  ['/language', LanguageScreen],
  ['/welcome', LandingPage],
  ['/scores', ScoresPage],
  ['/verify', VerifyReceiptPage],
  ['/verify/:id', VerifyReceiptPage],

  ['/signup', SignupPage],
  ['/signup/verify', VerifyCodesPage],
  ['/signup/check-email', CheckEmailPage],
  ['/passkey', U(PasskeySetupPage)],
  ['/login', LoginPage],
  ['/regulator/login', RegulatorLoginPage],

  ['/onboarding/identity', U(IdentityPage)],
  ['/onboarding/connect', U(ConnectPage)],
  ['/onboarding/scan', U(ScanPage)],
  ['/onboarding/results', U(ResultsPage)],

  ['/app', U(DashboardPage)],
  ['/app/map', U(DataMapPage)],
  ['/app/companies', U(CompaniesPage)],
  ['/app/companies/:id', U(CompanyDetailPage)],
  ['/app/companies/:id/fix', U(FixAccountPage)],
  ['/app/receipts/:id', U(ReceiptPage)],
  ['/app/protect', U(ProtectPage)],
  ['/app/delete', U(DeletePage)],
  ['/app/requests', U(RequestsPage)],
  ['/app/requests/:id', U(RequestStatusPage)],
  ['/app/requests/:rid/targets/:tid', U(TargetDetailPage)],
  ['/app/alerts', U(AlertsPage)],
  ['/app/leaks/:id', U(LeakPage)],
  ['/app/evidence', U(EvidencePage)],
  ['/app/evidence/:id', U(EvidencePackPage)],
  ['/app/complaints', U(EvidencePage)],
  ['/app/complaints/:id', U(ComplaintPage)],
  ['/app/certificates/:id', U(CertificatePage)],
  ['/app/assistant', U(AssistantPage)],
  ['/app/activity', U(ActivityPage)],
  ['/app/settings', U(SettingsPage)],

  ['/regulator', requireRegulator(RegulatorDashboardPage)]
];
