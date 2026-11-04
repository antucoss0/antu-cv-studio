import { useRef, useState, type ReactNode } from 'react'
import type { Entry, EntryKind, Profile, Settings, TrackId } from '../types'
import { structureEntryWithAI, testConnection } from '../lib/ai'
import { cloneSeed, defaultModels, uid } from '../lib/store'
import { period } from '../lib/local'

export const KIND_LABEL: Record<EntryKind, string> = {
  experience: 'Experiencia',
  project: 'Proyecto',
  education: 'Educación',
  certification: 'Certificación / logro',
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function TrackChips({ profile, value, onChange }: { profile: Profile; value: TrackId[]; onChange: (v: TrackId[]) => void }) {
  return (
    <div className="chips">
      {profile.tracks.map((t) => (
        <button
          type="button"
          key={t.id}
          className={`chip ${value.includes(t.id) ? 'on' : ''}`}
          onClick={() => onChange(value.includes(t.id) ? value.filter((x) => x !== t.id) : [...value, t.id])}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

const emptyEntry = (): Entry => ({ id: uid('usr'), kind: 'experience', title: '', org: '', start: '', end: 'Presente', location: '', url: '', bullets: [], tags: [], keywords: [] })

export function EntryEditor({
  profile,
  settings,
  initial,
  onSave,
  onClose,
}: {
  profile: Profile
  settings: Settings
  initial?: Entry
  onSave: (e: Entry) => void
  onClose: () => void
}) {
  const [e, setE] = useState<Entry>(initial ?? emptyEntry())
  const [bulletsText, setBulletsText] = useState((initial?.bullets ?? []).join('\n'))
  const [free, setFree] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (patch: Partial<Entry>) => setE((p) => ({ ...p, ...patch }))
  const aiOn = settings.provider !== 'none' && settings.apiKey

  async function structure() {
    setBusy(true)
    setErr('')
    try {
      const r = await structureEntryWithAI(settings, free)
      const tags = (r.tags ?? []).filter((t): t is TrackId => profile.tracks.some((x) => x.id === t))
      setE((p) => ({ ...p, ...r, id: p.id, tags, bullets: r.bullets ?? [] }))
      setBulletsText((r.bullets ?? []).join('\n'))
    } catch (x) {
      setErr(String((x as Error).message))
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (!e.title.trim()) {
      setErr('Ponle al menos un título ✿')
      return
    }
    const bullets = bulletsText
      .split('\n')
      .map((b) => b.replace(/^[•\-*\s]+/, '').trim())
      .filter(Boolean)
    onSave({ ...e, bullets, tags: e.tags.length ? e.tags : [] })
  }

  return (
    <Modal title={initial ? 'Editar entrada' : '✦ Nueva experiencia o logro'} onClose={onClose} wide>
      {!initial && (
        <div className="free-box">
          <label>Cuéntamelo con tus palabras (opcional)</label>
          <textarea
            rows={4}
            placeholder="Ej: Desde marzo 2026 soy director creativo en Ethercoded para el proyecto X, hice un museo virtual con Three.js y Gaussian Splatting para 5,000 visitantes..."
            value={free}
            onChange={(ev) => setFree(ev.target.value)}
          />
          <button className="btn small" disabled={!free.trim() || busy || !aiOn} onClick={structure}>
            {busy ? 'Ordenando…' : '✦ Ordenar con IA'}
          </button>
          {!aiOn && <span className="hint"> Activa una API key en Ajustes IA para ordenar texto libre automáticamente.</span>}
        </div>
      )}
      <div className="grid2">
        <label>
          Tipo
          <select value={e.kind} onChange={(ev) => set({ kind: ev.target.value as EntryKind })}>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Título / rol *
          <input value={e.title} onChange={(ev) => set({ title: ev.target.value })} placeholder="Creative Technologist" />
        </label>
        <label>
          Empresa / proyecto
          <input value={e.org ?? ''} onChange={(ev) => set({ org: ev.target.value })} placeholder="Ethercoded" />
        </label>
        <label>
          Link
          <input value={e.url ?? ''} onChange={(ev) => set({ url: ev.target.value })} placeholder="https://" />
        </label>
        <label>
          Inicio
          <input value={e.start ?? ''} onChange={(ev) => set({ start: ev.target.value })} placeholder="2026" />
        </label>
        <label>
          Fin
          <input value={e.end ?? ''} onChange={(ev) => set({ end: ev.target.value })} placeholder="Presente" />
        </label>
      </div>
      <label>
        Logros / responsabilidades (uno por línea)
        <textarea rows={5} value={bulletsText} onChange={(ev) => setBulletsText(ev.target.value)} />
      </label>
      <label>
        Palabras clave (separadas por coma)
        <input value={(e.keywords ?? []).join(', ')} onChange={(ev) => set({ keywords: ev.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <label>¿Para qué perfiles es relevante?</label>
      <TrackChips profile={profile} value={e.tags} onChange={(tags) => set({ tags })} />
      {err && <p className="err">{err}</p>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn" onClick={save}>
          Guardar en la base ♡
        </button>
      </div>
    </Modal>
  )
}

export function DbPanel({
  profile,
  setProfile,
  onEdit,
  onAdd,
  onClose,
}: {
  profile: Profile
  setProfile: (p: Profile) => void
  onEdit: (e: Entry) => void
  onAdd: () => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState<TrackId | 'all'>('all')
  const [tab, setTab] = useState<'entries' | 'contact' | 'tracks'>('entries')
  const fileRef = useRef<HTMLInputElement>(null)
  const list = profile.entries.filter((e) => filter === 'all' || e.tags.includes(filter))

  function exportJson() {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `antu-cv-db-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  async function importJson(f: File) {
    try {
      const p = JSON.parse(await f.text()) as Profile
      if (!p.entries || !p.tracks) throw new Error('Formato inválido')
      setProfile(p)
    } catch (x) {
      alert(`No pude importar: ${(x as Error).message}`)
    }
  }

  return (
    <Modal title="♡ Base de datos de Antu" onClose={onClose} wide>
      <div className="tabs">
        <button className={tab === 'entries' ? 'on' : ''} onClick={() => setTab('entries')}>
          Experiencias ({profile.entries.length})
        </button>
        <button className={tab === 'tracks' ? 'on' : ''} onClick={() => setTab('tracks')}>
          Perfiles ({profile.tracks.length})
        </button>
        <button className={tab === 'contact' ? 'on' : ''} onClick={() => setTab('contact')}>
          Contacto & skills
        </button>
      </div>

      {tab === 'entries' && (
        <>
          <div className="db-toolbar">
            <select value={filter} onChange={(e) => setFilter(e.target.value as TrackId | 'all')}>
              <option value="all">Todos los perfiles</option>
              {profile.tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button className="btn small" onClick={onAdd}>
              + Agregar
            </button>
          </div>
          <div className="db-list">
            {(['experience', 'project', 'education', 'certification'] as EntryKind[]).map((k) => {
              const items = list.filter((e) => e.kind === k)
              if (!items.length) return null
              return (
                <div key={k}>
                  <h4>{KIND_LABEL[k]}</h4>
                  {items.map((e) => (
                    <div key={e.id} className="db-row">
                      <div>
                        <b>{e.title}</b> {e.org && <span className="muted">— {e.org}</span>}
                        <div className="muted small">
                          {period(e)} {e.tags.map((t) => `#${t}`).join(' ')}
                        </div>
                      </div>
                      <div className="row-actions">
                        <button className="icon-btn" title="Editar" onClick={() => onEdit(e)}>
                          ✎
                        </button>
                        <button
                          className="icon-btn"
                          title="Borrar"
                          onClick={() => confirm(`¿Borrar "${e.title}"?`) && setProfile({ ...profile, entries: profile.entries.filter((x) => x.id !== e.id) })}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'tracks' && (
        <div className="db-list">
          {profile.tracks.map((t, i) => (
            <div key={t.id} className="track-edit">
              <label>
                {t.label} — titular
                <input
                  value={t.title}
                  onChange={(ev) => {
                    const tracks = [...profile.tracks]
                    tracks[i] = { ...t, title: ev.target.value }
                    setProfile({ ...profile, tracks })
                  }}
                />
              </label>
              <label>
                Resumen
                <textarea
                  rows={3}
                  value={t.summary}
                  onChange={(ev) => {
                    const tracks = [...profile.tracks]
                    tracks[i] = { ...t, summary: ev.target.value }
                    setProfile({ ...profile, tracks })
                  }}
                />
              </label>
            </div>
          ))}
        </div>
      )}

      {tab === 'contact' && (
        <div className="db-list">
          <div className="grid2">
            {(['name', 'fullName', 'email', 'phone', 'location'] as const).map((k) => (
              <label key={k}>
                {{ name: 'Nombre', fullName: 'Nombre completo', email: 'Email', phone: 'Teléfono', location: 'Ubicación' }[k]}
                <input value={profile[k]} onChange={(ev) => setProfile({ ...profile, [k]: ev.target.value })} />
              </label>
            ))}
            <label>
              Idiomas (uno por línea)
              <textarea rows={2} value={profile.languages.join('\n')} onChange={(ev) => setProfile({ ...profile, languages: ev.target.value.split('\n') })} />
            </label>
          </div>
          <label>
            Links (Etiqueta | URL, uno por línea)
            <textarea
              rows={4}
              value={profile.links.map((l) => `${l.label} | ${l.url}`).join('\n')}
              onChange={(ev) =>
                setProfile({
                  ...profile,
                  links: ev.target.value
                    .split('\n')
                    .map((l) => l.split('|').map((s) => s.trim()))
                    .filter((p) => p[0])
                    .map(([label, url]) => ({ label, url: url ?? '' })),
                })
              }
            />
          </label>
          <h4>Grupos de skills</h4>
          {profile.skills.map((g, i) => (
            <label key={g.id}>
              {g.name}
              <input
                value={g.items.join(', ')}
                onChange={(ev) => {
                  const skills = [...profile.skills]
                  skills[i] = { ...g, items: ev.target.value.split(',').map((s) => s.trim()).filter(Boolean) }
                  setProfile({ ...profile, skills })
                }}
              />
            </label>
          ))}
        </div>
      )}

      <div className="modal-actions">
        <button className="btn ghost small" onClick={exportJson}>
          ⬇ Exportar JSON
        </button>
        <button className="btn ghost small" onClick={() => fileRef.current?.click()}>
          ⬆ Importar JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        <button className="btn ghost small" onClick={() => confirm('¿Restaurar la base original? Se perderán tus cambios.') && setProfile(cloneSeed())}>
          ↺ Restaurar original
        </button>
      </div>
    </Modal>
  )
}

export function SettingsModal({ settings, setSettings, onClose }: { settings: Settings; setSettings: (s: Settings) => void; onClose: () => void }) {
  const [s, setS] = useState(settings)
  const [status, setStatus] = useState('')
  async function test() {
    setStatus('Probando…')
    try {
      setStatus((await testConnection(s)) ? '¡Conectado! ✿' : 'Respuesta inesperada')
    } catch (x) {
      setStatus(`Error: ${(x as Error).message}`)
    }
  }
  return (
    <Modal title="✧ Ajustes de IA" onClose={onClose}>
      <p className="muted">
        La IA lee flyers, entiende la vacante y redacta el CV y la carta a la medida. Tu key se guarda solo en este navegador. Sin key funciona el modo
        local (OCR + palabras clave + plantilla).
      </p>
      <label>
        Proveedor
        <select
          value={s.provider}
          onChange={(e) => {
            const provider = e.target.value as Settings['provider']
            setS({ ...s, provider, model: defaultModels[provider] })
          }}
        >
          <option value="none">Sin IA (modo local)</option>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI (GPT)</option>
        </select>
      </label>
      {s.provider !== 'none' && (
        <>
          <label>
            API key
            <input type="password" value={s.apiKey} onChange={(e) => setS({ ...s, apiKey: e.target.value.trim() })} placeholder={s.provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'} />
          </label>
          <label>
            Modelo
            <input value={s.model} onChange={(e) => setS({ ...s, model: e.target.value.trim() })} />
          </label>
        </>
      )}
      {status && <p className="muted">{status}</p>}
      <div className="modal-actions">
        {s.provider !== 'none' && (
          <button className="btn ghost" onClick={test} disabled={!s.apiKey}>
            Probar conexión
          </button>
        )}
        <button
          className="btn"
          onClick={() => {
            setSettings(s)
            onClose()
          }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  )
}
