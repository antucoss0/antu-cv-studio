import { forwardRef } from 'react'
import type { CvItem, GeneratedCv, GeneratedLetter, Profile } from '../types'
import { contactLines, HEADINGS, prettyUrl } from '../lib/ats'

function Header({ profile, title }: { profile: Profile; title: string }) {
  const [l1, l2] = contactLines(profile)
  return (
    <header className="doc-head">
      <h1>{profile.name.toUpperCase()}</h1>
      <div className="doc-title">{title}</div>
      <div className="doc-contact">
        {l1}
        <br />
        {l2}
      </div>
    </header>
  )
}

function Item({ it }: { it: CvItem }) {
  return (
    <div className="doc-item">
      <div className="doc-item-head">
        <b>{it.title}</b>
        <span>{[it.org && ` | ${it.org}`, it.period && ` | ${it.period}`].filter(Boolean).join('')}</span>
      </div>
      {it.location || it.url ? (
        <div className="doc-item-sub">{[it.location, it.url && prettyUrl(it.url)].filter(Boolean).join(' | ')}</div>
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

type DocProps = { profile: Profile; lang: 'es' | 'en'; className?: string; onInput?: (text: string) => void }

export const CvDoc = forwardRef<HTMLDivElement, DocProps & { cv: GeneratedCv }>(function CvDoc({ profile, cv, lang, className, onInput }, ref) {
  const t = HEADINGS[lang]
  return (
    <article
      ref={ref}
      className={`paper ${className ?? ''}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => onInput?.((e.currentTarget as HTMLElement).innerText)}
    >
      <Header profile={profile} title={cv.title} />
      <section>
        <h2>{t.summary}</h2>
        <p>{cv.summary}</p>
      </section>
      {cv.keywords?.length ? (
        <section>
          <h2>{t.keywords}</h2>
          <p>{cv.keywords.join(' | ')}</p>
        </section>
      ) : null}
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
          <p>{cv.languages.join(' | ')}</p>
        </section>
      ) : null}
    </article>
  )
})

export const LetterDoc = forwardRef<HTMLDivElement, DocProps & { letter: GeneratedLetter; title: string; date: string }>(function LetterDoc(
  { profile, letter, title, lang, date, className },
  ref,
) {
  const when = new Date(date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <article ref={ref} className={`paper letter ${className ?? ''}`} contentEditable suppressContentEditableWarning spellCheck={false}>
      <Header profile={profile} title={title} />
      <p className="letter-date">
        {profile.location.split(/[,(]/)[0].trim()}, {when}
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
        {profile.email} | {profile.phone}
        <br />
        {profile.links
          .slice(0, 2)
          .map((l) => prettyUrl(l.url))
          .join(' | ')}
      </p>
    </article>
  )
})
