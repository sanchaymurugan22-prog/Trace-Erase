// If a page fails to load (for example right after a new version of the website was published),
// show a friendly message with a reload button instead of a blank white screen.
import { Component, type ReactNode } from 'react';

const isChunkError = (e: unknown) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i.test(String((e as any)?.message || e));

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidCatch(error: unknown) {
    console.error('[page error]', error);
    // A new version was published while this tab was open: load it once, automatically
    if (isChunkError(error)) {
      try { if (!sessionStorage.getItem('te_reloaded')) { sessionStorage.setItem('te_reloaded', '1'); window.location.reload(); } } catch { window.location.reload(); }
    }
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Something went wrong on this page</h1>
        <p className="max-w-md text-mute">A newer version of TraceErase may have just been published. Reloading usually fixes it.</p>
        <div className="flex gap-2">
          <button type="button" className="inline-flex h-11 items-center rounded-xl bg-brand px-5 font-semibold text-white" onClick={() => window.location.reload()}>Reload</button>
          <a href="/app" className="inline-flex h-11 items-center rounded-xl border border-line2 bg-card px-5 font-semibold text-ink">Go to dashboard</a>
        </div>
      </div>
    );
  }
}

// Vite reports failed chunk preloads here too
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    try { if (!sessionStorage.getItem('te_reloaded')) { sessionStorage.setItem('te_reloaded', '1'); window.location.reload(); } } catch {}
  });
  // Clear the flag once a page has loaded fine, so a later new version can reload again
  window.setTimeout(() => { try { sessionStorage.removeItem('te_reloaded'); } catch {} }, 15000);
}
