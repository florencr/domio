import type { CapacitorConfig } from '@capacitor/cli';

// When CAPACITOR_APP_URL is set, the app loads your deployed web app (online only).
// Dev: set to http://localhost:3001 (use ngrok for real device: npx ngrok http 3001)
// Prod: set to https://your-app.vercel.app or your domain
const appUrl = process.env.CAPACITOR_APP_URL;

const config: CapacitorConfig = {
  appId: 'com.domio.app',
  appName: 'Domio',
  webDir: 'www',
  ...(appUrl && {
    server: {
      url: appUrl,
      cleartext: appUrl.startsWith('http://'),
    },
  }),
};

export default config;
