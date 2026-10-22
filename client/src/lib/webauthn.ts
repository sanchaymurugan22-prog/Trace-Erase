// Browser side of passkeys (WebAuthn), without dependencies.
const toB64u = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
};

export const passkeysSupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;

export async function createPasskey(options: any) {
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: fromB64u(options.challenge),
    user: { ...options.user, id: fromB64u(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({ ...c, id: fromB64u(c.id) }))
  };
  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Passkey creation was cancelled');
  const res = cred.response as AuthenticatorAttestationResponse;
  return {
    id: cred.id, rawId: toB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: toB64u(res.clientDataJSON),
      attestationObject: toB64u(res.attestationObject),
      transports: typeof res.getTransports === 'function' ? res.getTransports() : []
    }
  };
}

export async function signWithPasskey(options: any) {
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: fromB64u(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c: any) => ({ ...c, id: fromB64u(c.id) }))
  };
  const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Passkey request was cancelled');
  const res = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id, rawId: toB64u(cred.rawId), type: cred.type,
    response: {
      clientDataJSON: toB64u(res.clientDataJSON),
      authenticatorData: toB64u(res.authenticatorData),
      signature: toB64u(res.signature),
      userHandle: res.userHandle ? toB64u(res.userHandle) : null
    }
  };
}

export function passkeyErrorMessage(e: any): string {
  if (e?.name === 'NotAllowedError') return 'The passkey prompt was closed or timed out. Please try again.';
  if (e?.name === 'InvalidStateError') return 'This device already has a passkey for your account.';
  if (e?.name === 'SecurityError') return 'Passkeys need the app to be opened at http://localhost:5173.';
  return e?.message || 'Passkey failed';
}
