import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { falGeneratePlugin } from './server/falGeneratePlugin.ts';
import { vroidHubPlugin } from './server/vroidHubPlugin.ts';

export default defineConfig({
  plugins: [react(), falGeneratePlugin(), vroidHubPlugin()],
  server: {
    // Keep API on same origin during dev so secrets never reach the browser
  },
});

