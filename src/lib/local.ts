import type { Application, CvItem, Entry, GeneratedCv, GeneratedLetter, Profile, Track, TrackId } from '../types'

export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function hasTerm(haystack: string, term: string) {
  const t = norm(term).trim()
  if (!t) return false
  if (t.length <= 3) {
    const re = new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
    return re.test(haystack)
  }
  return haystack.includes(t)
}

export function rankTracks(profile: Profile, jobText: string) {
  const h = norm(jobText)
  return profile.tracks
    .map((t) => ({ track: t, score: t.keywords.reduce((acc, k) => acc + (hasTerm(h, k) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score)
}

export function period(e: Pick<Entry, 'start' | 'end'>) {
  if (!e.start && !e.end) return undefined
  if (e.start && (!e.end || e.end === e.start)) return e.start
  return `${e.start ?? ''} – ${e.end ?? ''}`
}

export function toCvItem(e: Entry): CvItem {
  return { title: e.title, org: e.org, period: period(e), location: e.location, url: e.url, bullets: e.bullets }
}

function entryText(e: Entry) {
  return norm([e.title, e.org, ...(e.bullets ?? []), ...(e.keywords ?? [])].join(' '))
}

function jobTokens(jobText: string) {
  const stop = new Set(
    'para con los las del una uno que por como sus mas este esta ser sera nuestro nuestra equipo the and for with you your our are will have from this that experiencia experience años years trabajo work'.split(
      ' ',
    ),
  )
  return Array.from(new Set(norm(jobText).split(/[^a-z0-9+#.]+/).filter((w) => w.length > 3 && !stop.has(w))))
}

function scoreEntry(e: Entry, primary: TrackId, secondary: TrackId | undefined, tokens: string[]) {
  let s = 0
  if (e.tags.includes(primary)) s += 4
  if (secondary && e.tags.includes(secondary)) s += 1.5
  const text = entryText(e)
  for (const t of tokens) if (text.includes(t)) s += 0.6
  if (e.end === 'Presente') s += 0.5
  return s
}

export function matchedKeywords(profile: Profile, jobText: string) {
  const h = norm(jobText)
  const vocab = new Map<string, string>()
  const add = (v: string) => {
    const base = v.split(/[(/]/)[0].trim()
    const pretty = base.charAt(0).toUpperCase() + base.slice(1)
    for (const k of [base, base.replace(/\s+v?\d+(\.\d+)?$/i, '')])
      if (k.length > 1 && !vocab.has(norm(k))) vocab.set(norm(k), k === base ? pretty : k)
  }
  profile.skills.forEach((g) => g.items.forEach(add))
  profile.entries.forEach((e) => e.keywords?.forEach(add))
  const hits = Array.from(vocab.values()).filter((v) => hasTerm(h, v))
  return hits.filter((v) => !hits.some((o) => o !== v && norm(o).startsWith(`${norm(v)} `)))
}

export interface LocalInput {
  jobText: string
  title: string
  company: string
  forcedTrack?: TrackId
}

export function generateLocal(profile: Profile, input: LocalInput): Omit<Application, 'id' | 'createdAt' | 'job' | 'lang'> & {
  jobTitle: string
  company: string
} {
  const ranked = rankTracks(profile, `${input.title}\n${input.jobText}`)
  const primary: Track =
    (input.forcedTrack && profile.tracks.find((t) => t.id === input.forcedTrack)) ||
    (ranked[0]?.score ? ranked[0].track : profile.tracks[0])
  const secondary = ranked.find((r) => r.track.id !== primary.id && r.score > 0)?.track
  const tokens = jobTokens(`${input.title} ${input.jobText}`)
  const isHosp = primary.id === 'hospitality'

  const pick = (kind: Entry['kind'], max: number, minScore = 2) =>
    profile.entries
      .filter((e) => e.kind === kind)
      .filter((e) => isHosp || !(e.tags.length === 1 && e.tags[0] === 'hospitality'))
      .map((e) => ({ e, s: scoreEntry(e, primary.id, secondary?.id, tokens) }))
      .filter((x) => x.s >= minScore)
      .sort((a, b) => b.s - a.s)
      .slice(0, max)
      .map((x) => x.e)

  let experience = pick('experience', isHosp ? 8 : 6)
  if (experience.length < 3) experience = pick('experience', 4, 0)
  const projects = pick('project', isHosp ? 2 : 4, isHosp ? 0 : 2)
  const education = profile.entries.filter((e) => e.kind === 'education' && (e.tags.includes(primary.id) || e.id === 'edu-caav'))
  const certs = profile.entries.filter(
    (e) => e.kind === 'certification' && (e.tags.includes(primary.id) || (secondary && e.tags.includes(secondary.id))),
  )

  const h = norm(input.jobText)
  const skills = profile.skills
    .map((g) => ({
      g,
      s: (g.tags.includes(primary.id) ? 3 : 0) + (secondary && g.tags.includes(secondary.id) ? 1 : 0) + g.items.filter((i) => hasTerm(h, i.split(/[(/]/)[0])).length,
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map(({ g }) => ({
      group: g.name,
      items: [...g.items].sort((a, b) => Number(hasTerm(h, b.split(/[(/]/)[0])) - Number(hasTerm(h, a.split(/[(/]/)[0]))),
    }))

  const matched = matchedKeywords(profile, `${input.title}\n${input.jobText}`)
  const cv: GeneratedCv = {
    title: primary.title,
    summary: primary.summary,
    keywords: matched.slice(0, 16),
    skills,
    experience: experience
      .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
      .map((e) => ({ ...toCvItem(e), bullets: e.bullets.slice(0, isHosp ? 4 : 3) })),
    projects: projects.map((e) => ({ ...toCvItem(e), bullets: e.bullets.slice(0, 2) })),
    education: education.map(toCvItem),
    certifications: certs.map((c) => [c.title, c.org, c.start].filter(Boolean).join(' — ')),
    languages: profile.languages,
  }

  const letter = localLetter(profile, primary, input, experience, projects, matched)
  const notes = [
    `Perfil detectado: ${primary.label}${secondary ? ` (+ ${secondary.label})` : ''}.`,
    matched.length
      ? `Coincidencias con la vacante: ${matched.slice(0, 18).join(', ')}.`
      : 'No encontré palabras clave claras en la vacante; revisa que el texto se haya extraído bien.',
    'Modo local: selección por palabras clave + plantilla. Conecta una API key en Ajustes IA para una redacción 100% personalizada.',
  ]

  return { mode: 'local', track: primary.id, cv, letter, notes, jobTitle: input.title, company: input.company }
}

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s
}

function trimDot(s: string) {
  return s.replace(/[.\s]+$/, '')
}

function localLetter(
  profile: Profile,
  track: Track,
  input: LocalInput,
  exps: Entry[],
  projects: Entry[],
  matched: string[],
): GeneratedLetter {
  const role = input.title ? `la posición de ${input.title}` : 'esta oportunidad'
  const at = input.company ? ` en ${input.company}` : ''
  const [e1, e2] = exps
  const p1 = `Les escribo con mucho entusiasmo para postularme a ${role}${at}. Soy ${track.title} con base en ${profile.location}, con formación en Multimedia, Arte Digital y Medios Interactivos (CAAV) y una práctica que cruza tecnología, arte e ingeniería para crear experiencias que la gente recuerda.`
  const achievements = (e1?.bullets ?? []).slice(0, 2).map((b) => lowerFirst(trimDot(b)))
  const p2 = e1
    ? `Actualmente me desempeño como ${e1.title} en ${e1.org}${e2 ? `, y como ${e2.title} en ${e2.org}` : ''}. Entre mis logros recientes destacan: ${achievements.join('; y ')}.`
    : ''
  const projTxt = projects.slice(0, 3).map((p) => p.title)
  const p3 = projTxt.length
    ? `Entre mis proyectos destacan ${projTxt.join(', ').replace(/, ([^,]*)$/, ' y $1')}, donde he llevado ideas desde el concepto hasta su ejecución técnica.${matched.length ? ` Mi experiencia con ${matched.slice(0, 6).join(', ')} se alinea directamente con lo que buscan.` : ''}`
    : matched.length
      ? `Mi experiencia con ${matched.slice(0, 6).join(', ')} se alinea directamente con lo que buscan.`
      : ''
  const p4 = `Me encantaría aportar esta combinación de visión creativa y rigor técnico${input.company ? ` a ${input.company}` : ' a su equipo'}. Pueden conocer mi trabajo en antucoss.xyz y en ethercoded.com. Quedo a su disposición para conversar.`
  return {
    subject: `Postulación: ${input.title || track.title}${input.company ? ` — ${input.company}` : ''}`,
    greeting: input.company ? `Estimado equipo de ${input.company}:` : 'Estimado equipo de selección:',
    paragraphs: [p1, p2, p3, p4].filter(Boolean),
    closing: 'Con aprecio,',
  }
}

export function guessTitleCompany(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[#*\-\s>]+/, '').trim())
    .filter((l) => l.length > 3 && l.length < 90 && !/^(url|title|markdown|published)/i.test(l))
  const titleLine = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim()
  const company =
    text.match(/(?:empresa|company|compañía|organización)\s*[:|]\s*([^\n|]{2,60})/i)?.[1]?.trim() ||
    titleLine?.match(/\s(?:at|en|@)\s+([^|–-]+)/i)?.[1]?.trim() ||
    ''
  let title = (titleLine?.split(/[|–]| at | en /)[0] || lines[0] || '').trim()
  if (company && title.toLowerCase().includes(company.toLowerCase())) {
    title = title.replace(new RegExp(`\\s*[-–|@]?\\s*${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), ' ').replace(/\s*[-–|]\s*$/, '').trim()
  }
  return { title: title.slice(0, 80), company: company.slice(0, 60) }
}
