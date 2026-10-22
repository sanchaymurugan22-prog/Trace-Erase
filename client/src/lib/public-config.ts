// Public settings for the online website (Firebase Hosting), used by "npm run deploy:web".
// Nothing here is secret: these values are visible in any website's code. Secrets live only on Render.
export const ONLINE = {
  apiUrl: 'https://traceerase-api.onrender.com',
  firebaseApiKey: 'AIzaSyCTCbOJ3djPKxRrAjH8Y4jJgd1YPBNk9i4',
  firebaseProjectId: 'trace-erase',
  firebaseAuthDomain: 'trace-erase.firebaseapp.com',
  googleClientId: 'PASTE_WEB_CLIENT_ID_HERE',
  // Reading Gmail needs a Google-restricted permission (app verification). Off: people upload a mail export instead.
  gmailScan: false
};
