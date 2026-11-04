import { useEffect, useRef, useState } from 'react'
import type { Application, Entry, TrackId } from './types'
import { useHistory, useProfile, useSettings, uid } from './lib/store'
import { downscaleImage, fetchJobFromUrl, fileToDataUrl, ocrImage } from './lib/extract'
import { generateLocal, guessTitleCompany } from './lib/local'
import { generateWithAI } from './lib/ai'
import { CvDoc, LetterDoc } from './components/Docs'
import { DbPanel, EntryEditor, SettingsModal } from './components/Modals'
import { Mascot } from './components/Mascot'

type Source = 'link' | 'image' | 'text'
type View = 'cv' | 'letter' | 'notes'

export default function App() {
  const [profile, setProfile] = useProfile()
  const [settings, setSettings] = useSettings()
  const [history, setHistory] = useHistory()

  const [source, setSource] = useState<Source>('link')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [image, setImage] = useState<string>('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [lang, setLang] = useState<'es' | 'en'>('es')
  const [track, setTrack] = useState<TrackId | ''>('')
  const [extra, setExtra] = useState('')

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [app, setApp] = useState<Application | null>(history[0] ?? null)
  const [view, setView] = useState<View>('cv')
  const [docKey, setDocKey] = useState(0)

  const [modal, setModal] = useState<'add' | 'db' | 'settings' | null>(null)
  const [editing, setEditing] = useState<Entry | undefined>()
  const [toast, setToast] = useState('')

  const cvRef = useRef<HTMLDivElement>(null)
  const letterRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const aiOn = settings.provider !== 'none' && !!settings.apiKey

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (file) {
        setSource('image')
        void loadImage(file)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  async function loadImage(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Sube una imagen (PNG, JPG, WEBP). Para PDFs, copia el texto en la pestaña Texto.')
      return
    }
    setImage(await downscaleImage(await fileToDataUrl(file)))
    setError('')
  }

  async function generate() {
    setError('')
    try {
      let jobText = source === 'text' ? text : ''
      if (source === 'link') {
        if (!url.trim()) throw new Error('Pega el link de la oportunidad ✿')
        setBusy('Leyendo el link…')
        jobText = await fetchJobFromUrl(url)
      }
      if (source === 'image') {
        if (!image) throw new Error('Sube o pega el flyer primero ✿')
        if (!aiOn) {
          setBusy('Leyendo el flyer (OCR)… 0%')
          jobText = await ocrImage(image, (p) => setBusy(`Leyendo el flyer (OCR)… ${Math.round(p * 100)}%`))
        }
      }
      if (source === 'text' && !text.trim()) throw new Error('Pega el texto de la vacante ✿')

      const guess = guessTitleCompany(jobText)
      const base = {
        id: uid('app'),
        createdAt: new Date().toISOString(),
        lang,
        job: { title: title || guess.title, company: company || guess.company, sourceType: source, source: source === 'link' ? url : source === 'image' ? 'flyer' : 'texto', text: jobText },
      }

      let result: Application
      if (aiOn) {
        setBusy('La IA está tejiendo tu CV y carta… ✦')
        const r = await generateWithAI(settings, profile, {
          jobText,
          imageDataUrl: source === 'image' ? image : undefined,
          title,
          company,
          lang,
          forcedTrack: track || undefined,
          extra,
        })
        result = { ...base, mode: 'ai', track: r.track, job: { ...base.job, title: r.jobTitle || base.job.title, company: r.company || base.job.company }, cv: r.cv, letter: r.letter, notes: [r.jobSummary, ...r.notes].filter(Boolean) }
      } else {
        setBusy('Armando tu CV y carta…')
        const r = generateLocal(profile, { jobText, title: base.job.title, company: base.job.company, forcedTrack: track || undefined })
        result = { ...base, mode: 'local', track: r.track, cv: r.cv, letter: r.letter, notes: lang === 'en' ? [...r.notes, 'El modo local solo redacta en español; activa IA para inglés.'] : r.notes }
        result.lang = 'es'
      }
      setApp(result)
      setDocKey((k) => k + 1)
      setView('cv')
      setHistory([result, ...history].slice(0, 30))
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  function fileBase(kind: string) {
    const c = (app?.job.company || app?.job.title || 'aplicacion').replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)
    return `${kind}_Antu_Coss_${c}`
  }

  function printDoc(which: 'cv' | 'letter') {
    const prev = document.title
    document.title = fileBase(which === 'cv' ? 'CV' : 'Carta')
    document.body.dataset.print = which
    const done = () => {
      document.title = prev
      delete document.body.dataset.print
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    setTimeout(() => window.print(), 50)
  }

  async function copyDoc(which: 'cv' | 'letter') {
    const el = which === 'cv' ? cvRef.current : letterRef.current
    if (!el) return
    await navigator.clipboard.writeText(el.innerText)
    setToast('Copiado al portapapeles ♡')
  }

  function downloadDoc(which: 'cv' | 'letter') {
    const el = which === 'cv' ? cvRef.current : letterRef.current
    if (!el) return
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent)
      .join('\n')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${fileBase(which === 'cv' ? 'CV' : 'Carta')}</title><style>${css}</style></head><body class="standalone">${el.outerHTML.replace(/contenteditable="true"/g, '')}</body></html>`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'application/msword' }))
    a.download = `${fileBase(which === 'cv' ? 'CV' : 'Carta')}.doc`
    a.click()
  }

  function saveEntry(e: Entry) {
    const exists = profile.entries.some((x) => x.id === e.id)
    setProfile({ ...profile, entries: exists ? profile.entries.map((x) => (x.id === e.id ? e : x)) : [e, ...profile.entries] })
    setModal(editing ? 'db' : null)
    setEditing(undefined)
    setToast(exists ? 'Entrada actualizada ✿' : '¡Nueva experiencia guardada en la base! ✿')
  }

  const trackLabel = (id: TrackId) => profile.tracks.find((t) => t.id === id)?.label ?? id

  return (
    <div className="app">
      <div className="bubbles" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>

      <header className="top">
        <div className="brand">
          <Mascot mood={busy ? 'think' : 'happy'} />
          <div>
            <h1>
              Antu <span>CV</span> Studio
            </h1>
            <p>CVs y cartas de presentación a la medida ✦ powered by Ethercoded</p>
          </div>
        </div>
        <nav>
          <button className="btn pink" onClick={() => (setEditing(undefined), setModal('add'))}>
            + Nueva experiencia
          </button>
          <button className="btn ghost" onClick={() => setModal('db')}>
            ♡ Base de datos
          </button>
          <button className={`btn ghost ${aiOn ? 'ok' : ''}`} onClick={() => setModal('settings')}>
            {aiOn ? '✧ IA conectada' : '✧ Ajustes IA'}
          </button>
        </nav>
      </header>

      <main>
        <section className="card input-card">
          <h2>
            <span className="num">1</span> ¿A qué oportunidad vas a aplicar?
          </h2>
          <div className="seg">
            {(
              [
                ['link', '⌁ Link'],
                ['image', '✿ Flyer / foto'],
                ['text', '✎ Texto'],
              ] as [Source, string][]
            ).map(([k, l]) => (
              <button key={k} className={source === k ? 'on' : ''} onClick={() => setSource(k)}>
                {l}
              </button>
            ))}
          </div>

          {source === 'link' && (
            <input className="big-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… link de la vacante, convocatoria o residencia" />
          )}
          {source === 'image' && (
            <label
              className={`drop ${image ? 'has' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) void loadImage(f)
              }}
            >
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0])} />
              {image ? (
                <img src={image} alt="Flyer" />
              ) : (
                <span>
                  <b>Arrastra, pega (Ctrl+V) o haz clic</b>
                  <br />
                  para subir el flyer o captura de la oportunidad
                </span>
              )}
            </label>
          )}
          {source === 'text' && (
            <textarea className="big-input" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí la descripción de la vacante, requisitos, convocatoria…" />
          )}

          <div className="grid2">
            <label>
              Puesto (opcional)
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Se detecta solo" />
            </label>
            <label>
              Empresa (opcional)
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Se detecta solo" />
            </label>
            <label>
              Perfil a enfatizar
              <select value={track} onChange={(e) => setTrack(e.target.value as TrackId | '')}>
                <option value="">✦ Automático</option>
                {profile.tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Idioma
              <div className="seg mini">
                <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>
                  Español
                </button>
                <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
                  English
                </button>
              </div>
            </label>
          </div>
          {aiOn && (
            <label>
              Instrucciones extra (opcional)
              <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ej: enfatiza liderazgo, tono más formal, menciona disponibilidad para mudarme…" />
            </label>
          )}

          <button className="btn mega" onClick={generate} disabled={!!busy}>
            {busy || '✦ Generar CV + carta ✦'}
          </button>
          {!aiOn && (
            <p className="hint center">
              Modo local activo · <a onClick={() => setModal('settings')}>conecta IA</a> para lectura de flyers y redacción 100% personalizada
            </p>
          )}
          {error && <p className="err">{error}</p>}
        </section>

        <aside className="card history">
          <h2>
            <span className="num">♡</span> Historial
          </h2>
          {history.length === 0 && <p className="muted">Aquí aparecerán tus aplicaciones generadas.</p>}
          {history.map((h) => (
            <div key={h.id} className={`hist-row ${app?.id === h.id ? 'on' : ''}`} onClick={() => (setApp(h), setDocKey((k) => k + 1))}>
              <div>
                <b>{h.job.title || 'Sin título'}</b>
                <div className="muted small">
                  {h.job.company || '—'} · {trackLabel(h.track)} · {new Date(h.createdAt).toLocaleDateString('es-MX')}
                </div>
              </div>
              <button
                className="icon-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setHistory(history.filter((x) => x.id !== h.id))
                  if (app?.id === h.id) setApp(null)
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="stats">
            <div>
              <b>{profile.entries.filter((e) => e.kind === 'experience').length}</b>
              <span>experiencias</span>
            </div>
            <div>
              <b>{profile.entries.filter((e) => e.kind === 'project').length}</b>
              <span>proyectos</span>
            </div>
            <div>
              <b>{profile.tracks.length}</b>
              <span>perfiles</span>
            </div>
          </div>
        </aside>

        {app && (
          <section className="card results" ref={resultsRef}>
            <div className="results-head">
              <h2>
                <span className="num">2</span> {app.job.title || 'Tu aplicación'} {app.job.company && <small>@ {app.job.company}</small>}
              </h2>
              <span className={`badge ${app.mode}`}>
                {app.mode === 'ai' ? 'IA' : 'Local'} · {trackLabel(app.track)}
              </span>
            </div>
            <div className="seg">
              <button className={view === 'cv' ? 'on' : ''} onClick={() => setView('cv')}>
                CV
              </button>
              <button className={view === 'letter' ? 'on' : ''} onClick={() => setView('letter')}>
                Carta de presentación
              </button>
              <button className={view === 'notes' ? 'on' : ''} onClick={() => setView('notes')}>
                Tips ({app.notes.length})
              </button>
            </div>
            {view !== 'notes' && (
              <div className="doc-toolbar">
                <span className="hint">Haz clic sobre el documento para editarlo antes de descargar ✎</span>
                <div>
                  <button className="btn small" onClick={() => printDoc(view)}>
                    ⬇ PDF
                  </button>
                  <button className="btn small ghost" onClick={() => downloadDoc(view)}>
                    ⬇ Word
                  </button>
                  <button className="btn small ghost" onClick={() => copyDoc(view)}>
                    ⧉ Copiar
                  </button>
                </div>
              </div>
            )}
            <div className="paper-wrap" key={docKey}>
              <CvDoc ref={cvRef} profile={profile} cv={app.cv} lang={app.lang} className={`print-cv ${view === 'cv' ? '' : 'hidden'}`} />
              <LetterDoc ref={letterRef} profile={profile} letter={app.letter} title={app.cv.title} lang={app.lang} className={`print-letter ${view === 'letter' ? '' : 'hidden'}`} />
              {view === 'notes' && (
                <ul className="notes">
                  {app.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>

      <footer>
        hecho con ♡ para Antu Coss · <a href="https://ethercoded.com">ethercoded.com</a> · <a href="https://antucoss.xyz">antucoss.xyz</a>
      </footer>

      {modal === 'add' && <EntryEditor profile={profile} settings={settings} initial={editing} onSave={saveEntry} onClose={() => (setModal(editing ? 'db' : null), setEditing(undefined))} />}
      {modal === 'db' && (
        <DbPanel
          profile={profile}
          setProfile={setProfile}
          onAdd={() => (setEditing(undefined), setModal('add'))}
          onEdit={(e) => (setEditing(e), setModal('add'))}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'settings' && <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setModal(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
