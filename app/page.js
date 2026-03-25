'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const sC = s => s >= 90 ? '#22C55E' : s >= 80 ? '#06B6D4' : s >= 70 ? '#F59E0B' : '#5A5E73'
const stC = s => s === 'Nuevo' ? '#22C55E' : s === 'Update' ? '#F59E0B' : '#3B82F6'
const stBg = s => s === 'Nuevo' ? 'rgba(34,197,94,0.12)' : s === 'Update' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)'

function ScoreRing({ score, size = 38 }) {
  const r = (size - 3) / 2, circ = 2 * Math.PI * r, off = circ - (score / 100) * circ
  const fs = size > 45 ? 18 : size > 32 ? 13 : 11
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={sC(score)} strokeWidth={2.5}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: fs, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: sC(score) }}>{score}</span>
    </div>
  )
}

function Badge({ status }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20,
      fontSize: 10, fontWeight: 600, color: stC(status), background: stBg(status) }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: stC(status) }} />
      {status}
    </span>
  )
}

function Tag({ children, color = 'var(--accent)' }) {
  return <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
    color, background: color + '15', border: `1px solid ${color}20` }}>{children}</span>
}

function Card({ children, onClick, style = {} }) {
  return (
    <div onClick={onClick} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 18, cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.15s', ...style }}>
      {children}
    </div>
  )
}

export default function Home() {
  const [brief, setBrief] = useState(null)
  const [items, setItems] = useState([])
  const [trends, setTrends] = useState([])
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [view, setView] = useState('home')
  const [playing, setPlaying] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [fCat, setFCat] = useState('all')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    // Get latest brief
    const { data: briefs } = await supabase
      .from('daily_briefs')
      .select('*')
      .eq('status', 'published')
      .order('date', { ascending: false })
      .limit(1)

    if (briefs && briefs.length > 0) {
      const b = briefs[0]
      setBrief(b)

      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('brief_id', b.id)
        .order('score', { ascending: false })

      const { data: trendsData } = await supabase
        .from('trends')
        .select('*')
        .eq('brief_id', b.id)
        .order('strength', { ascending: false })

      setItems(itemsData || [])
      setTrends(trendsData || [])
    }

    const { data: sourcesData } = await supabase
      .from('sources')
      .select('*')
      .order('tier', { ascending: true })

    setSources(sourcesData || [])
    setLoading(false)
  }

  // TTS with Web Speech API (free)
  function speakText(text) {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-MX'
    utterance.rate = 1.0
    utterance.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  const cats = [...new Set(items.map(i => i.category).filter(Boolean))]
  const filtered = fCat === 'all' ? items : items.filter(i => i.category === fCat)
  const top5 = items.slice(0, 5)
  const mxItems = items.filter(i => i.mexico_relevance >= 70).sort((a, b) => b.mexico_relevance - a.mexico_relevance)
  const briefDate = brief ? new Date(brief.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''

  const navItems = [
    { id: 'home', label: '📡 Daily Brief' },
    { id: 'radar', label: '🎯 Opportunity Radar' },
    { id: 'trends', label: '📈 Tendencias' },
    { id: 'mexico', label: '🇲🇽 México Lens' },
    { id: 'audio', label: '🎧 Audio' },
    { id: 'sources', label: '📚 Fuentes' },
  ]

  // Detail Modal
  const Detail = () => {
    if (!sel) return null
    const i = sel
    return (
      <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        justifyContent: 'center', paddingTop: 32, paddingBottom: 32, overflowY: 'auto',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
        <div onClick={e => e.stopPropagation()} className="slide-up"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
            width: '100%', maxWidth: 700, margin: '0 16px', padding: 28, position: 'relative', alignSelf: 'flex-start' }}>
          <button onClick={() => setSel(null)} style={{ position: 'absolute', top: 14, right: 14, background: 'none',
            border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>

          <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
            <ScoreRing score={i.score} size={52} />
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <Badge status={i.status} /><Tag color="#06B6D4">{i.category}</Tag><Tag>{i.region}</Tag>
              </div>
              <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.3 }}>{i.title}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>{i.date} · Confianza: {i.confidence}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <Sec label="Resumen Ejecutivo" color="var(--accent)">{i.summary}</Sec>
            <Sec label="Por qué importa" color="var(--amber)">{i.why_it_matters}</Sec>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--green-muted)', borderRadius: 10, padding: 14 }}>
                <h4 style={{ color: 'var(--green)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>SEÑALES A FAVOR</h4>
                {(i.signals || []).map((s, j) => <p key={j} style={{ color: 'var(--text)', fontSize: 12, lineHeight: 1.5, marginBottom: 4, paddingLeft: 10, borderLeft: '2px solid rgba(34,197,94,0.3)' }}>{s}</p>)}
              </div>
              <div style={{ background: 'var(--red-muted)', borderRadius: 10, padding: 14 }}>
                <h4 style={{ color: 'var(--red)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>RIESGOS</h4>
                {(i.risks || []).map((r, j) => <p key={j} style={{ color: 'var(--text)', fontSize: 12, lineHeight: 1.5, marginBottom: 4, paddingLeft: 10, borderLeft: '2px solid rgba(239,68,68,0.3)' }}>{r}</p>)}
              </div>
            </div>

            <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span>🇲🇽</span>
                <h4 style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>MÉXICO LENS</h4>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: sC(i.mexico_relevance) }}>
                  Relevancia: {i.mexico_relevance}/100
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                {[['¿Existe en MX?', i.mx_exists], ['Barrera', i.mx_barrier], ['Timing', i.mx_timing], ['Buyer', i.mx_buyer]].map(([l, v], j) => (
                  <div key={j}><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{l}</span><br /><span style={{ color: 'var(--text)' }}>{v || 'N/A'}</span></div>
                ))}
              </div>
              {i.mx_defendible && <div style={{ marginTop: 8 }}><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Defendibilidad</span><p style={{ color: 'var(--text)', fontSize: 12, marginTop: 2 }}>{i.mx_defendible}</p></div>}
            </div>

            <Sec label="⚡ Oportunidad de Negocio" color="var(--green)">{i.opportunity}</Sec>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {(i.tags || []).map((t, j) => <Tag key={j}>{t}</Tag>)}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 10 }}>Fuentes: {(i.sources_used || []).join(', ')}</p>
          </div>
        </div>
      </div>
    )
  }

  const Sec = ({ label, color, children }) => (
    <div>
      <h4 style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</h4>
      <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.7 }}>{children}</p>
    </div>
  )

  const ItemCard = ({ item, compact }) => (
    <Card onClick={() => setSel(item)}>
      <div style={{ display: 'flex', gap: 12 }}>
        <ScoreRing score={item.score} size={compact ? 30 : 38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
            <Badge status={item.status} />
            <Tag color="#06B6D4">{item.category}</Tag>
            {item.mexico_relevance >= 85 && <Tag color="#22C55E">MX {item.mexico_relevance}</Tag>}
          </div>
          <h3 style={{ fontSize: compact ? 13 : 15, fontWeight: 500, lineHeight: 1.4, marginBottom: compact ? 0 : 5 }}>{item.title}</h3>
          {!compact && <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.summary}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
            <span>{item.date}</span><span>·</span><span>{item.region}</span>
          </div>
        </div>
      </div>
    </Card>
  )

  const Pill = ({ children, active, onClick }) => (
    <button onClick={onClick} style={{ padding: '5px 13px', borderRadius: 20, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
      {children}
    </button>
  )

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando briefing...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // No brief yet
  if (!brief) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 32 }}>
        <h1 style={{ fontFamily: "Georgia,serif", fontSize: 36, fontStyle: 'italic' }}>Signal</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, textAlign: 'center', maxWidth: 400 }}>
          Aún no hay un briefing disponible. El primer briefing se generará automáticamente mañana a las 7:00 AM CDMX.
        </p>
        <button onClick={async () => {
          setLoading(true)
          await fetch(`/api/generate-brief?secret=${encodeURIComponent('signal-cron-2026-secure')}`, { method: 'POST' })
          await loadData()
        }} style={{ marginTop: 16, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px 24px',
          color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          Generar primer briefing ahora
        </button>
      </div>
    )
  }

  // ─── VIEWS ─────────────────────────────────
  const renderHome = () => (
    <div style={{ display: 'grid', gap: 28 }}>
      <div style={{ borderRadius: 16, padding: '36px 28px', background: 'linear-gradient(135deg, var(--card) 0%, #141530 50%, var(--card) 100%)',
        border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <p style={{ color: 'var(--accent)', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Intelligence Briefing</p>
        <h1 style={{ fontFamily: "Georgia,serif", fontSize: 32, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.2, marginBottom: 8 }}>{briefDate}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, maxWidth: 560 }}>{brief.opening}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={() => setView('audio')} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, boxShadow: '0 2px 16px rgba(99,102,241,0.3)' }}>
            🎧 Escuchar Briefing
          </button>
        </div>
      </div>

      {top5.length > 0 && <div>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: 24, fontStyle: 'italic', marginBottom: 16 }}>⚡ Top Movimientos</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {top5.map((item, idx) => (
            <div key={item.id} className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${idx * 0.08}s` }}>
              <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: 'rgba(99,102,241,0.3)', width: 28, textAlign: 'right' }}>{String(idx + 1).padStart(2, '0')}</span>
              <div style={{ flex: 1 }}><ItemCard item={item} compact /></div>
            </div>
          ))}
        </div>
      </div>}

      {trends.length > 0 && <div>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: 24, fontStyle: 'italic', marginBottom: 16 }}>📈 Tendencias Emergentes</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {trends.slice(0, 4).map(t => (
            <Card key={t.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 22, color: sC(t.strength) }}>{t.strength}</span>
                <span style={{ color: '#22C55E', fontSize: 11 }}>↑ {t.weeks_active}w</span>
              </div>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{t.name}</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5 }}>{t.description}</p>
            </Card>
          ))}
        </div>
      </div>}

      {brief.mexico_lens && <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: 22 }}>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: 24, fontStyle: 'italic', marginBottom: 10 }}>🇲🇽 México Lens</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>{brief.mexico_lens}</p>
      </div>}

      {brief.closing && <Card>
        <h4 style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Cierre — Qué vigilar</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>{brief.closing}</p>
      </Card>}
    </div>
  )

  const renderRadar = () => (
    <div style={{ display: 'grid', gap: 20 }}>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 26, fontStyle: 'italic' }}>🎯 Opportunity Radar</h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Pill active={fCat === 'all'} onClick={() => setFCat('all')}>Todas</Pill>
        {cats.map(c => <Pill key={c} active={fCat === c} onClick={() => setFCat(c)}>{c}</Pill>)}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.sort((a, b) => b.score - a.score).map(i => <ItemCard key={i.id} item={i} />)}
      </div>
    </div>
  )

  const renderTrends = () => (
    <div style={{ display: 'grid', gap: 20 }}>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 26, fontStyle: 'italic' }}>📈 Trend Explorer</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {trends.map(t => (
          <Card key={t.id}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 26, color: sC(t.strength) }}>{t.strength}</span>
                <div style={{ color: '#22C55E', fontSize: 10, marginTop: 2 }}>↑ {t.weeks_active}w</div>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>{t.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>{t.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderMexico = () => (
    <div style={{ display: 'grid', gap: 20 }}>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 26, fontStyle: 'italic' }}>🇲🇽 México Opportunity Lens</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
        {[
          { l: 'No existe en MX', n: items.filter(i => i.mx_exists?.toLowerCase().startsWith('no')).length, c: '#22C55E' },
          { l: 'Relevancia ≥90', n: items.filter(i => i.mexico_relevance >= 90).length, c: 'var(--accent)' },
          { l: 'Timing: Ahora', n: items.filter(i => i.mx_timing?.toLowerCase().includes('ahora')).length, c: '#06B6D4' },
        ].map((s, j) => (
          <Card key={j} style={{ textAlign: 'center', padding: 14 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: s.c }}>{s.n}</span>
            <p style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>{s.l}</p>
          </Card>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {mxItems.map(i => (
          <Card key={i.id} onClick={() => setSel(i)} style={{ borderLeft: `3px solid ${sC(i.mexico_relevance)}` }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)' }}>MX</span>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 22, color: sC(i.mexico_relevance) }}>{i.mexico_relevance}</div>
              </div>
              <div style={{ flex: 1 }}>
                <Badge status={i.status} />
                <h3 style={{ fontSize: 14, fontWeight: 500, marginTop: 4, marginBottom: 5 }}>{i.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>{i.opportunity}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderAudio = () => (
    <div style={{ display: 'grid', gap: 20 }}>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 26, fontStyle: 'italic' }}>🎧 Audio Briefing</h2>
      <Card style={{ background: 'linear-gradient(135deg, var(--card), var(--elevated))' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 58, height: 58, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), #A855F7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 24 }}>🎧</div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Briefing Diario</p>
            <h3 style={{ fontSize: 17, fontFamily: "Georgia,serif", fontStyle: 'italic' }}>{briefDate}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>~30 min · Voz del navegador</p>
          </div>
        </div>
        <button onClick={() => brief.audio_script && speakText(brief.audio_script)}
          style={{ width: '100%', padding: '14px', background: speaking ? 'var(--red)' : 'var(--accent)', border: 'none', borderRadius: 10,
            color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>
          {speaking ? '⏸ Detener Audio' : '▶ Reproducir Briefing'}
        </button>
      </Card>
      {brief.audio_script && <Card>
        <h4 style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Guion del Audio</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8, maxHeight: 400, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
          {brief.audio_script}
        </p>
      </Card>}
      {!brief.audio_script && <Card>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
          El guion de audio se está generando. Estará disponible pronto.
        </p>
      </Card>}
    </div>
  )

  const renderSources = () => (
    <div style={{ display: 'grid', gap: 20 }}>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 26, fontStyle: 'italic' }}>📚 Source Registry</h2>
      {[1, 2, 3].map(tier => {
        const tierSources = sources.filter(s => s.tier === tier)
        if (tierSources.length === 0) return null
        return (
          <div key={tier}>
            <h3 style={{ color: tier === 1 ? '#22C55E' : tier === 2 ? '#F59E0B' : 'var(--text-muted)', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Tier {tier} {tier === 1 ? '— Core Signal' : tier === 2 ? '— Expansion' : '— Reference'}
            </h3>
            <div style={{ display: 'grid', gap: 4 }}>
              {tierSources.map(s => (
                <Card key={s.id} style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.active ? '#22C55E' : '#EF4444', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                      <Tag>{s.region}</Tag>
                      <Tag color="#A855F7">{s.type}</Tag>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                      {s.method} · {s.frequency} · {s.url}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: sC(s.credibility) }}>{s.credibility}</div>
                    <div style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cred.</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )

  const viewMap = { home: renderHome, radar: renderRadar, trends: renderTrends, mexico: renderMexico, audio: renderAudio, sources: renderSources }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: 200, flexShrink: 0, background: 'var(--card)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 400, fontStyle: 'italic' }}>Signal</h1>
          <p style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Intelligence Scouting</p>
        </div>
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {navItems.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{
              display: 'block', width: '100%', border: 'none', textAlign: 'left',
              padding: '10px 14px', background: view === n.id ? 'var(--accent-glow)' : 'transparent',
              color: view === n.id ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: view === n.id ? 600 : 400,
              fontFamily: "'DM Sans',system-ui,sans-serif",
              borderRight: view === n.id ? '2px solid var(--accent)' : '2px solid transparent',
            }}>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: 14, borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text-muted)' }}>
          <p>Signal v1.0</p>
          <p style={{ marginTop: 2 }}>Actualización diaria 7am CDMX</p>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '22px 28px', maxWidth: 880 }}>
        {viewMap[view]?.() || renderHome()}
      </main>

      <Detail />
    </div>
  )
}
