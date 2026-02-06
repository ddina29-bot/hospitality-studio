import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hospitality.studio',
  appName: 'Hospitality Studio',
  webDir: 'dist',
  server: {
    url: 'https://hospitality-studio-production.up.railway.app/',
    cleartext: true
  }
};

export default config;
