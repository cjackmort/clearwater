/**
 * On-device OCR via Tesseract.js — the free, no-key, offline-capable engine
 * that reads a photo into raw text. Structured extraction (which numbers mean
 * what) happens in ocrParse.ts. Tesseract is dynamically imported so its wasm
 * bundle only downloads the first time the user actually scans something.
 */

import type { Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      // 'eng' + default LSTM model; assets are fetched from the CDN Tesseract
      // ships with, then cached by the browser / service worker.
      return createWorker('eng')
    })().catch((err) => {
      // Reset so a later scan can retry after a transient load failure.
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

/** Run OCR on a data: URL (as produced by prepareImage) and return raw text. */
export async function ocrImage(dataUrl: string): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(dataUrl)
  return data.text ?? ''
}
