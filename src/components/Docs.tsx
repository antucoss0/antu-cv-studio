import { forwardRef } from 'react'
import type { CvItem, GeneratedCv, GeneratedLetter, Profile } from '../types'

const L = {
  es: { profile: 'Perfil profesional', skills: 'Competencias técnicas', exp: 'Experiencia profesional', proj: 'Proyectos destacados', edu: 'Educación', cert: 'Certificaciones y reconocimientos', lang: 'Idiomas' },
  en: { profile: 'Professional summary', skills: 'Technical skills', exp: 'Professional experience', proj: 'Selected projects', edu: 'Education', cert: 'Certifications & recognition', lang: 'Languages' },
}

function prettyUrl(u: string) {
  return u.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function Header({ profile, title }: { profile: Profile; title: string }) {
  return (
    <header className="doc-head">
      <h1>{profile.name.toUpperCase()}</h1>
      <div className="doc-title">{title}</div>
      <div className="doc-contact">
        {[profile.location, profile.email, profile.phone].filter(Boolean).join('  ·  ')}
        <br />
        {profile.links.map((l) => prettyUrl(l.url)).join('  ·  ')}
      </div>
    </header>
  )
}

function Item({ it }: { it: CvItem }) {
  return (
    <div className="doc-item">
      <div className="doc-item-head">
        <span>
          <b>{it.title}</b>
          {it.org ? <> — {it.org}</> : null}
        </span>
        {it.period ? <span className="doc-period">{it.period}</span> : null}
      </div>
      {it.location || it.url ? (
        <div className="doc-item-sub">{[it.location, it.url && prettyUrl(it.url)].filter(Boolean).join(' · ')}</div>
      ) : null}
      {it.bullets?.length ? (
        <ul>
          {it.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export const CvDoc = forwardRef<HTMLDivElement, { profile: Profile; cv: GeneratedCv; lang: 'es' | 'en'; className?: string }>(
  function CvDoc({ profile, cv, lang, className }, ref) {
    const t = L[lang]
    return (
      <article ref={ref} className={`paper ${className ?? ''}`} contentEditable suppressContentEditableWarning spellCheck={false}>
        <Header profile={profile} title={cv.title} />
        <section>
          <h2>{t.profile}</h2>
          <p>{cv.summary}</p>
        </section>
        {cv.skills.length ? (
          <section>
            <h2>{t.skills}</h2>
            {cv.skills.map((g, i) => (
              <p key={i} className="doc-skill">
                <b>{g.group}:</b> {g.items.join(', ')}
              </p>
            ))}
          </section>
        ) : null}
        {cv.experience.length ? (
          <section>
            <h2>{t.exp}</h2>
            {cv.experience.map((it, i) => (
              <Item key={i} it={it} />
            ))}
          </section>
        ) : null}
        {cv.projects.length ? (
          <section>
            <h2>{t.proj}</h2>
            {cv.projects.map((it, i) => (
              <Item key={i} it={it} />
            ))}
          </section>
        ) : null}
        {cv.education.length ? (
          <section>
            <h2>{t.edu}</h2>
            {cv.education.map((it, i) => (
              <Item key={i} it={it} />
            ))}
          </section>
        ) : null}
        {cv.certifications.length ? (
          <section>
            <h2>{t.cert}</h2>
            <ul>
              {cv.certifications.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {cv.languages.length ? (
          <section>
            <h2>{t.lang}</h2>
            <p>{cv.languages.join('  ·  ')}</p>
          </section>
        ) : null}
      </article>
    )
  },
)

export const LetterDoc = forwardRef<
  HTMLDivElement,
  { profile: Profile; letter: GeneratedLetter; title: string; lang: 'es' | 'en'; className?: string }
>(function LetterDoc({ profile, letter, title, lang, className }, ref) {
  const date = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <article ref={ref} className={`paper letter ${className ?? ''}`} contentEditable suppressContentEditableWarning spellCheck={false}>
      <Header profile={profile} title={title} />
      <p className="letter-date">
        {profile.location.split(',')[0]}, {date}
      </p>
      <p className="letter-subject">
        <b>{letter.subject}</b>
      </p>
      <p>{letter.greeting}</p>
      {letter.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p className="letter-closing">{letter.closing}</p>
      <p className="letter-sign">
        <b>{profile.fullName}</b>
        <br />
        {profile.email} · {profile.phone}
        <br />
        {profile.links
          .slice(0, 2)
          .map((l) => prettyUrl(l.url))
          .join(' · ')}
      </p>
    </article>
  )
})
