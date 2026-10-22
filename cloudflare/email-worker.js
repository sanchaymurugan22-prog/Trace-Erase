// Cloudflare Email Worker for TraceErase protected addresses (needs your own domain on Cloudflare).
// Setup: Cloudflare → your domain → Email → Email Routing → enable; Workers → Create → paste this file;
// Settings → Variables: API_URL (your Render address) and INBOUND_SECRET (same value as on Render);
// Email Routing → Routing rules → Catch-all → Send to Worker → this worker.
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).arrayBuffer();
    const r = await fetch(`${env.API_URL}/api/inbound/raw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'message/rfc822',
        'X-Inbound-Secret': env.INBOUND_SECRET,
        'X-Envelope-To': message.to,
        'X-Envelope-From': message.from
      },
      body: raw
    });
    // The API may be waking up: ask the sender's server to try again later instead of losing the email
    if (r.status >= 500) message.setReject('Temporary problem, please retry');
  }
};
