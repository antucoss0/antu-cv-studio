export async function fetchJobFromUrl(url: string): Promise<string> {
  const clean = url.trim()
  const attempts = [
    async () => {
      const r = await fetch(`https://r.jina.ai/${clean}`, { headers: { Accept: 'text/plain' } })
      if (!r.ok) throw new Error(String(r.status))
      return r.text()
    },
    async () => {
      const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(clean)}`)
      if (!r.ok) throw new Error(String(r.status))
      return htmlToText(await r.text())
    },
  ]
  let lastErr: unknown
  for (const attempt of attempts) {
    try {
      const text = (await attempt()).trim()
      if (text.length > 80) return text.slice(0, 20000)
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error(
    `No pude leer el link (${String(lastErr ?? 'sin contenido')}). Algunas páginas (LinkedIn, Indeed) bloquean lectores: copia el texto de la vacante y pégalo en "Texto".`,
  )
}

function htmlToText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,noscript,svg').forEach((n) => n.remove())
  return (doc.body?.innerText || doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n')
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function downscaleImage(dataUrl: string, maxSide = 1600): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.88)
}

export async function ocrImage(dataUrl: string, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['spa', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  const { data } = await worker.recognize(dataUrl)
  await worker.terminate()
  return data.text
}
