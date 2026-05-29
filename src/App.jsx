import React, { useState, useEffect, useCallback } from 'react';

// ── Proteção anti-debug (produção) ───────────────────────────────────────────
if (typeof window !== 'undefined' && import.meta.env?.PROD) {
  ['log','info','warn','debug','error','table','dir'].forEach(m => { window.console[m] = () => {}; });
  setInterval(() => { debugger; }, 1500);
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'U')) e.preventDefault();
  });
}

// ── Constantes ────────────────────────────────────────────────────────────────
const PRAZO_HORAS = { Alta: { Alta: 16, Média: 8, Baixa: 4 }, Média: { Alta: 48, Média: 24, Baixa: 12 }, Baixa: { Alta: 72, Média: 48, Baixa: 24 } };
const CRITICIDADE_INFO = {
  Alta:  { label: 'Indisponibilidade total do sistema',              icon: '🔴', desc: 'O sistema está completamente fora do ar ou inacessível para todos os usuários.' },
  Média: { label: 'Falhas parciais ou em módulos secundários',       icon: '🟡', desc: 'Parte do sistema apresenta falhas, mas a operação principal continua funcionando.' },
  Baixa: { label: 'Impacto baixo, sem prejuízo imediato à operação', icon: '🟢', desc: 'Problema de baixo impacto, pode aguardar atendimento dentro do prazo normal.' }
};
const STATUS_COLOR = { 'ABERTO': '#F59E0B', 'EM ANALISE': '#3B82F6', 'AGUARDANDO VALIDACAO': '#8B5CF6', 'CONCLUIDO': '#10B981' };
const STATUS_LABEL = { 'ABERTO': 'Aberto', 'EM ANALISE': 'Em Análise', 'AGUARDANDO VALIDACAO': 'Aguard. Validação', 'CONCLUIDO': 'Concluído' };
const CRIT_COLOR   = { Alta: '#EF4444', Média: '#F59E0B', Baixa: '#10B981' };

const calcPrazo = (crit, comp) => { const h = PRAZO_HORAS[crit][comp]; const d = new Date(); d.setHours(d.getHours() + h); return { horas: h, data: d }; };

// ── Função para formatar data com timezone local ─────────────────────────────
const formatLocalDate = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const fmt = d => d ? formatLocalDate(d) : '—';

// ── CSS global ────────────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #F0EEE9; --surface: #FAFAF8; --border: #E2DDD6;
    --text: #1A1714; --muted: #8C8680;
    --accent: #C4501A; --accent2: #1A4CC4; --ink: #1A1714;
    --radius: 12px;
    --shadow: 0 1px 3px rgba(26,23,20,.06), 0 4px 16px rgba(26,23,20,.08);
    --shadow-lg: 0 8px 32px rgba(26,23,20,.14);
  }
  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); min-height: 100vh; }
  h1,h2,h3,h4 { font-family: 'Syne', sans-serif; }
  button { cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .18s; }
  input, textarea, select { font-family: 'DM Sans', sans-serif; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 9999px; border: none; font-size: .875rem; font-weight: 600; }
  .btn-dark  { background: var(--ink); color: #fff; }
  .btn-dark:hover  { background: #2d2926; transform: translateY(-1px); }
  .btn-accent{ background: var(--accent); color: #fff; }
  .btn-accent:hover{ background: #a84016; transform: translateY(-1px); }
  .btn-blue  { background: var(--accent2); color: #fff; }
  .btn-blue:hover  { background: #1640a8; transform: translateY(-1px); }
  .btn-green { background: #10B981; color: #fff; }
  .btn-green:hover { background: #059669; transform: translateY(-1px); }
  .btn-red   { background: #EF4444; color: #fff; }
  .btn-red:hover   { background: #DC2626; transform: translateY(-1px); }
  .btn-ghost { background: transparent; color: var(--text); border: 1.5px solid var(--border); }
  .btn-ghost:hover { background: var(--border); }
  .btn:disabled { opacity: .5; cursor: not-allowed; transform: none !important; }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: var(--shadow); }
  .input-field { width: 100%; padding: 12px 16px; border: 1.5px solid var(--border); border-radius: var(--radius); font-size: .9375rem; background: var(--bg); color: var(--text); outline: none; transition: border-color .15s; }
  .input-field:focus { border-color: var(--accent); }
  .label { display: block; font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin-bottom: 6px; font-family: 'Syne', sans-serif; }
  .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 9999px; font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(26,23,20,.5); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn .15s ease; }
  .modal { background: var(--surface); border-radius: 20px; padding: 32px; width: 100%; max-width: 560px; box-shadow: var(--shadow-lg); max-height: 90vh; overflow-y: auto; animation: slideUp .2s ease; }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }

  .chamado-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; transition: box-shadow .2s, transform .2s; }
  .chamado-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }

  .hist-line { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .hist-line:last-child { border-bottom: none; }
  .hist-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }

  .crit-card { border: 2px solid transparent; border-radius: var(--radius); padding: 14px; cursor: pointer; transition: all .15s; background: var(--bg); }
  .crit-card.selected { background: var(--surface); box-shadow: var(--shadow); }
  .crit-card:hover { transform: translateY(-1px); }

  .crit-balloon { border-radius: var(--radius); padding: 14px 16px; margin-top: 12px; border-left: 4px solid; animation: slideUp .2s ease; }

  .sla-box { background: linear-gradient(135deg, #1A1714 0%, #2d2926 100%); color: #fff; border-radius: var(--radius); padding: 16px 20px; display: flex; align-items: center; gap: 16px; }

  .tab-btn { padding: 8px 20px; border-radius: 9999px; border: none; font-size: .875rem; font-weight: 600; background: transparent; color: var(--muted); transition: all .15s; font-family: 'Syne', sans-serif; }
  .tab-btn.active { background: var(--ink); color: #fff; }
  .tab-btn:hover:not(.active) { background: var(--border); color: var(--text); }

  .app-layout { display: flex; min-height: 100vh; }
  .sidebar { width: 240px; flex-shrink: 0; background: var(--ink); color: #fff; display: flex; flex-direction: column; padding: 28px 0; position: fixed; top: 0; left: 0; height: 100vh; z-index: 100; }
  .sidebar-logo { padding: 0 24px 28px; border-bottom: 1px solid rgba(255,255,255,.1); margin-bottom: 16px; }
  .sidebar-logo h1 { font-size: 1rem; font-family: 'Syne', sans-serif; font-weight: 700; line-height: 1.3; }
  .sidebar-logo p  { font-size: .75rem; opacity: .5; margin-top: 4px; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 11px 24px; font-size: .875rem; font-weight: 500; color: rgba(255,255,255,.6); cursor: pointer; transition: all .15s; border: none; background: none; width: 100%; text-align: left; }
  .nav-item:hover { background: rgba(255,255,255,.06); color: #fff; }
  .nav-item.active { background: rgba(255,255,255,.12); color: #fff; border-right: 3px solid var(--accent); }
  .nav-section { padding: 8px 24px 4px; font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: rgba(255,255,255,.3); margin-top: 8px; font-family: 'Syne', sans-serif; }
  .sidebar-footer { margin-top: auto; padding: 16px 24px; border-top: 1px solid rgba(255,255,255,.1); }
  .sidebar-user { font-size: .8rem; opacity: .7; margin-bottom: 10px; line-height: 1.4; }
  .main-content { margin-left: 240px; flex: 1; padding: 32px; max-width: calc(100vw - 240px); }

  .nivel-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-top: 4px; }

  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 28px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
  .stat-num  { font-family: 'Syne', sans-serif; font-size: 2rem; font-weight: 800; line-height: 1; }
  .stat-lbl  { font-size: .75rem; color: var(--muted); margin-top: 4px; }
`;

// ── Componentes base ──────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return <span className="badge" style={{ background: color + '20', color }}>{label}</span>;
}

function Modal({ children, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">{children}</div>
    </div>
  );
}

function SlaBox({ crit, comp }) {
  const { horas, data } = calcPrazo(crit, comp);
  return (
    <div className="sla-box">
      <div style={{ fontSize: '1.75rem' }}>⏱</div>
      <div>
        <div style={{ fontSize: '.7rem', opacity: .7, fontFamily: 'Syne', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Prazo SLA</div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{data.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
        <div style={{ fontSize: '.8rem', opacity: .65, marginTop: 2 }}>{horas}h a partir da abertura</div>
      </div>
    </div>
  );
}

function CriticidadeBalloon({ crit }) {
  if (!crit) return null;
  const info  = CRITICIDADE_INFO[crit];
  const color = CRIT_COLOR[crit];
  return (
    <div className="crit-balloon" style={{ background: color + '12', borderColor: color }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span>{info.icon}</span>
        <strong style={{ fontSize: '.875rem', color }}>{info.label}</strong>
      </div>
      <p style={{ fontSize: '.8125rem', color: 'var(--muted)', lineHeight: 1.5 }}>{info.desc}</p>
    </div>
  );
}

// ── Histórico e Modais Auxiliares ─────────────────────────────────────────────
const ACAO_META = {
  ABERTURA:   { icon: '🟢', label: 'Abertura',   color: '#10B981' },
  ATRIBUICAO: { icon: '🔵', label: 'Atribuição', color: '#3B82F6' },
  RESOLUCAO:  { icon: '🟡', label: 'Resolução',  color: '#F59E0B' },
  APROVACAO:  { icon: '✅', label: 'Aprovação',  color: '#10B981' },
  RECUSA:     { icon: '❌', label: 'Recusa',     color: '#EF4444' },
};

function HistoricoModal({ chamado, onClose, api }) {
  const [hist, setHist] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api(`/chamados/${chamado.id}/historico`).then(d => { 
      if (d) {
        const sorted = [...d].sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));
        setHist(sorted);
      }
      setLoading(false);
    });
  }, [api, chamado.id]);
  
  return (
    <Modal onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>Histórico do Chamado</div>
          <h2 style={{ fontSize: '1.125rem' }}>{chamado.numero_chamado}</h2>
        </div>
        <button className="btn btn-ghost" style={{ padding: '5px 12px' }} onClick={onClose}>✕</button>
      </div>
      <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: '.875rem', color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
        {chamado.descricao}
      </div>
      {loading ? <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Carregando…</p> : hist.map((h, i) => {
        const meta = ACAO_META[h.acao] || { icon: '•', label: h.acao, color: 'var(--muted)' };
        return (
          <div key={i} className="hist-line">
            <div className="hist-dot" style={{ background: meta.color }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{meta.icon} {meta.label}</span>
                <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{fmt(h.data_hora)}</span>
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 4 }}>por {h.nome_completo}</div>
              {h.comentario && <div style={{ fontSize: '.875rem', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>{h.comentario}</div>}
            </div>
          </div>
        );
      })}
    </Modal>
  );
}

function ResolucaoModal({ chamado, onClose, onConfirm }) {
  const [texto, setTexto] = useState('');
  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginBottom: 6 }}>Finalizar Atendimento</h2>
      <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: 20 }}>
        Descreva a solução aplicada. O solicitante deverá validar antes do chamado ser encerrado.
      </p>
      <div style={{ marginBottom: 20 }}>
        <label className="label">Descrição da Resolução</label>
        <textarea className="input-field" rows={5} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Descreva detalhadamente o que foi feito…" style={{ resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-green" disabled={!texto.trim()} onClick={() => onConfirm(texto)}>✅ Enviar para Validação</button>
      </div>
    </Modal>
  );
}

// ── Card de Chamado (Funcionalidade App.jsx + Estética Estética.jsx) ──────────
function ChamadoCard({ c, userId, nivel, onAssumir, onFechar, onValidar, onHistorico }) {
  const isMeu       = `${c.id_solicitante}` === `${userId}`;
  const isResp      = `${c.id_responsavel}` === `${userId}`;
  const vencido     = c.prazo_limite && new Date(c.prazo_limite) < new Date() && c.status !== 'CONCLUIDO';
  const podeAssumir = !c.id_responsavel && !isMeu && (nivel === 'TECNICO' || nivel === 'MASTER_ADMIN');

  return (
    <div className="chamado-card" style={{ borderLeft: `4px solid ${STATUS_COLOR[c.status] || '#ccc'}`, padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          background: '#5b6eab',
          padding: '3px 10px 3px 8px',
          borderRadius: '6px'
        }}>
          <span style={{ fontSize: '.65rem', fontWeight: 600, color: '#ffffff', letterSpacing: '0.5px' }}>
            TICKET:
          </span>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '.85rem', color: '#ffffff' }}>
            {c.numero_chamado}
          </span>
        </div>
        
        <button 
            className="btn btn-ghost" 
            style={{ 
              padding: '2px 8px', 
              fontSize: '.7rem', 
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }} 
            onClick={() => onHistorico(c)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Histórico
          </button>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        <Badge label={c.criticidade} color={CRIT_COLOR[c.criticidade]} />
        <Badge label={`Compl. ${c.complexidade}`} color="#6B7280" />
        <Badge label={STATUS_LABEL[c.status] || c.status} color={STATUS_COLOR[c.status] || '#888'} />
        {vencido && <Badge label="⚠ SLA" color="#EF4444" />}
      </div>

      <div style={{ fontSize: '.8rem', marginBottom: 8, lineHeight: 1.4, color: 'var(--text)' }}>
        {c.descricao.length > 100 ? c.descricao.substring(0, 100) + '...' : c.descricao}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '.7rem', color: 'var(--muted)', marginBottom: 10 }}>
        <div><strong style={{ color: 'var(--text)' }}>Solicitante</strong><br/>{c.solicitante_nome?.split(' ')[0] || c.solicitante_nome}</div>
        <div><strong style={{ color: 'var(--text)' }}>Responsável</strong><br/>{c.responsavel_nome?.split(' ')[0] || c.responsavel_nome || '—'}</div>
        <div><strong style={{ color: 'var(--text)' }}>Abertura</strong><br/>{fmt(c.data_abertura)}</div>
        <div><strong style={{ color: vencido ? '#EF4444' : 'var(--text)' }}>SLA</strong><br/>{fmt(c.prazo_limite)}</div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {podeAssumir && (
          <button className="btn btn-blue" style={{ fontSize: '.7rem', padding: '4px 10px' }} onClick={() => onAssumir(c.id)}>
            Assumir
          </button>
        )}
        {(isResp || nivel === 'MASTER_ADMIN') && c.status === 'EM ANALISE' && (
          <button className="btn btn-dark" style={{ fontSize: '.7rem', padding: '4px 10px' }} onClick={() => onFechar(c)}>
            Finalizar
          </button>
        )}
        {/* Usando onValidar de App.jsx integrado aos botões visualmente atualizados */}
        {isMeu && c.status === 'AGUARDANDO VALIDACAO' && (
          <>
            <button className="btn btn-green" style={{ fontSize: '.7rem', padding: '4px 10px' }} onClick={() => onValidar(c.id, true)}>✓ Aprovar Resolução</button>
            <button className="btn btn-red"   style={{ fontSize: '.7rem', padding: '4px 10px' }} onClick={() => onValidar(c.id, false)}>✗ Recusar / Reabrir</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tela de Login ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [data, setData]   = useState({ identifier: '', senha: '' });
  const [erro, setErro]   = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault(); setLoading(true); setErro('');
    try {
      const r   = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const res = await r.json();
      if (r.ok && res.token) { localStorage.setItem('token', res.token); onLogin(res.token, res.user); }
      else setErro(res.error || 'Credenciais inválidas');
    } catch { setErro('Erro de conexão. Tente novamente.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: 420, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 52, height: 52, background: 'var(--ink)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', margin: '0 auto 14px' }}>📋</div>
          <h1 style={{ fontSize: '1.625rem', marginBottom: 4 }}>Central de Chamados</h1>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem' }}>SASSEPE — Área Técnica</p>
        </div>
        <div className="card">
          <form onSubmit={submit}>
            <div style={{ marginBottom: 16 }}>
              <label className="label">E-mail</label>
              <input className="input-field" type="email" required autoComplete="email"
                value={data.identifier} onChange={e => setData({ ...data, identifier: e.target.value })} placeholder="seu@email.com" />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label className="label">Senha</label>
              <input className="input-field" type="password" required autoComplete="current-password"
                value={data.senha} onChange={e => setData({ ...data, senha: e.target.value })} placeholder="••••••••" />
            </div>
            {erro && <div style={{ color: '#EF4444', fontSize: '.875rem', marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8 }}>{erro}</div>}
            <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', padding: 13 }} disabled={loading} type="submit">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar (Rotas App.jsx + Ícones SVGs Estética.jsx) ────────────────────────
const NIVEL_META = {
  SOLICITANTE:  { label: 'Solicitante',  color: '#F59E0B' },
  TECNICO:      { label: 'Técnico',      color: '#3B82F6' },
  MASTER_ADMIN: { label: 'Master Admin', color: '#8B5CF6' },
};

function Sidebar({ user, pagina, setPagina, onSair, onAbrirPerfil }) {
  const nivel = user?.nivel_acesso || 'SOLICITANTE';
  const meta  = NIVEL_META[nivel] || NIVEL_META.SOLICITANTE;

  // Utilizamos as rotas mantidas em App.jsx combinadas com os ícones de Estética.jsx
  const navSolicitante = [
    { id: 'dashboard',      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, label: 'Dashboard' },
    { id: 'meus-chamados',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, label: 'Meus Chamados' },
    { id: 'novo-chamado',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>, label: 'Abrir Chamado' },
  ];

  const navTecnico = [
    { id: 'dashboard',      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, label: 'Dashboard' },
    { id: 'bandeja',        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>, label: 'Bandeja de Chamados' },
    { id: 'meus-atend',     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h8l-2 8 10-12h-8z"/></svg>, label: 'Meus Atendimentos' },
  ];

  const navAdmin = [
    { id: 'dashboard',      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, label: 'Dashboard' },
    { id: 'todos-chamados', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, label: 'Todos os Chamados' },
    { id: 'meus-chamados',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, label: 'Meus Chamados' },
    { id: 'novo-chamado',   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>, label: 'Abrir Chamado' },
    { id: 'bandeja',        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>, label: 'Bandeja' },
    { id: 'usuarios',       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, label: 'Usuários' },
    { id: 'logs-visualizacao', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>, label: 'Logs de Visualização' },
  ];

  const items = nivel === 'MASTER_ADMIN' ? navAdmin : nivel === 'TECNICO' ? navTecnico : navSolicitante;

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <h1>Central de Chamados</h1>
        <p>SASSEPE</p>
      </div>
      <div className="nav-section">Menu</div>
      {items.map(item => (
        <button key={item.id} className={`nav-item${pagina === item.id ? ' active' : ''}`} onClick={() => setPagina(item.id)}>
          <span>{item.icon}</span> {item.label}
        </button>
      ))}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div style={{ fontWeight: 600, color: '#fff', marginBottom: 2 }}>{user?.nome}</div>
          <div>{user?.email}</div>
          <span className="nivel-badge" style={{ background: meta.color + '30', color: meta.color }}>{meta.label}</span>
        </div>
        <button 
            className="btn btn-ghost" 
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              color: 'rgba(255,255,255,.6)', 
              borderColor: 'rgba(255,255,255,.15)', 
              fontSize: '.8rem', 
              padding: '8px', 
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }} 
            onClick={onAbrirPerfil}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Meu Perfil
          </button>
        <button 
          className="btn btn-ghost" 
          style={{ width: '100%', justifyContent: 'center', color: 'rgba(255,255,255,.6)', borderColor: 'rgba(255,255,255,.15)', fontSize: '.8rem', padding: '8px' }} 
          onClick={onSair}>
          Sair
        </button>
      </div>
    </nav>
  );
}

// ── View: Novo Chamado (Funcionalidade App.jsx + Estética Estética.jsx) ───────
function NovoChamadoView({ user, api, onSucesso }) {
  // Mantemos o estado padronizado e a lógica de envio do App.jsx original
  const [form, setForm]     = useState({ descricao: '', criticidade: 'Média', complexidade: 'Média' });
  const [salvando, setSalvando] = useState(false);

  const submit = async e => {
    e.preventDefault(); setSalvando(true);
    const data = await api('/chamados', { method: 'POST', body: JSON.stringify(form) });
    if (data?.id) { setForm({ descricao: '', criticidade: 'Média', complexidade: 'Média' }); onSucesso(); }
    setSalvando(false);
  };

  const LevelIcon = ({ color }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );

  return (
    <div>
      <h2 style={{ marginBottom: 6, fontSize: '1.25rem' }}>Abrir Novo Chamado</h2>
      <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: 28 }}>Preencha os dados abaixo para registrar um novo protocolo.</p>

      <div className="card" style={{ maxWidth: 680 }}>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22, opacity: .6, pointerEvents: 'none' }}>
            <div>
              <label className="label">Responsável pela Abertura</label>
              <input className="input-field" value={user?.nome || ''} readOnly />
            </div>
            <div>
              <label className="label">Data / Hora da Abertura</label>
              <input className="input-field" value={new Date().toLocaleString('pt-BR')} readOnly />
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <label className="label">Descrição do Problema *</label>
            <textarea className="input-field" rows={4} required
              value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descreva o problema com detalhes suficientes para diagnóstico…" style={{ resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              Grau de Criticidade *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {['Alta', 'Média', 'Baixa'].map(c => {
                const descMap = { Alta: 'Sistema fora do ar', Média: 'Falhas parciais', Baixa: 'Baixo impacto' };
                const isSel = form.criticidade === c;
                return (
                  <div key={c} className={`crit-card${isSel ? ' selected' : ''}`}
                    style={{ borderColor: isSel ? CRIT_COLOR[c] : 'transparent', background: isSel ? CRIT_COLOR[c] + '12' : 'var(--bg)', cursor: 'pointer' }}
                    onClick={() => setForm({ ...form, criticidade: c })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: CRIT_COLOR[c], display: 'inline-block', flexShrink: 0 }} />
                      <strong style={{ fontFamily: 'Syne', fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <LevelIcon color={CRIT_COLOR[c]} />
                        {c}
                      </strong>
                    </div>
                    <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 4 }}>{descMap[c]}</div>
                  </div>
                );
              })}
            </div>
            <CriticidadeBalloon crit={form.criticidade} />
          </div>

          <div style={{ marginBottom: 22, animation: 'slideUp .2s ease' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
              </svg>
              Grau de Complexidade *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {['Alta', 'Média', 'Baixa'].map(cp => {
                const descMap = { Alta: 'Solução complexa', Média: 'Solução moderada', Baixa: 'Solução simples' };
                const cColorMap = { Alta: '#EF4444', Média: '#F59E0B', Baixa: '#10B981' };
                const isSel = form.complexidade === cp;
                return (
                  <div key={cp} className={`crit-card${isSel ? ' selected' : ''}`}
                    style={{ borderColor: isSel ? 'var(--accent2)' : 'transparent', textAlign: 'center', background: isSel ? 'var(--accent2)12' : 'var(--bg)', cursor: 'pointer' }}
                    onClick={() => setForm({ ...form, complexidade: cp })}>
                    <strong style={{ fontFamily: 'Syne', fontSize: '.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <LevelIcon color={cColorMap[cp]} />
                      {cp}
                    </strong>
                    <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 4 }}>{descMap[cp]}</div>
                    <div style={{ fontSize: '.7rem', color: '#8B5CF6', marginTop: 4, fontWeight: 600 }}>
                      {PRAZO_HORAS[form.criticidade][cp]}h de SLA
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 24, animation: 'slideUp .2s ease' }}>
            <SlaBox crit={form.criticidade} comp={form.complexidade} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-accent" type="submit" disabled={salvando || !form.descricao} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13"></path>
                <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
              </svg>
              {salvando ? 'Abrindo...' : 'Abrir Chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── View: Lista de chamados genérica ─────────────────────────────────────────
function ListaChamados({ titulo, chamados, userId, nivel, api, onRecarregar, registrarVisualizacao = false }) {
  const [histModal,    setHistModal]    = useState(null);
  const [resolModal,   setResolModal]   = useState(null);

  useEffect(() => {
    if (registrarVisualizacao && chamados.length >= 0) {
      const registrar = async () => {
        try {
          await api('/logs/visualizacao-bandeja', {
            method: 'POST',
            body: JSON.stringify({ totalChamadosVisiveis: chamados.length })
          });
        } catch (err) {
          console.debug('Erro ao registrar visualização:', err);
        }
      };
      registrar();
    }
  }, [registrarVisualizacao, chamados.length, api]);

  const assumir  = async id => { await api(`/chamados/${id}/assumir`, { method: 'PUT' }); onRecarregar(); };
  const fechar   = async (ch, txt) => { await api(`/chamados/${ch.id}/fechar`, { method: 'PUT', body: JSON.stringify({ descricaoResolucao: txt }) }); setResolModal(null); onRecarregar(); };
  const validar  = async (id, ok) => { await api(`/chamados/${id}/validar`, { method: 'PUT', body: JSON.stringify({ aprovado: ok }) }); onRecarregar(); };

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', marginBottom: 20 }}>{titulo}</h2>
      {chamados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
          <p>Nenhum chamado encontrado.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {chamados.map(c => (
            <ChamadoCard key={c.id} c={c} userId={userId} nivel={nivel}
              onAssumir={assumir} onFechar={ch => setResolModal(ch)} onValidar={validar} onHistorico={ch => setHistModal(ch)} />
          ))}
        </div>
      )}
      {histModal  && <HistoricoModal chamado={histModal}  onClose={() => setHistModal(null)}  api={api} />}
      {resolModal && <ResolucaoModal chamado={resolModal} onClose={() => setResolModal(null)} onConfirm={txt => fechar(resolModal, txt)} />}
    </div>
  );
}

// ── View: Gestão de Usuários (MASTER_ADMIN) ───────────────────────────────────
const CARGOS = [
  { id: 'SOLICITANTE',  label: 'Solicitante',  color: '#F59E0B', desc: 'Pode abrir e acompanhar chamados' },
  { id: 'TECNICO',      label: 'Técnico',      color: '#3B82F6', desc: 'Pode assumir e resolver chamados' },
  { id: 'MASTER_ADMIN', label: 'Master Admin', color: '#8B5CF6', desc: 'Acesso total ao sistema' },
];

function UsuarioModal({ usuario, onClose, onSalvar }) {
  const isEdicao = !!usuario?.id;
  const [form, setForm] = useState({
    nome_completo: usuario?.nome_completo || '',
    email:         usuario?.email         || '',
    senha:         '',
    nivel_acesso:  usuario?.nivel_acesso  || 'SOLICITANTE',
    cargo_nome:    usuario?.cargo_nome    || '',
    ativo:         usuario?.ativo !== false,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const submit = async () => {
    if (!form.nome_completo.trim() || !form.email.trim()) return setErro('Nome e e-mail são obrigatórios.');
    if (!isEdicao && !form.senha.trim()) return setErro('A senha é obrigatória para novos usuários.');
    setSalvando(true); setErro('');
    const ok = await onSalvar(form, usuario?.id);
    if (!ok) { setErro('Erro ao salvar. Verifique os dados e tente novamente.'); setSalvando(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>{isEdicao ? 'Editar Usuário' : 'Novo Usuário'}</div>
          <h2 style={{ fontSize: '1.25rem' }}>{isEdicao ? usuario.nome_completo : 'Cadastrar'}</h2>
        </div>
        <button className="btn btn-ghost" style={{ padding: '5px 12px' }} onClick={onClose}>✕</button>
      </div>

      {erro && <div style={{ color: '#EF4444', fontSize: '.875rem', marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8 }}>{erro}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="label">Nome Completo *</label>
          <input className="input-field" value={form.nome_completo} onChange={e => setForm({ ...form, nome_completo: e.target.value })} placeholder="Nome completo do usuário" />
        </div>
        <div>
          <label className="label">E-mail *</label>
          <input className="input-field" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="usuario@email.com" />
        </div>
        <div>
          <label className="label">{isEdicao ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}</label>
          <input className="input-field" type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder="••••••••" />
        </div>
        <div>
          <label className="label">Cargo / Função</label>
          <input className="input-field" value={form.cargo_nome} onChange={e => setForm({ ...form, cargo_nome: e.target.value })} placeholder="Ex: Analista de TI" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
          <input type="checkbox" id="ativo-chk" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          <label htmlFor="ativo-chk" style={{ fontSize: '.875rem', cursor: 'pointer', userSelect: 'none' }}>Usuário ativo</label>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label className="label" style={{ marginBottom: 10 }}>Nível de Acesso *</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {CARGOS.map(c => (
            <div key={c.id}
              onClick={() => setForm({ ...form, nivel_acesso: c.id })}
              style={{
                padding: '12px 14px', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'all .15s',
                border: `2px solid ${form.nivel_acesso === c.id ? c.color : 'var(--border)'}`,
                background: form.nivel_acesso === c.id ? c.color + '12' : 'var(--bg)',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                <strong style={{ fontFamily: 'Syne', fontSize: '.875rem', color: form.nivel_acesso === c.id ? c.color : 'var(--text)' }}>{c.label}</strong>
              </div>
              <p style={{ fontSize: '.72rem', color: 'var(--muted)', lineHeight: 1.4 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-dark" disabled={salvando} onClick={submit}>
          {salvando ? 'Salvando…' : isEdicao ? '💾 Salvar Alterações' : '➕ Cadastrar Usuário'}
        </button>
      </div>
    </Modal>
  );
}

function UsuariosView({ api }) {
  const [usuarios, setUsuarios]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null); 
  const [busca, setBusca]           = useState('');
  const [filtroNivel, setFiltroNivel] = useState('TODOS');
  const [confirmDel, setConfirmDel] = useState(null);
  const [toast, setToast]           = useState(null);

  const mostrarToast = (msg, tipo = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const carregar = async () => {
    setLoading(true);
    const d = await api('/usuarios');
    if (d) setUsuarios(d);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const salvar = async (form, id) => {
    const endpoint = id ? `/usuarios/${id}` : '/usuarios';
    const method   = id ? 'PUT' : 'POST';
    const res = await api(endpoint, { method, body: JSON.stringify(form) });
    if (!res || res.error) return false;
    mostrarToast(id ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.');
    setModal(null);
    carregar();
    return true;
  };

  const toggleAtivo = async (u) => {
    const res = await api(`/usuarios/${u.id}`, { method: 'PUT', body: JSON.stringify({ ...u, ativo: !u.ativo }) });
    if (res && !res.error) { mostrarToast(`Usuário ${!u.ativo ? 'ativado' : 'desativado'}.`); carregar(); }
  };

  const excluir = async (id) => {
    const res = await api(`/usuarios/${id}`, { method: 'DELETE' });
    if (res && !res.error) { mostrarToast('Usuário removido.', 'err'); carregar(); }
    setConfirmDel(null);
  };

  const listagem = usuarios.filter(u => {
    const ok = filtroNivel === 'TODOS' || u.nivel_acesso === filtroNivel;
    const q  = busca.toLowerCase();
    return ok && (!q || u.nome_completo.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  const counts = {
    total:      usuarios.length,
    ativos:     usuarios.filter(u => u.ativo).length,
    inativos:   usuarios.filter(u => !u.ativo).length,
  };

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 2000,
          padding: '12px 20px', borderRadius: 12, fontWeight: 600, fontSize: '.875rem',
          background: toast.tipo === 'err' ? '#FEF2F2' : '#F0FDF4',
          color:      toast.tipo === 'err' ? '#991B1B'  : '#166534',
          border:     `1px solid ${toast.tipo === 'err' ? '#FECACA' : '#BBF7D0'}`,
          boxShadow: 'var(--shadow-lg)', animation: 'slideUp .2s ease',
        }}>
          {toast.tipo === 'err' ? '🗑' : '✅'} {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Gerenciamento de Usuários</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem' }}>Cadastre, edite e controle os acessos do sistema.</p>
        </div>
        <button className="btn btn-dark" onClick={() => setModal('novo')}>➕ Novo Usuário</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { num: counts.total,    lbl: 'Total',    color: 'var(--text)' },
          { num: counts.ativos,   lbl: 'Ativos',   color: '#10B981' },
          { num: counts.inativos, lbl: 'Inativos', color: '#EF4444' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-num" style={{ color: s.color, fontSize: '1.6rem' }}>{s.num}</div>
            <div className="stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input-field" style={{ maxWidth: 280 }} placeholder="🔍  Buscar por nome ou e-mail…"
          value={busca} onChange={e => setBusca(e.target.value)} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['TODOS', 'SOLICITANTE', 'TECNICO', 'MASTER_ADMIN'].map(n => {
            const meta = n === 'TODOS' ? { label: 'Todos', color: 'var(--text)' } : NIVEL_META[n];
            return (
              <button key={n} className={`tab-btn${filtroNivel === n ? ' active' : ''}`}
                onClick={() => setFiltroNivel(n)} style={{ fontSize: '.75rem', padding: '6px 14px' }}>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>Carregando…</div>
      ) : listagem.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>👤</div>
          <p>Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1fr .8fr 1.1fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            {['Nome', 'E-mail', 'Nível', 'Cargo', 'Status', 'Ações'].map((h, i) => (
              <div key={i} style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', fontFamily: 'Syne' }}>{h}</div>
            ))}
          </div>
          {listagem.map((u, i) => {
            const nvMeta = NIVEL_META[u.nivel_acesso] || NIVEL_META.SOLICITANTE;
            return (
              <div key={u.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1fr .8fr 1.1fr', gap: 12,
                padding: '14px 20px', alignItems: 'center',
                borderBottom: i < listagem.length - 1 ? '1px solid var(--border)' : 'none',
                background: !u.ativo ? '#FAFAF8' : 'transparent',
                opacity: u.ativo ? 1 : 0.6,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{u.nome_completo}</div>
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                <div>
                  <span className="badge" style={{ background: nvMeta.color + '20', color: nvMeta.color }}>{nvMeta.label}</span>
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{u.cargo_nome || <em>—</em>}</div>
                <div>
                  <span className="badge" style={{ background: u.ativo ? '#D1FAE5' : '#FEE2E2', color: u.ativo ? '#065F46' : '#991B1B' }}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '.72rem' }} onClick={() => setModal(u)} title="Editar">✏️</button>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '.72rem', color: u.ativo ? '#EF4444' : '#10B981', borderColor: u.ativo ? '#FECACA' : '#BBF7D0' }}
                    onClick={() => toggleAtivo(u)} title={u.ativo ? 'Desativar' : 'Ativar'}>
                    {u.ativo ? '⛔' : '✅'}
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '.72rem', color: '#EF4444', borderColor: '#FECACA' }}
                    onClick={() => setConfirmDel(u)} title="Excluir">🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <UsuarioModal
          usuario={modal === 'novo' ? null : modal}
          onClose={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)}>
          <h2 style={{ marginBottom: 8 }}>Excluir Usuário</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: 24 }}>
            Tem certeza que deseja excluir <strong>{confirmDel.nome_completo}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancelar</button>
            <button className="btn btn-red" onClick={() => excluir(confirmDel.id)}>🗑 Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── View: Logs de Visualização (MASTER_ADMIN) ─────────────────────────────────
function LogsVisualizacaoView({ api }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const mostrarToast = (msg, tipo = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const carregarLogs = async () => {
    setLoading(true);
    try {
      const url = `/admin/logs-visualizacao?limit=${limit}&offset=${offset}`;
      const data = await api(url);
      if (data) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      mostrarToast('Erro ao carregar logs', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLogs();
  }, [limit, offset]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const exportarCSV = async () => {
    try {
      let url = '/admin/logs-visualizacao/export';
      if (dataInicio && dataFim) {
        url += `?startDate=${dataInicio}&endDate=${dataFim}`;
      }
      const data = await api(url);
      if (data && data.logs) {
        const csvData = data.logs.map(log => ({
          ID: log.id,
          Usuário: log.nome_completo,
          Email: log.email,
          'Nível Acesso': log.nivel_acesso || 'N/A',
          'Data Visualização': new Date(log.data_visualizacao).toLocaleString('pt-BR'),
          'Total Chamados': log.total_chamados_visiveis
        }));
        
        const headers = Object.keys(csvData[0] || {});
        const csvRows = [
          headers.join(','),
          ...csvData.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
        ];
        
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const urlBlob = URL.createObjectURL(blob);
        link.href = urlBlob;
        link.setAttribute('download', `logs_visualizacao_${new Date().toISOString().slice(0,19)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(urlBlob);
        
        mostrarToast('CSV exportado com sucesso!');
      }
    } catch (err) {
      mostrarToast('Erro ao exportar CSV', 'err');
    }
  };

  const excluirLog = async (id) => {
    try {
      await api(`/admin/logs-visualizacao/${id}`, { method: 'DELETE' });
      mostrarToast('Log excluído com sucesso!');
      carregarLogs();
    } catch (err) {
      mostrarToast('Erro ao excluir log', 'err');
    }
    setConfirmDelete(null);
  };

  const excluirTodosLogs = async () => {
    try {
      await api('/admin/logs-visualizacao?all=true', { method: 'DELETE' });
      mostrarToast('Todos os logs foram excluídos!');
      carregarLogs();
    } catch (err) {
      mostrarToast('Erro ao excluir logs', 'err');
    }
    setConfirmDelete(null);
  };

  const excluirLogsPorUsuario = async (usuarioId) => {
    try {
      await api(`/admin/logs-visualizacao?usuarioId=${usuarioId}`, { method: 'DELETE' });
      mostrarToast('Logs do usuário excluídos com sucesso!');
      carregarLogs();
    } catch (err) {
      mostrarToast('Erro ao excluir logs', 'err');
    }
    setConfirmDelete(null);
  };

  const logsFiltrados = logs.filter(log => {
    if (!filtroUsuario) return true;
    return log.nome_completo.toLowerCase().includes(filtroUsuario.toLowerCase()) ||
           log.email.toLowerCase().includes(filtroUsuario.toLowerCase());
  });

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 2000,
          padding: '12px 20px', borderRadius: 12, fontWeight: 600, fontSize: '.875rem',
          background: toast.tipo === 'err' ? '#FEF2F2' : '#F0FDF4',
          color: toast.tipo === 'err' ? '#991B1B' : '#166534',
          border: `1px solid ${toast.tipo === 'err' ? '#FECACA' : '#BBF7D0'}`,
          boxShadow: 'var(--shadow-lg)'
        }}>
          {toast.tipo === 'err' ? '❌' : '✅'} {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Logs de Visualização da Bandeja</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem' }}>
            Registros de quando os usuários visualizaram a bandeja de chamados
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-blue" onClick={() => setShowFilters(!showFilters)}>
            🔍 {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
          <button className="btn btn-green" onClick={exportarCSV}>
            📊 Exportar CSV
          </button>
          <button className="btn btn-red" onClick={() => setConfirmDelete({ type: 'all' })}>
            🗑 Limpar Todos
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card" style={{ marginBottom: 24, padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label className="label">Filtrar por Usuário</label>
              <input
                className="input-field"
                placeholder="Nome ou e-mail..."
                value={filtroUsuario}
                onChange={e => setFiltroUsuario(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Data Início</label>
              <input
                className="input-field"
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Data Fim</label>
              <input
                className="input-field"
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { num: total, lbl: 'Total de Visualizações', color: 'var(--text)' },
          { num: logsFiltrados.length, lbl: 'Registros Exibidos', color: '#3B82F6' },
          { num: new Set(logs.map(l => l.id_usuario)).size, lbl: 'Usuários Únicos', color: '#10B981' }
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-num" style={{ color: s.color, fontSize: '1.8rem' }}>{s.num}</div>
            <div className="stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          Carregando logs...
        </div>
      ) : logsFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
          <p>Nenhum log de visualização encontrado.</p>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1.5fr 1.5fr 1fr 1fr 1fr 1.5fr auto',
              gap: 12,
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)'
            }}>
              {['ID', 'Usuário', 'E-mail', 'Nível', 'Data', 'Chamados', 'Ações'].map((h, i) => (
                <div key={i} style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', fontFamily: 'Syne' }}>
                  {h}
                </div>
              ))}
            </div>
            {logsFiltrados.map((log, i) => {
              const nivelColor = log.nivel_acesso === 'MASTER_ADMIN' ? '#8B5CF6' : log.nivel_acesso === 'TECNICO' ? '#3B82F6' : '#F59E0B';
              return (
                <div key={log.id} style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1.5fr 1.5fr 1fr 1fr 1fr 1.5fr auto',
                  gap: 12,
                  padding: '14px 20px',
                  alignItems: 'center',
                  borderBottom: i < logsFiltrados.length - 1 ? '1px solid var(--border)' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'var(--bg)'
                }}>
                  <div style={{ fontSize: '.8rem', fontFamily: 'monospace', color: 'var(--muted)' }}>#{log.id}</div>
                  <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{log.nome_completo}</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{log.email}</div>
                  <div>
                    <span className="badge" style={{ background: nivelColor + '20', color: nivelColor, fontSize: '.65rem' }}>
                      {log.nivel_acesso || 'SOLICITANTE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '.8rem' }}>{new Date(log.data_visualizacao).toLocaleString('pt-BR')}</div>
                  <div style={{ fontSize: '.8rem', textAlign: 'center' }}>
                    <span className="badge" style={{ background: '#3B82F620', color: '#3B82F6' }}>
                      {log.total_chamados_visiveis} chamados
                    </span>
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                    {Math.ceil((new Date() - new Date(log.data_visualizacao)) / (1000 * 60 * 60))}h atrás
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '.72rem', color: '#EF4444', borderColor: '#FECACA' }}
                      onClick={() => setConfirmDelete({ type: 'single', id: log.id })}
                      title="Excluir log"
                    >
                      🗑
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '.72rem', color: '#F59E0B', borderColor: '#FEF3C7' }}
                      onClick={() => setConfirmDelete({ type: 'user', usuarioId: log.id_usuario, nome: log.nome_completo })}
                      title="Excluir todos os logs deste usuário"
                    >
                      👤
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button
                className="btn btn-ghost"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                ← Anterior
              </button>
              <span style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                Página {currentPage} de {totalPages}
              </span>
              <button
                className="btn btn-ghost"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <h2 style={{ marginBottom: 8 }}>
            {confirmDelete.type === 'all' ? 'Limpar Todos os Logs' :
             confirmDelete.type === 'user' ? `Excluir Logs de ${confirmDelete.nome}` :
             'Excluir Log'}
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: 24 }}>
            {confirmDelete.type === 'all' && 'Tem certeza que deseja excluir TODOS os logs de visualização? Esta ação não pode ser desfeita.'}
            {confirmDelete.type === 'user' && `Tem certeza que deseja excluir todos os logs de visualização do usuário "${confirmDelete.nome}"?`}
            {confirmDelete.type === 'single' && 'Tem certeza que deseja excluir este log?'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button
              className="btn btn-red"
              onClick={() => {
                if (confirmDelete.type === 'all') excluirTodosLogs();
                else if (confirmDelete.type === 'user') excluirLogsPorUsuario(confirmDelete.usuarioId);
                else excluirLog(confirmDelete.id);
              }}
            >
              {confirmDelete.type === 'all' ? '🗑 Limpar Todos' : '🗑 Excluir'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── View: Dashboard (Funcionalidade App.jsx intacta) ─────────────────────────
const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

function gerarCompetencias() {
  const now = new Date();
  const lista = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    lista.push({ mes: d.getMonth() + 1, ano: d.getFullYear(), label: `${MESES[d.getMonth()]}/${d.getFullYear()}` });
  }
  return lista.reverse();
}

function DashboardView({ api, user }) {
  const now = new Date();
  const competencias = gerarCompetencias();
  const [competencia, setCompetencia] = useState({ mes: now.getMonth() + 1, ano: now.getFullYear() });
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const data = await api(`/chamados/dashboard?mes=${competencia.mes}&ano=${competencia.ano}`);
    if (data) setChamados(data);
    setLoading(false);
  }, [api, competencia.mes, competencia.ano]);

  useEffect(() => { carregar(); }, [carregar]);

  const counts = {
    total:     chamados.length,
    abertos:   chamados.filter(c => c.status === 'ABERTO').length,
    analise:   chamados.filter(c => c.status === 'EM ANALISE').length,
    validacao: chamados.filter(c => c.status === 'AGUARDANDO VALIDACAO').length,
    concluido: chamados.filter(c => c.status === 'CONCLUIDO').length,
    vencidos:  chamados.filter(c => c.prazo_limite && new Date(c.prazo_limite) < new Date() && c.status !== 'CONCLUIDO').length,
    alta:      chamados.filter(c => c.criticidade === 'Alta').length,
    media:     chamados.filter(c => c.criticidade === 'Média').length,
    baixa:     chamados.filter(c => c.criticidade === 'Baixa').length,
  };

  const taxaConclusao = counts.total > 0 ? Math.round((counts.concluido / counts.total) * 100) : 0;

  const concluidos = chamados.filter(c => c.status === 'CONCLUIDO' && c.data_abertura && c.data_fechamento);
  const slaMediaHoras = concluidos.length > 0
    ? Math.round(concluidos.reduce((acc, c) => acc + (new Date(c.data_fechamento) - new Date(c.data_abertura)) / 3_600_000, 0) / concluidos.length)
    : null;

  const exportarCSV = () => {
    if (!chamados.length) return;
    const cabecalho = [
      'Número do Chamado',
      'Descrição',
      'Status',
      'Criticidade',
      'Complexidade',
      'Solicitante',
      'Responsável',
      'Data de Abertura',
      'Prazo SLA',
      'Data de Fechamento',
      'SLA Vencido'
    ];
    const linhas = chamados.map(c => [
      c.numero_chamado || '',
      `"${(c.descricao || '').replace(/"/g, '""')}"`,
      STATUS_LABEL[c.status] || c.status || '',
      c.criticidade || '',
      c.complexidade || '',
      c.solicitante_nome || '',
      c.responsavel_nome || '',
      c.data_abertura ? new Date(c.data_abertura).toLocaleString('pt-BR') : '',
      c.prazo_limite   ? new Date(c.prazo_limite).toLocaleString('pt-BR')  : '',
      c.data_fechamento ? new Date(c.data_fechamento).toLocaleString('pt-BR') : '',
      (c.prazo_limite && new Date(c.prazo_limite) < new Date() && c.status !== 'CONCLUIDO') ? 'Sim' : 'Não'
    ]);
    const csv = [cabecalho.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
    const bom = '\uFEFF'; 
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chamados_${MESES[competencia.mes - 1]}_${competencia.ano}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const labelCompetencia = `${MESES[competencia.mes - 1]}/${competencia.ano}`;

  const stats = [
    { num: counts.total,     lbl: 'Total de Chamados',     color: 'var(--text)' },
    { num: counts.abertos,   lbl: 'Em Aberto',             color: '#F59E0B' },
    { num: counts.analise,   lbl: 'Em Análise',            color: '#3B82F6' },
    { num: counts.validacao, lbl: 'Aguard. Validação',     color: '#8B5CF6' },
    { num: counts.concluido, lbl: 'Concluídos',            color: '#10B981' },
    { num: counts.vencidos,  lbl: 'SLA Vencido',           color: '#EF4444' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Dashboard</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem' }}>Visão geral dos chamados por competência</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost"
              style={{ fontFamily: 'Syne', fontWeight: 600, fontSize: '.875rem', gap: 8 }}
              onClick={() => setShowPicker(v => !v)}
            >
              📅 {labelCompetencia} ▾
            </button>
            {showPicker && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, boxShadow: 'var(--shadow-lg)', padding: '8px 0',
                minWidth: 200, maxHeight: 260, overflowY: 'auto'
              }}>
                {competencias.map((c, i) => {
                  const ativo = c.mes === competencia.mes && c.ano === competencia.ano;
                  return (
                    <button key={i} onClick={() => { setCompetencia({ mes: c.mes, ano: c.ano }); setShowPicker(false); }} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '9px 18px',
                      background: ativo ? 'var(--accent)' : 'transparent',
                      color: ativo ? '#fff' : 'var(--text)', border: 'none', cursor: 'pointer',
                      fontSize: '.875rem', fontFamily: 'DM Sans', fontWeight: ativo ? 600 : 400,
                      transition: 'background .1s'
                    }}
                      onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = 'var(--bg)'; }}
                      onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            className="btn btn-green"
            style={{ fontSize: '.875rem' }}
            disabled={!chamados.length}
            onClick={exportarCSV}
            title={chamados.length ? `Baixar ${chamados.length} chamados em CSV` : 'Sem dados para exportar'}
          >
            ⬇ Baixar CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>Carregando…</div>
      ) : (
        <>
          {counts.vencidos > 0 && (
            <div style={{ padding: '14px 18px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', marginBottom: 20, fontSize: '.875rem', color: '#991B1B' }}>
              ⚠️ <strong>{counts.vencidos} chamado(s)</strong> com SLA vencido requerem atenção imediata.
            </div>
          )}
          {counts.total === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
              <p>Nenhum chamado encontrado em <strong>{labelCompetencia}</strong>.</p>
            </div>
          )}

          {counts.total > 0 && (
            <>
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                {stats.map((s, i) => (
                  <div key={i} className="stat-card">
                    <div className="stat-num" style={{ color: s.color }}>{s.num}</div>
                    <div className="stat-lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
                <div className="stat-card">
                  <div className="stat-num" style={{ color: '#10B981', fontSize: '1.8rem' }}>{taxaConclusao}%</div>
                  <div className="stat-lbl">Taxa de Conclusão</div>
                </div>
                <div className="stat-card">
                  <div className="stat-num" style={{ color: '#EF4444', fontSize: '1.8rem' }}>{counts.alta}</div>
                  <div className="stat-lbl">Criticidade Alta</div>
                </div>
                <div className="stat-card">
                  <div className="stat-num" style={{ color: '#F59E0B', fontSize: '1.8rem' }}>{counts.media}</div>
                  <div className="stat-lbl">Criticidade Média</div>
                </div>
                <div className="stat-card">
                  <div className="stat-num" style={{ color: '#10B981', fontSize: '1.8rem' }}>{counts.baixa}</div>
                  <div className="stat-lbl">Criticidade Baixa</div>
                </div>
                {slaMediaHoras !== null && (
                  <div className="stat-card">
                    <div className="stat-num" style={{ color: 'var(--accent2)', fontSize: '1.8rem' }}>{slaMediaHoras}h</div>
                    <div className="stat-lbl">Tempo Médio de Resolução</div>
                  </div>
                )}
              </div>

              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '.875rem', marginBottom: 16 }}>Distribuição por Status</div>
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 28, gap: 2 }}>
                  {[
                    { val: counts.abertos,   color: '#F59E0B', lbl: 'Aberto' },
                    { val: counts.analise,   color: '#3B82F6', lbl: 'Em Análise' },
                    { val: counts.validacao, color: '#8B5CF6', lbl: 'Aguard. Validação' },
                    { val: counts.concluido, color: '#10B981', lbl: 'Concluído' },
                  ].filter(s => s.val > 0).map((s, i) => (
                    <div key={i} title={`${s.lbl}: ${s.val}`} style={{
                      flex: s.val, background: s.color, borderRadius: 4, minWidth: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '.7rem', fontWeight: 700, overflow: 'hidden', whiteSpace: 'nowrap'
                    }}>
                      {s.val > 2 ? `${s.val}` : ''}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                  {[
                    { val: counts.abertos,   color: '#F59E0B', lbl: 'Aberto' },
                    { val: counts.analise,   color: '#3B82F6', lbl: 'Em Análise' },
                    { val: counts.validacao, color: '#8B5CF6', lbl: 'Aguard. Validação' },
                    { val: counts.concluido, color: '#10B981', lbl: 'Concluído' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.8rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0, display: 'inline-block' }} />
                      {s.lbl}: <strong>{s.val}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '.875rem' }}>
                    Chamados — {labelCompetencia}
                    <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--muted)', fontSize: '.8rem' }}>({chamados.length} registros)</span>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        {['Número','Status','Criticidade','Complexidade','Solicitante','Responsável','Abertura','Prazo SLA','SLA'].map((h, i) => (
                          <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontFamily: 'Syne', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chamados.map((c, i) => {
                        const vencido = c.prazo_limite && new Date(c.prazo_limite) < new Date() && c.status !== 'CONCLUIDO';
                        return (
                          <tr key={c.id} style={{ borderBottom: i < chamados.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 1 ? 'var(--bg)' : 'transparent' }}>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--accent2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.numero_chamado}</td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                              <span className="badge" style={{ background: (STATUS_COLOR[c.status] || '#888') + '20', color: STATUS_COLOR[c.status] || '#888' }}>
                                {STATUS_LABEL[c.status] || c.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className="badge" style={{ background: (CRIT_COLOR[c.criticidade] || '#888') + '20', color: CRIT_COLOR[c.criticidade] || '#888' }}>{c.criticidade}</span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{c.complexidade}</td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{c.solicitante_nome || '—'}</td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{c.responsavel_nome || <em>Não assumido</em>}</td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fmt(c.data_abertura)}</td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: vencido ? '#EF4444' : 'var(--muted)', fontWeight: vencido ? 700 : 400 }}>{fmt(c.prazo_limite)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              {vencido
                                ? <span className="badge" style={{ background: '#FEE2E2', color: '#DC2626' }}>⚠ Vencido</span>
                                : <span className="badge" style={{ background: '#D1FAE5', color: '#065F46' }}>✓ OK</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Modal de Edição de Perfil ─────────────────────────────────────────────────
function PerfilModal({ user, onClose, onPerfilAtualizado }) {
  const [originalForm, setOriginalForm] = useState({
    nome_completo: user?.nome || '',
    email: user?.email || '',
  });
  
  const [form, setForm] = useState({
    nome_completo: user?.nome || '',
    email: user?.email || '',
    senha_atual: '',
    nova_senha: '',
    confirmar_nova_senha: ''
  });
  
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  const hasChanges = () => {
    if (form.nome_completo !== originalForm.nome_completo) return true;
    if (form.email !== originalForm.email) return true;
    if (alterandoSenha && (form.nova_senha || form.confirmar_nova_senha)) return true;
    return false;
  };

  const isSubmitDisabled = () => {
    if (salvando) return true;
    if (!hasChanges()) return true;
    if (alterandoSenha) {
      if (!form.senha_atual) return true;
      if (!form.nova_senha) return true;
      if (form.nova_senha !== form.confirmar_nova_senha) return true;
      if (form.nova_senha.length < 6) return true;
    }
    return false;
  };

  const submit = async () => {
    setErro('');
    setSucesso('');
    
    if (!form.nome_completo.trim()) { setErro('Nome é obrigatório.'); return; }
    if (!form.email.trim()) { setErro('E-mail é obrigatório.'); return; }
    
    if (alterandoSenha && form.nova_senha) {
      if (form.nova_senha !== form.confirmar_nova_senha) { setErro('As senhas não coincidem.'); return; }
      if (form.nova_senha.length < 6) { setErro('A nova senha deve ter no mínimo 6 caracteres.'); return; }
      if (!form.senha_atual) { setErro('Senha atual é necessária para alterar a senha.'); return; }
    }
    
    setSalvando(true);
    
    try {
      const payload = { nome_completo: form.nome_completo, email: form.email };
      if (alterandoSenha && form.nova_senha) {
        payload.senha_atual = form.senha_atual;
        payload.nova_senha = form.nova_senha;
      }
      
      const token = localStorage.getItem('token');
      const r = await fetch('/api/usuarios/perfil', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const res = await r.json();
      
      if (r.ok) {
        localStorage.setItem('token', res.token);
        setOriginalForm({ nome_completo: form.nome_completo, email: form.email });
        setSucesso('Perfil atualizado com sucesso!');
        setAlterandoSenha(false);
        setForm({ ...form, senha_atual: '', nova_senha: '', confirmar_nova_senha: '' });
        if (onPerfilAtualizado) onPerfilAtualizado(res.user);
        setTimeout(() => onClose(), 1500);
      } else {
        setErro(res.error || 'Erro ao atualizar perfil.');
      }
    } catch (err) {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>Editar Perfil</div>
          <h2 style={{ fontSize: '1.25rem' }}>{user?.nome}</h2>
        </div>
        <button className="btn btn-ghost" style={{ padding: '5px 12px' }} onClick={onClose}>✕</button>
      </div>

      {erro && (
        <div style={{ color: '#EF4444', fontSize: '.875rem', marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8 }}>
          {erro}
        </div>
      )}
      
      {sucesso && (
        <div style={{ color: '#10B981', fontSize: '.875rem', marginBottom: 16, padding: '10px 14px', background: '#F0FDF4', borderRadius: 8 }}>
          {sucesso}
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <label className="label">Nome Completo *</label>
        <input 
          className="input-field" 
          value={form.nome_completo} 
          onChange={e => setForm({ ...form, nome_completo: e.target.value })}
          placeholder="Seu nome completo"
        />
      </div>

      <div style={{ marginBottom: 22 }}>
        <label className="label">E-mail *</label>
        <input 
          className="input-field" 
          type="email"
          value={form.email} 
          onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="seu@email.com"
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input 
            type="checkbox"
            checked={alterandoSenha}
            onChange={(e) => {
              setAlterandoSenha(e.target.checked);
              if (!e.target.checked) setForm({ ...form, senha_atual: '', nova_senha: '', confirmar_nova_senha: '' });
            }}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '.875rem', fontWeight: 500 }}>Alterar senha</span>
        </label>
      </div>

      {alterandoSenha && (
        <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0 16px', paddingTop: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <label className="label">Senha Atual *</label>
            <input 
              className="input-field" 
              type="password"
              value={form.senha_atual} 
              onChange={e => setForm({ ...form, senha_atual: e.target.value })}
              placeholder="Digite sua senha atual"
              autoComplete="current-password"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="label">Nova Senha *</label>
            <input 
              className="input-field" 
              type="password"
              value={form.nova_senha} 
              onChange={e => setForm({ ...form, nova_senha: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="label">Confirmar Nova Senha *</label>
            <input 
              className="input-field" 
              type="password"
              value={form.confirmar_nova_senha} 
              onChange={e => setForm({ ...form, confirmar_nova_senha: e.target.value })}
              placeholder="Confirme a nova senha"
              autoComplete="new-password"
            />
          </div>

          {form.nova_senha && form.confirmar_nova_senha && form.nova_senha !== form.confirmar_nova_senha && (
            <div style={{ color: '#EF4444', fontSize: '.75rem', marginTop: -8, marginBottom: 8 }}>
              ⚠️ As senhas não coincidem
            </div>
          )}
          {form.nova_senha && form.nova_senha.length < 6 && (
            <div style={{ color: '#EF4444', fontSize: '.75rem', marginTop: -8, marginBottom: 8 }}>
              ⚠️ A senha deve ter no mínimo 6 caracteres
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button 
          className="btn btn-dark" 
          disabled={isSubmitDisabled()} 
          onClick={submit}
          style={{ opacity: isSubmitDisabled() ? 0.5 : 1, cursor: isSubmitDisabled() ? 'not-allowed' : 'pointer' }}
        >
          {salvando ? 'Salvando…' : '💾 Salvar Alterações'}
        </button>
      </div>
    </Modal>
  );
}

// ── App Principal (Funcionalidade e Roteamento App.jsx mantidos) ──────────────
const decodeJwt = (tk) => {
  try {
    const payload = JSON.parse(atob(tk.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null; 
    return { id: payload.id, nome: payload.nome, email: payload.email || '', nivel_acesso: payload.nivel_acesso };
  } catch { return null; }
};

const PAGE_DEFAULTS = { SOLICITANTE: 'dashboard', TECNICO: 'dashboard', MASTER_ADMIN: 'dashboard' };

export default function App() {
  const [token,        setToken]        = useState(() => localStorage.getItem('token'));
  const [user,         setUser]         = useState(() => {
    const tk = localStorage.getItem('token');
    return tk ? decodeJwt(tk) : null;
  });
  const [pagina,       setPagina]       = useState(() => {
    const tk = localStorage.getItem('token');
    if (!tk) return null;
    const u = decodeJwt(tk);
    return u ? (PAGE_DEFAULTS[u.nivel_acesso] || 'meus-chamados') : null;
  });
  const [meusChamados, setMeusChamados] = useState([]);
  const [disponiveis,  setDisponiveis]  = useState([]);
  const [todos,        setTodos]        = useState([]);
  const [showPerfilModal, setShowPerfilModal] = useState(false);

  const api = useCallback(async (endpoint, opts = {}) => {
    const r = await fetch(`/api${endpoint}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...opts.headers }
    });
    if (r.status === 401) { localStorage.removeItem('token'); setToken(null); return null; }
    return r.json();
  }, [token]);

  const carregar = useCallback(async () => {
    const [m, d] = await Promise.all([api('/chamados/meus'), api('/chamados/disponiveis')]);
    if (m) setMeusChamados(m);
    if (d) setDisponiveis(d);
    if (user?.nivel_acesso === 'MASTER_ADMIN') {
      const t = await api('/chamados/todos');
      if (t) setTodos(t);
    }
  }, [api, user?.nivel_acesso]);

  useEffect(() => { if (token && user) carregar(); }, [token, user, carregar]);

  const handleLogin = (tk, u) => {
    setToken(tk); setUser(u);
    setPagina(PAGE_DEFAULTS[u.nivel_acesso] || 'meus-chamados');
  };

  const sair = () => { localStorage.removeItem('token'); setToken(null); setUser(null); setPagina(null); };

  if (!token || !user) return (
    <>
      <style>{G}</style>
      <LoginScreen onLogin={handleLogin} />
    </>
  );

  const nivel = user.nivel_acesso;

  const handlePerfilAtualizado = (novoUsuario) => {
    setUser(novoUsuario);
    carregar();
  };

  const renderPagina = () => {
    switch (pagina) {
      case 'novo-chamado':
        return <NovoChamadoView user={user} api={api} onSucesso={() => { carregar(); setPagina(nivel === 'TECNICO' ? 'bandeja' : 'meus-chamados'); }} />;

      case 'meus-chamados':
        return <ListaChamados titulo="Meus Chamados" chamados={meusChamados} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;

      case 'bandeja':
        return <ListaChamados 
          titulo="Bandeja de Chamados" 
          chamados={disponiveis.filter(c => !c.id_responsavel)} 
          userId={user.id} 
          nivel={nivel} 
          api={api} 
          onRecarregar={carregar}
          registrarVisualizacao={true}
        />;

      case 'meus-atend':
        return <ListaChamados titulo="Meus Atendimentos" chamados={disponiveis.filter(c => `${c.id_responsavel}` === `${user.id}`)} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;

      case 'todos-chamados':
        return <ListaChamados titulo="Todos os Chamados" chamados={todos} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;

      case 'logs-visualizacao':
        return nivel === 'MASTER_ADMIN' ? <LogsVisualizacaoView api={api} /> : null;

      case 'dashboard':
        return <DashboardView api={api} user={user} todos={todos} />;

      case 'usuarios':
        return nivel === 'MASTER_ADMIN' ? <UsuariosView api={api} /> : null;

      default:
        return null;
    }
  };

  return (
    <>
      <style>{G}</style>
      <div className="app-layout">
        <Sidebar 
          user={user} 
          pagina={pagina} 
          setPagina={setPagina} 
          onSair={sair}
          onAbrirPerfil={() => setShowPerfilModal(true)} 
        />
        <main className="main-content">
          {renderPagina()}
        </main>
      </div>
      
      {showPerfilModal && (
        <PerfilModal 
          user={user}
          onClose={() => setShowPerfilModal(false)}
          onPerfilAtualizado={handlePerfilAtualizado}
        />
      )}
    </>
  );
}