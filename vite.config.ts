
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // Removed 'define: { process.env: env }' to prevent leaking secrets. 
    // Vite automatically exposes VITE_ prefixed vars via import.meta.env
    build: {
      chunkSizeWarningLimit: 1000, // Increased to 1000kB to stop the warning
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
