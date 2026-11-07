import type { Entry, GeneratedCv, GeneratedLetter, Profile, Settings, TrackId } from '../types'

type Part = { type: 'text'; text: string } | { type: 'image'; dataUrl: string }

async function callLLM(settings: Settings, system: string, parts: Part[], maxTokens = 8000): Promise<string> {
  if (settings.provider === 'anthropic') {
    const content = parts.map((p) => {
      if (p.type === 'text') return { type: 'text', text: p.text }
      const [meta, data] = p.dataUrl.split(',')
      const media_type = meta.match(/data:(.*?);/)?.[1] ?? 'image/jpeg'
      return { type: 'image', source: { type: 'base64', media_type, data } }
    })
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: settings.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j?.error?.message ?? `Anthropic ${r.status}`)
    return (j.content ?? []).map((c: { text?: string }) => c.text ?? '').join('')
  }
  if (settings.provider === 'openai') {
    const content = parts.map((p) =>
      p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image_url', image_url: { url: p.dataUrl } },
    )
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content },
        ],
      }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j?.error?.message ?? `OpenAI ${r.status}`)
    return j.choices?.[0]?.message?.content ?? ''
  }
  throw new Error('Configura un proveedor de IA en Ajustes.')
}

function parseJson<T>(raw: string): T {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('La IA no devolvió JSON válido.')
  return JSON.parse(raw.slice(start, end + 1)) as T
}

export async function testConnection(settings: Settings) {
  const out = await callLLM(settings, 'Responde solo con JSON.', [{ type: 'text', text: 'Devuelve {"ok":true}' }], 50)
  return out.includes('ok')
}

export interface AiJobInput {
  jobText: string
  imageDataUrl?: string
  title: string
  company: string
  lang: 'es' | 'en'
  forcedTrack?: TrackId
  extra: string
}

export interface AiResult {
  jobTitle: string
  company: string
  jobSummary: string
  track: TrackId
  cv: GeneratedCv
  letter: GeneratedLetter
  notes: string[]
}

const RULES = `Reglas estrictas:
- Usa SOLO hechos presentes en la base de datos de Antu. Puedes reformular, resumir, reordenar y priorizar, pero NUNCA inventes empleos, fechas, empresas, métricas, títulos ni certificaciones.
- "Ethercoded" (https://ethercoded.com) es el nombre actual del estudio de ingeniería de experiencias inmersivas de Antu (antes se llamaba Vibecoded / vibecoded.lat). Nunca escribas "Vibecoded" ni "vibecoded.lat".
- El CV debe pasar sistemas ATS y lectores/filtros de IA de reclutamiento:
  · Usa las palabras clave EXACTAS de la vacante (mismo término y grafía, p. ej. "Unreal Engine 5", "Realidad Aumentada (AR)") SOLO cuando sean verdaderas según la base de datos; incluye sigla y nombre completo la primera vez.
  · "keywords": 10–16 competencias clave literales de la vacante que Antu sí tiene, en orden de importancia para el puesto.
  · El titular ("title") debe reflejar el nombre del puesto de la vacante cuando sea veraz.
  · Cada puesto con título, empresa y periodo (años); bullets que empiecen con verbo de acción, con tecnología y resultado.
  · Texto plano: sin emojis, símbolos decorativos, tablas ni columnas.
  · Ubicación actual de Antu: {{LOCATION}}.
- Prioriza la experiencia y proyectos más relevantes para la vacante; omite lo irrelevante (p. ej. hospitalidad para un puesto de IA, o IA para un puesto de recepción, salvo que aporte).
- El CV debe caber en 1–2 páginas: 4–7 experiencias, 2–5 proyectos, bullets concisos orientados a logros (verbo en pasado/presente).
- La carta: 250–380 palabras, cálida, segura y específica a la empresa/puesto; menciona por qué Antu encaja y 2–3 evidencias concretas de la base de datos. Sin clichés vacíos.`

const SCHEMA = `Devuelve SOLO un objeto JSON con esta forma exacta:
{
  "jobTitle": string,            // puesto detectado
  "company": string,             // empresa/organización detectada ("" si no aparece)
  "jobSummary": string,          // 1–2 frases sobre la vacante
  "track": one of ["ia","ia-art","gamedev","xr","3d","multimedia","frontend","design","hospitality"],
  "cv": {
    "title": string,             // titular profesional adaptado a la vacante
    "summary": string,           // resumen profesional 3–5 frases con las palabras clave principales
    "keywords": string[],        // 10–16 competencias clave literales de la vacante (veraces)
    "skills": [{"group": string, "items": string[]}],
    "experience": [{"title": string, "org": string, "period": string, "location": string, "url": string, "bullets": string[]}],
    "projects": [{"title": string, "org": string, "period": string, "url": string, "bullets": string[]}],
    "education": [{"title": string, "org": string, "period": string, "bullets": string[]}],
    "certifications": string[],
    "languages": string[]
  },
  "letter": {"subject": string, "greeting": string, "paragraphs": string[], "closing": string},
  "notes": string[]              // 3–6 consejos: coincidencias clave, brechas honestas, qué preparar para la entrevista
}`

export async function generateWithAI(settings: Settings, profile: Profile, input: AiJobInput): Promise<AiResult> {
  const langName = input.lang === 'en' ? 'inglés (English)' : 'español'
  const system = `Eres un reclutador senior y redactor experto de CVs y cartas de presentación para perfiles creativos y tecnológicos. Trabajas exclusivamente para Antu Coss, un perfil multidisciplinario (IA, game dev, XR, 3D, multimedia, frontend, diseño, hospitalidad).

${RULES.replace('{{LOCATION}}', profile.location)}
- Escribe TODO el contenido del CV y la carta en ${langName}.

BASE DE DATOS DE ANTU (JSON):
${JSON.stringify(profile)}

${SCHEMA}`
  const parts: Part[] = []
  if (input.imageDataUrl) parts.push({ type: 'image', dataUrl: input.imageDataUrl })
  parts.push({
    type: 'text',
    text: `OPORTUNIDAD${input.imageDataUrl ? ' (también en el flyer/imagen adjunta — léelo con atención)' : ''}:
Puesto indicado: ${input.title || '(detectar)'}
Empresa indicada: ${input.company || '(detectar)'}
${input.forcedTrack ? `Perfil a enfatizar: ${input.forcedTrack}\n` : ''}${input.extra ? `Instrucciones extra de Antu: ${input.extra}\n` : ''}
Texto de la vacante:
"""
${input.jobText || '(ver imagen)'}
"""`,
  })
  const raw = await callLLM(settings, system, parts)
  const res = parseJson<AiResult>(raw)
  res.cv.experience ??= []
  res.cv.projects ??= []
  res.cv.education ??= []
  res.cv.skills ??= []
  res.cv.certifications ??= []
  res.cv.languages ??= profile.languages
  res.notes ??= []
  return res
}

export async function structureEntryWithAI(settings: Settings, text: string): Promise<Partial<Entry>> {
  const system = `Convierte la descripción libre de una experiencia/proyecto de Antu Coss en una entrada estructurada para su base de datos de CV. No inventes datos que no estén en el texto. Si menciona Vibecoded, usa "Ethercoded" (ethercoded.com).
Devuelve SOLO JSON: {"kind": "experience"|"project"|"education"|"certification", "title": string, "org": string, "start": string, "end": string, "location": string, "url": string, "bullets": string[], "tags": string[] (subset de ["ia","ia-art","gamedev","xr","3d","multimedia","frontend","design","hospitality"]), "keywords": string[]}`
  return parseJson<Partial<Entry>>(await callLLM(settings, system, [{ type: 'text', text }], 1500))
}
