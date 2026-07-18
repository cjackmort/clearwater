export interface PreparedImage {
  /** data: URL — usable as an <img> src and storable on a record */
  dataUrl: string
  /** raw base64 (no data: prefix) for the Claude API */
  base64: string
  mediaType: 'image/jpeg'
}

/**
 * Downscale + JPEG-compress a photo so it is well under the Claude API's
 * 5 MB image limit and cheap to store in IndexedDB. 1568px is the largest
 * dimension Claude uses natively — bigger wastes tokens.
 */
export async function prepareImage(file: Blob, maxDim = 1568, quality = 0.85): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { dataUrl, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' }
}
