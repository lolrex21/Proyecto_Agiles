// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uta.campusseguro',
  appName: 'UTA CampusSeguro',
  webDir: 'dist',
  server: {
    androidScheme: 'https', // la WebView servirá la app en https://localhost (importante para WSS y OAuth)
  },
};

export default config;