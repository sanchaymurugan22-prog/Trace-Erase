export interface Language { code: string; native: string; english: string; rtl?: boolean }

/** Languages offered on the Language screen and in Settings. */
export const LANGUAGES: Language[] = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'ar', native: 'العربية', english: 'Arabic', rtl: true }
];

export const languageByCode = (code: string) => LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
