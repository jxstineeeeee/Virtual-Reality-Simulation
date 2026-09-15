import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Phones only deliver gyro (DeviceOrientationEvent) to secure pages, so when a local self-signed
// certificate exists in .cert/ the dev/preview servers run over HTTPS and listen on the LAN.
const certDir = new URL('./.cert/', import.meta.url)
const keyFile = new URL('key.pem', certDir)
const certFile = new URL('cert.pem', certDir)
const https = fs.existsSync(keyFile) && fs.existsSync(certFile) ? { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) } : undefined

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so the build works from any sub-path (GitHub Pages serves it under /<repo>/).
  base: './',
  plugins: [react()],
  server: { host: true, https },
  preview: { host: true, https },
})
