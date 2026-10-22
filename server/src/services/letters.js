// AI request writer: legally grounded letters in the company's preferred language.
import { generate, withFallback, maskFor } from '../ai/gemini.js';

const LANG = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', bn: 'Bengali', mr: 'Marathi', gu: 'Gujarati', es: 'Spanish', fr: 'French', ar: 'Arabic' };
export const languageName = (code) => LANG[code] || 'English';

const PURPOSE = {
  deletion: 'request erasure of all personal data under Section 12(3) of the Digital Personal Data Protection Act, 2023 (India), and ask the company to confirm which data was deleted, which data is kept under which law, and to instruct every processor or partner it shared the data with to delete it too (Section 8(7))',
  access: 'request a summary of the personal data held and the identities of every Data Fiduciary and Data Processor it was shared with, under Section 11 of the Digital Personal Data Protection Act, 2023',
  reminder: 'politely remind the company that an earlier erasure request has not been answered, give the original date, and ask for a reply within 3 days',
  grievance: 'formally raise a grievance with the Grievance Officer under Section 13 of the DPDP Act, 2023, because the erasure request was ignored despite a reminder, and state that a complaint to the Data Protection Board of India will follow if there is no reply',
  'partner-deletion': 'request erasure of personal data the recipient received from another company, and ask it to confirm deletion'
};

function fallbackLetter({ kind, companyName, protectedEmail, requestNumber, sentOn, viaCompany }) {
  const ref = requestNumber ? ` (reference ${requestNumber})` : '';
  const subjects = {
    deletion: `Request to delete my personal data${ref}`,
    access: `Request for a summary of my personal data${ref}`,
    reminder: `Reminder: request to delete my personal data${ref}`,
    grievance: `Grievance: unanswered request to delete my personal data${ref}`,
    'partner-deletion': `Request to delete personal data received from ${viaCompany || 'a partner'}${ref}`
  };
  const bodies = {
    deletion: `Dear ${companyName} Privacy Team,\n\nUnder Section 12(3) of the Digital Personal Data Protection Act, 2023, I ask you to erase all personal data you hold about me.\n\nAccount: ${protectedEmail}\n\nPlease confirm in writing:\n1. which data you deleted,\n2. any data you must keep, and the law that requires it,\n3. that you have told every partner you shared my data with to delete it too.\n\nThis request is signed with my passkey. Please reply within 30 days.\n\n[USER_NAME]`,
    access: `Dear Grievance Officer,\n\nUnder Section 11 of the Digital Personal Data Protection Act, 2023, please send me a summary of the personal data you hold about me, and the names of every company you have shared it with.\n\nAccount: ${protectedEmail}\n\nPlease reply within 30 days.\n\n[USER_NAME]`,
    reminder: `Dear ${companyName} Privacy Team,\n\nOn ${sentOn} I asked you to erase my personal data${ref}. I have not received a reply. Please confirm the deletion within 3 days.\n\nAccount: ${protectedEmail}\n\n[USER_NAME]`,
    grievance: `Dear Grievance Officer,\n\nOn ${sentOn} I asked ${companyName} to erase my personal data${ref} and sent a reminder. Neither was answered. Under Section 13 of the Digital Personal Data Protection Act, 2023, I am raising a formal grievance. If I do not hear from you, I will file a complaint with the Data Protection Board of India.\n\nAccount: ${protectedEmail}\n\n[USER_NAME]`,
    'partner-deletion': `Dear ${companyName} Privacy Team,\n\nYou received my personal data from ${viaCompany}. Under the Digital Personal Data Protection Act, 2023, please erase it and confirm in writing.\n\nIdentifier: ${protectedEmail}\n\n[USER_NAME]`
  };
  return { subject: subjects[kind], body: bodies[kind] };
}

/** Returns { subject, body, _ai } with the user's name filled in. */
export async function draftLetter(user, { kind, companyName, protectedEmail, requestNumber, sentOn, viaCompany, language = 'en' }) {
  const { unmask } = maskFor(user);
  const res = await withFallback('request-writer', async () => generate({
    feature: 'request-writer',
    system: 'You write short, firm, polite legal letters for ordinary people exercising their data protection rights in India. Cite the DPDP Act 2023 correctly. Never invent facts, dates or reference numbers. Use the placeholder [USER_NAME] for the sender\'s name. Plain text, no markdown.',
    prompt: `Write a letter to ${companyName} to ${PURPOSE[kind]}.
Facts:
- Account identifier the company knows: ${protectedEmail}
${requestNumber ? `- TraceErase reference: ${requestNumber}` : ''}
${sentOn ? `- Original request date: ${sentOn}` : ''}
${viaCompany ? `- The data came from: ${viaCompany}` : ''}
- The request is signed with the sender's passkey.
Language: ${languageName(language)}.
Keep the body under 170 words. Return JSON {"subject":"...","body":"..."}.`,
    json: true, temperature: 0.3
  }), () => fallbackLetter({ kind, companyName, protectedEmail, requestNumber, sentOn, viaCompany }));
  return { subject: unmask(res.subject), body: unmask(res.body).replace(/\[USER_NAME\]/g, user.name), _ai: res._ai };
}
