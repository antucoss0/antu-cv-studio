import type { GeneratedCv, Profile } from '../types'
import { hasTerm, matchedKeywords, norm } from './local'

export const HEADINGS = {
  es: {
    summary: 'Resumen profesional',
    keywords: 'Competencias clave',
    skills: 'Habilidades técnicas',
    exp: 'Experiencia laboral',
    proj: 'Proyectos',
    edu: 'Educación',
    cert: 'Certificaciones',
    lang: 'Idiomas',
  },
  en: {
    summary: 'Professional Summary',
    keywords: 'Core Competencies',
    skills: 'Technical Skills',
    exp: 'Work Experience',
    proj: 'Projects',
    edu: 'Education',
    cert: 'Certifications',
    lang: 'Languages',
  },
}

export function prettyUrl(u: string) {
  return u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}

export function contactLines(profile: Profile) {
  return [
    [profile.location, profile.phone, profile.email].filter(Boolean).join(' | '),
    profile.links.map((l) => `${l.label}: ${prettyUrl(l.url)}`).join(' | '),
  ]
}

export function cvToText(profile: Profile, cv: GeneratedCv, lang: 'es' | 'en') {
  const t = HEADINGS[lang]
  const out: string[] = [profile.name.toUpperCase(), cv.title, ...contactLines(profile), '']
  const sec = (h: string, lines: string[]) => lines.length && out.push(h.toUpperCase(), ...lines, '')
  const items = (list: GeneratedCv['experience']) =>
    list.flatMap((it) => [
      [it.title, it.org, it.period].filter(Boolean).join(' | '),
      ...(it.location || it.url ? [[it.location, it.url && prettyUrl(it.url)].filter(Boolean).join(' | ')] : []),
      ...(it.bullets ?? []).map((b) => `• ${b}`),
    ])
  sec(t.summary, [cv.summary])
  sec(t.keywords, cv.keywords?.length ? [cv.keywords.join(' | ')] : [])
  sec(t.skills, cv.skills.map((g) => `${g.group}: ${g.items.join(', ')}`))
  sec(t.exp, items(cv.experience))
  sec(t.proj, items(cv.projects))
  sec(t.edu, items(cv.education))
  sec(t.cert, cv.certifications.map((c) => `• ${c}`))
  sec(t.lang, cv.languages.length ? [cv.languages.join(' | ')] : [])
  return out.join('\n').trim()
}

export interface AtsReport {
  score: number
  coverage: number
  matched: string[]
  missing: string[]
  checks: { ok: boolean; label: string }[]
}

export function atsCheck(profile: Profile, cvText: string, jobText: string, lang: 'es' | 'en'): AtsReport {
  const h = norm(cvText)
  const wanted = matchedKeywords(profile, jobText)
  const matched = wanted.filter((k) => hasTerm(h, k))
  const missing = wanted.filter((k) => !hasTerm(h, k))
  const coverage = wanted.length ? matched.length / wanted.length : 1
  const t = HEADINGS[lang]
  const words = cvText.split(/\s+/).filter(Boolean).length
  const checks = [
    { ok: h.includes(norm(profile.email)) && cvText.replace(/\D/g, '').includes(profile.phone.replace(/\D/g, '')), label: 'Email y teléfono en texto plano' },
    { ok: h.includes(norm(profile.location.split(/[,(]/)[0].trim())), label: `Ubicación: ${profile.location}` },
    { ok: [t.exp, t.edu, t.skills].every((s) => h.includes(norm(s))), label: 'Secciones con nombres estándar (Experiencia, Educación, Habilidades)' },
    { ok: /\b(19|20)\d{2}\b/.test(cvText), label: 'Fechas en cada puesto' },
    { ok: words >= 300 && words <= 1100, label: `Extensión adecuada (${words} palabras; ideal 300–1100)` },
    { ok: coverage >= 0.6, label: `Palabras clave de la vacante: ${matched.length}/${wanted.length}` },
    { ok: !/vibecoded/i.test(cvText), label: 'Marca actual: Ethercoded' },
    { ok: true, label: 'Una sola columna, sin tablas, iconos ni imágenes' },
  ]
  const score = Math.round(coverage * 60 + (checks.filter((c) => c.ok).length / checks.length) * 40)
  return { score, coverage, matched, missing, checks }
}

type Run = { text?: string; bold?: boolean; break?: number }

function runsOf(node: Node, bold = false, out: Run[] = []): Run[] {
  node.childNodes.forEach((c) => {
    if (c.nodeType === Node.TEXT_NODE) {
      const text = (c.textContent ?? '').replace(/\s+/g, ' ')
      if (text) out.push({ text, bold })
    } else if (c instanceof HTMLElement) {
      if (c.tagName === 'BR') out.push({ break: 1 })
      else runsOf(c, bold || c.tagName === 'B' || c.tagName === 'STRONG', out)
    }
  })
  return out
}

export async function downloadDocx(el: HTMLElement, filename: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')
  const paras: InstanceType<typeof Paragraph>[] = []
  const walk = (node: HTMLElement) => {
    Array.from(node.children).forEach((c) => {
      const e = c as HTMLElement
      const runs = () => runsOf(e).map((r) => new TextRun({ text: r.text, bold: r.bold, break: r.break, font: 'Calibri', size: 21 }))
      if (e.tagName === 'H1') paras.push(new Paragraph({ children: [new TextRun({ text: e.innerText, bold: true, size: 36, font: 'Calibri' })] }))
      else if (e.tagName === 'H2')
        paras.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 60 }, children: [new TextRun({ text: e.innerText.toUpperCase(), bold: true, size: 23, font: 'Calibri', color: '5B21B6' })] }))
      else if (e.tagName === 'LI') paras.push(new Paragraph({ bullet: { level: 0 }, children: runs() }))
      else if (e.tagName === 'P' || /doc-(title|contact|item-head|item-sub)/.test(e.className))
        paras.push(
          new Paragraph({
            alignment: e.classList.contains('letter-date') ? AlignmentType.RIGHT : undefined,
            spacing: { after: e.closest('.letter') ? 160 : 40 },
            children: e.classList.contains('doc-title') ? [new TextRun({ text: e.innerText, bold: true, size: 24, font: 'Calibri', color: '5B21B6' })] : runs(),
          }),
        )
      else walk(e)
    })
  }
  walk(el)
  const doc = new Document({
    creator: 'Antu Coss',
    title: filename,
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children: paras }],
  })
  const blob = await Packer.toBlob(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename}.docx`
  a.click()
}

export function downloadText(text: string, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  a.download = `${filename}.txt`
  a.click()
}
