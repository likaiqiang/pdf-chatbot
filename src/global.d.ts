// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Vite
// plugin that tells the Electron app where to look for the Vite-bundled app code (depending on
// whether you're running in development or production).

import { api } from './preload'
declare module '*.css';

declare global {
    interface Window {
        chatBot: typeof api
    }
    interface IngestParams{
        buffer: Buffer,
        filename: string,
        filePath: string
    }
    const MAIN_WINDOW_VITE_NAME:string
    const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
}
