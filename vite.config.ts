import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // どこに置いても動くよう、読み込み先はページからの相対にする
  base: './',
  plugins: [react()],
  server: { port: 5173, host: true },
});
