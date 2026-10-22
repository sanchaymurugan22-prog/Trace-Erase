// Shapes of the data the TraceErase API returns. Fields are optional where the server may omit them.

export interface Settings {
  autoOtp: boolean; autoEscalate: boolean; autoFile: boolean; strictMode: boolean;
  theme: 'light' | 'dark' | 'system'; textSize: 'small' | 'default' | 'large';
  alerts: Record<string, boolean>; alertChannels: Record<string, boolean>;
}

export interface User {
  id: string; name: string; email: string; phone: string; language: string; letterLanguage?: string;
  protectedNumber?: string; verified: boolean; verifiedEmail: boolean; verifiedPhone: boolean; demo?: boolean; authProvider?: string;
  hasPasskey: boolean; onboarding: Record<string, any>; settings: Settings; gmailConnected: boolean; createdAt: string;
}

export interface Staff { id: string; email: string; name: string; role: 'regulator'; org: string }

export interface Flags {
  gmailConfigured?: boolean; firebaseAuth?: boolean; smsAvailable?: boolean; isDemo?: boolean; protectedEmail?: boolean; gmailRedirectUri?: string; devMail?: boolean; devSms?: boolean; demoMode?: boolean;
  protectedDomain?: string; clockOffsetDays?: number; sendRealRequests?: boolean; chain?: boolean;
}

export interface AiStatus {
  configured: boolean; provider: 'studio' | 'vertex' | null; model: string | null; fastModel?: string | null; lastOk: string | null;
  lastError: string | null; hint: string | null; paused?: boolean; calls?: number; failures?: number;
}

export interface Me { user: User | null; staff: Staff | null; flags: Flags; ai: AiStatus }

export interface Company {
  id: string; key: string; name: string; domains: string[]; domain: string; category: string; color: string;
  dataTypes: string[]; partnerTypes: string[]; fictional: boolean;
}

export interface Address {
  id: string; userId: string; companyId: string; email: string; status: 'active' | 'rotated'; purpose?: string | null;
  allowed: string[]; blockedSenders: string[]; forwarded: number; blocked: number; leaks: number; previous?: string;
  company?: Company;
}

export interface HoldingRow {
  id: string; holdingId: string; company: Company; dataTypes: string[]; sources: string[]; lastSeen: string | null;
  daysSinceUse: number | null; via: Company | null; partnersCount: number; partnersKnown: boolean;
  channel: 'email' | 'webform'; status: string; targetId: string | null; requestId: string | null;
  address: { id: string; email: string; leaks: number } | null; usingProtected: boolean; leaks: number; fix: any;
}

export interface TargetEvent { at: string; type: string; text: string; receiptId?: string; ai?: boolean }

export interface Target {
  id: string; requestId: string; userId: string; companyId: string; reason: 'selected' | 'partner'; viaCompanyId?: string;
  channel: 'email' | 'webform'; status: string; events: TargetEvent[]; sentAt?: string; deadlineAt?: string;
  identifier?: string; addressId?: string; letter?: { subject: string; body: string; to: string; guessedAddress?: boolean; _ai?: boolean };
  replyCheck?: any; result?: { deleted: string[]; kept: { field: string; law: string }[] }; reference?: string;
  receiptId?: string; verifyReceiptId?: string; complaintId?: string; packId?: string; formUrl?: string; delivery?: string;
  company: Company; via: Company | null; day: number; resolved: boolean; silenceLeft: number | null; legalHolds?: { what: string; why: string }[];
}

export interface DeletionRequest {
  id: string; number: string; status: 'draft' | 'active' | 'completed'; createdAt: string; signedAt?: string;
  signature?: any; payloadHash?: string; targets: Target[]; resolved: number; total: number; day: number;
  counts: Record<string, number>; steps: { key: string; label: string; day: number | null; state: 'done' | 'current' | 'todo' }[];
  certificateId: string | null;
}

export interface Alert {
  id: string; type: string; severity?: 'good' | 'warn' | 'danger' | 'info'; title: string; body?: string; link?: string;
  read?: boolean; needsAction?: boolean; at: string; createdAt?: string; refId?: string;
}

export interface Receipt {
  id: string; kind: string; title: string; hash: string; issuedAt: string; signedBy?: string; data?: any;
  batchId?: string | null; company?: any;
}

export interface LeakChainNode { name: string; note?: string; companyId?: string; leak?: boolean }

export interface Leak {
  id: string; userId: string; addressId: string; companyId: string; senderCompanyId?: string;
  senderName: string; senderEmail: string; senderDomain: string; subject: string; excerpt: string; at: string;
  receiptId: string; status: 'open' | 'resolved';
  actions: { blocked?: boolean; rotated?: boolean; newAddress?: string; deletionRequested?: boolean; requestId?: string; evidence?: string };
  investigation?: { likelySourceCompanyId: string; likelySourceName: string; confidence: string; reasons: string[]; summary?: string; chain: LeakChainNode[]; ai?: boolean; receiptId?: string; at: string };
  company: Company; address: Address | null; current: Address | null; packId: string | null; complaintId: string | null;
}

export interface EvidenceItem { receiptId: string; label: string; proves: string; source: string; at: string; hash: string }
export interface EvidencePack { id: string; number: string; title: string; targetId: string | null; leakId: string | null; against: string[]; items: EvidenceItem[]; receiptId: string; builtAt: string }

export interface Complaint {
  id: string; userId: string; packId: string; status: 'draft' | 'filed'; to: string; summary: string; asks: string[];
  parties: { companyId: string | null; name: string; issue: string }[]; reference?: string; filedAt?: string; autoFiled?: boolean; ai?: boolean;
  createdAt?: string; pack?: EvidencePack | null;
}

export interface CertificateRow { company: string; status: string; kept: string; receiptId: string | null; hash: string | null }
export interface Certificate {
  id: string; requestId: string; number: string; rows: CertificateRow[]; resolvedCount: number; total: number; issuedAt: string;
  receiptId: string; receipt?: Receipt | null; request?: string;
}

export interface ActivityItem {
  id: string; at: string; channel: 'email' | 'sms' | 'call'; from: string; fromAddress?: string; to: string; subject?: string;
  action: 'forwarded' | 'blocked' | 'code' | 'rang'; why: string; leakId?: string;
}

export interface OutboxItem {
  id: string; sentAt: string; channel?: 'email' | 'sms'; kind: string; to: string; from?: string; subject?: string; text: string;
  delivered?: boolean; deliveryNote?: string;
}

export interface ChatMessage { role: 'user' | 'assistant'; text: string; at?: string; links?: { label: string; to: string }[]; ai?: boolean }
export interface ChatSummary { id: string; title: string; at: string }

export interface RegulatorOverview {
  kpis: { complaints: number; withEvidence: number; companies: number; leaks: number };
  complaints: { id: string; reference: string; against: string[]; issue: string; evidence: number; filedAt: string }[];
  offenders: { name: string; complaints: number; leaks: number; ignored: number }[];
  pattern: { headline: string; explanation: string; priority: string; action?: string; _ai?: boolean } | null;
}

export interface SetupStatus {
  gmail: { configured: boolean; redirectUri: string; clientId: string | null };
  ai: AiStatus & { attempts?: { provider: string; model: string; code: number; error: string }[] };
  keyHint: string | null;
}
