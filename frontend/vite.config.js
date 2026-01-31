import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so friends on your network can open http://YOUR_IP:5173
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
});
