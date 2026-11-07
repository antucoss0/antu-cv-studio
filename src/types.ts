export type TrackId =
  | 'ia'
  | 'ia-art'
  | 'gamedev'
  | 'xr'
  | '3d'
  | 'multimedia'
  | 'frontend'
  | 'design'
  | 'hospitality'

export type EntryKind = 'experience' | 'project' | 'education' | 'certification'

export interface Entry {
  id: string
  kind: EntryKind
  title: string
  org?: string
  start?: string
  end?: string
  location?: string
  url?: string
  bullets: string[]
  tags: TrackId[]
  keywords?: string[]
}

export interface SkillGroup {
  id: string
  name: string
  items: string[]
  tags: TrackId[]
}

export interface Track {
  id: TrackId
  label: string
  title: string
  summary: string
  keywords: string[]
}

export interface Profile {
  name: string
  fullName: string
  email: string
  phone: string
  location: string
  links: { label: string; url: string }[]
  languages: string[]
  tracks: Track[]
  entries: Entry[]
  skills: SkillGroup[]
}

export interface CvItem {
  title: string
  org?: string
  period?: string
  location?: string
  url?: string
  bullets: string[]
}

export interface GeneratedCv {
  title: string
  summary: string
  keywords?: string[]
  skills: { group: string; items: string[] }[]
  experience: CvItem[]
  projects: CvItem[]
  education: CvItem[]
  certifications: string[]
  languages: string[]
}

export interface GeneratedLetter {
  subject: string
  greeting: string
  paragraphs: string[]
  closing: string
}

export interface JobInfo {
  title: string
  company: string
  sourceType: 'link' | 'image' | 'text'
  source: string
  text: string
}

export interface Application {
  id: string
  createdAt: string
  lang: 'es' | 'en'
  mode: 'ai' | 'local'
  track: TrackId
  job: JobInfo
  cv: GeneratedCv
  letter: GeneratedLetter
  notes: string[]
}

export type Provider = 'anthropic' | 'openai' | 'none'

export interface Settings {
  provider: Provider
  apiKey: string
  model: string
}
