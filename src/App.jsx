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

const fmt = d => d ? new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const calcPrazo = (crit, comp) => { const h = PRAZO_HORAS[crit][comp]; const d = new Date(); d.setHours(d.getHours() + h); return { horas: h, data: d }; };

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

  /* Balão de criticidade inline */
  .crit-balloon { border-radius: var(--radius); padding: 14px 16px; margin-top: 12px; border-left: 4px solid; animation: slideUp .2s ease; }

  .sla-box { background: linear-gradient(135deg, #1A1714 0%, #2d2926 100%); color: #fff; border-radius: var(--radius); padding: 16px 20px; display: flex; align-items: center; gap: 16px; }

  .tab-btn { padding: 8px 20px; border-radius: 9999px; border: none; font-size: .875rem; font-weight: 600; background: transparent; color: var(--muted); transition: all .15s; font-family: 'Syne', sans-serif; }
  .tab-btn.active { background: var(--ink); color: #fff; }
  .tab-btn:hover:not(.active) { background: var(--border); color: var(--text); }

  /* Sidebar layout */
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

  /* Nivel badge na sidebar */
  .nivel-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-top: 4px; }

  /* Stat cards (admin) */
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

// ── Balão de criticidade (inline, abaixo da seleção) ─────────────────────────
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

// ── Histórico ─────────────────────────────────────────────────────────────────
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
    api(`/chamados/${chamado.id}/historico`).then(d => { if (d) setHist(d); setLoading(false); });
  }, []);
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

// ── Modal Resolução ───────────────────────────────────────────────────────────
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

// ── Card de Chamado ───────────────────────────────────────────────────────────
function ChamadoCard({ c, userId, nivel, onAssumir, onFechar, onValidar, onHistorico }) {
  const isMeu       = `${c.id_solicitante}` === `${userId}`;
  const isResp      = `${c.id_responsavel}` === `${userId}`;
  const vencido     = c.prazo_limite && new Date(c.prazo_limite) < new Date() && c.status !== 'CONCLUIDO';
  const podeAssumir = !c.id_responsavel && !isMeu && (nivel === 'TECNICO' || nivel === 'MASTER_ADMIN');

  return (
    <div className="chamado-card" style={{ borderLeft: `4px solid ${STATUS_COLOR[c.status] || '#ccc'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '.8rem', color: 'var(--accent2)', marginBottom: 5 }}>{c.numero_chamado}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Badge label={c.criticidade} color={CRIT_COLOR[c.criticidade]} />
            <Badge label={`Compl. ${c.complexidade}`} color="#6B7280" />
            <Badge label={STATUS_LABEL[c.status] || c.status} color={STATUS_COLOR[c.status] || '#888'} />
            {vencido && <Badge label="⚠ SLA Vencido" color="#EF4444" />}
          </div>
        </div>
        <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '.75rem', flexShrink: 0 }} onClick={() => onHistorico(c)}>📋 Histórico</button>
      </div>

      <div style={{ fontSize: '.875rem', marginBottom: 12, lineHeight: 1.5, color: 'var(--text)' }}>{c.descricao}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '.8rem', color: 'var(--muted)', marginBottom: 14 }}>
        <div><strong style={{ color: 'var(--text)', display: 'block', marginBottom: 1 }}>Solicitante</strong>{c.solicitante_nome}</div>
        <div><strong style={{ color: 'var(--text)', display: 'block', marginBottom: 1 }}>Responsável</strong>{c.responsavel_nome || <em>Não assumido</em>}</div>
        <div><strong style={{ color: 'var(--text)', display: 'block', marginBottom: 1 }}>Abertura</strong>{fmt(c.data_abertura)}</div>
        <div>
          <strong style={{ color: vencido ? '#EF4444' : 'var(--text)', display: 'block', marginBottom: 1 }}>SLA Limite</strong>
          <span style={{ color: vencido ? '#EF4444' : 'inherit', fontWeight: vencido ? 700 : 400 }}>{fmt(c.prazo_limite)}</span>
        </div>
        {c.data_fechamento && <div><strong style={{ color: 'var(--text)', display: 'block', marginBottom: 1 }}>Fechamento</strong>{fmt(c.data_fechamento)}</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {podeAssumir && (
          <button className="btn btn-blue" onClick={() => onAssumir(c.id)}>🎯 Assumir</button>
        )}
        {(isResp || nivel === 'MASTER_ADMIN') && c.status === 'EM ANALISE' && (
          <button className="btn btn-dark" onClick={() => onFechar(c)}>✅ Finalizar Atendimento</button>
        )}
        {isMeu && c.status === 'AGUARDANDO VALIDACAO' && (
          <>
            <button className="btn btn-green" onClick={() => onValidar(c.id, true)}>✓ Aprovar Resolução</button>
            <button className="btn btn-red"   onClick={() => onValidar(c.id, false)}>✗ Recusar / Reabrir</button>
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

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NIVEL_META = {
  SOLICITANTE:  { label: 'Solicitante',  color: '#F59E0B' },
  TECNICO:      { label: 'Técnico',      color: '#3B82F6' },
  MASTER_ADMIN: { label: 'Master Admin', color: '#8B5CF6' },
};

function Sidebar({ user, pagina, setPagina, onSair }) {
  const nivel = user?.nivel_acesso || 'SOLICITANTE';
  const meta  = NIVEL_META[nivel] || NIVEL_META.SOLICITANTE;

  const navSolicitante = [
    { id: 'meus-chamados',  icon: '📋', label: 'Meus Chamados' },
    { id: 'novo-chamado',   icon: '➕', label: 'Abrir Chamado' },
  ];
  const navTecnico = [
    { id: 'bandeja',        icon: '📥', label: 'Bandeja de Chamados' },
    { id: 'meus-atend',     icon: '⚡', label: 'Meus Atendimentos' },
  ];
  const navAdmin = [
    { id: 'dashboard',      icon: '📊', label: 'Dashboard' },
    { id: 'todos-chamados', icon: '🗂',  label: 'Todos os Chamados' },
    { id: 'meus-chamados',  icon: '📋', label: 'Meus Chamados' },
    { id: 'novo-chamado',   icon: '➕', label: 'Abrir Chamado' },
    { id: 'bandeja',        icon: '📥', label: 'Bandeja' },
    { id: 'usuarios',       icon: '👥', label: 'Usuários' },
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
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', color: 'rgba(255,255,255,.6)', borderColor: 'rgba(255,255,255,.15)', fontSize: '.8rem', padding: '8px' }} onClick={onSair}>Sair</button>
      </div>
    </nav>
  );
}

// ── View: Novo Chamado (formulário completo) ──────────────────────────────────
function NovoChamadoView({ user, api, onSucesso }) {
  const [form, setForm]     = useState({ descricao: '', criticidade: 'Média', complexidade: 'Média' });
  const [salvando, setSalvando] = useState(false);

  const submit = async e => {
    e.preventDefault(); setSalvando(true);
    const data = await api('/chamados', { method: 'POST', body: JSON.stringify(form) });
    if (data?.id) { setForm({ descricao: '', criticidade: 'Média', complexidade: 'Média' }); onSucesso(); }
    setSalvando(false);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 6, fontSize: '1.25rem' }}>Abrir Novo Chamado</h2>
      <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: 28 }}>Preencha os dados abaixo para registrar um novo protocolo.</p>

      <div className="card" style={{ maxWidth: 680 }}>
        <form onSubmit={submit}>
          {/* Campos bloqueados */}
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

          {/* Criticidade com balão inline */}
          <div style={{ marginBottom: 22 }}>
            <label className="label">Grau de Criticidade</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {['Alta','Média','Baixa'].map(c => (
                <div key={c} className={`crit-card${form.criticidade === c ? ' selected' : ''}`}
                  style={{ borderColor: form.criticidade === c ? CRIT_COLOR[c] : 'transparent' }}
                  onClick={() => setForm({ ...form, criticidade: c })}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: CRIT_COLOR[c], display: 'inline-block', flexShrink: 0 }} />
                    <strong style={{ fontFamily: 'Syne', fontSize: '.9rem' }}>{c}</strong>
                  </div>
                </div>
              ))}
            </div>
            {/* ← Balão aparece aqui, abaixo dos cards */}
            <CriticidadeBalloon crit={form.criticidade} />
          </div>

          {/* Complexidade */}
          <div style={{ marginBottom: 22 }}>
            <label className="label">Grau de Complexidade</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {['Alta','Média','Baixa'].map(cp => (
                <div key={cp} className={`crit-card${form.complexidade === cp ? ' selected' : ''}`}
                  style={{ borderColor: form.complexidade === cp ? 'var(--accent2)' : 'transparent', textAlign: 'center' }}
                  onClick={() => setForm({ ...form, complexidade: cp })}>
                  <strong style={{ fontFamily: 'Syne', fontSize: '.9rem' }}>{cp}</strong>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 3 }}>{PRAZO_HORAS[form.criticidade][cp]}h de SLA</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <SlaBox crit={form.criticidade} comp={form.complexidade} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-accent" type="submit" disabled={salvando}>{salvando ? 'Abrindo…' : 'Abrir Chamado'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── View: Lista de chamados genérica ─────────────────────────────────────────
function ListaChamados({ titulo, chamados, userId, nivel, api, onRecarregar }) {
  const [histModal,    setHistModal]    = useState(null);
  const [resolModal,   setResolModal]   = useState(null);

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
  const [modal, setModal]           = useState(null); // null | 'novo' | usuario obj
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
      {/* Toast */}
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Gerenciamento de Usuários</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem' }}>Cadastre, edite e controle os acessos do sistema.</p>
        </div>
        <button className="btn btn-dark" onClick={() => setModal('novo')}>➕ Novo Usuário</button>
      </div>

      {/* Stats rápidos */}
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

      {/* Filtros */}
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

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>Carregando…</div>
      ) : listagem.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>👤</div>
          <p>Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          {/* Header da tabela */}
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

      {/* Modal criar/editar */}
      {modal && (
        <UsuarioModal
          usuario={modal === 'novo' ? null : modal}
          onClose={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {/* Modal confirmação exclusão */}
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

// ── View: Dashboard (MASTER_ADMIN) ───────────────────────────────────────────
function DashboardView({ todos }) {
  const counts = {
    total:     todos.length,
    abertos:   todos.filter(c => c.status === 'ABERTO').length,
    analise:   todos.filter(c => c.status === 'EM ANALISE').length,
    validacao: todos.filter(c => c.status === 'AGUARDANDO VALIDACAO').length,
    concluido: todos.filter(c => c.status === 'CONCLUIDO').length,
    vencidos:  todos.filter(c => c.prazo_limite && new Date(c.prazo_limite) < new Date() && c.status !== 'CONCLUIDO').length,
  };

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
      <h2 style={{ fontSize: '1.25rem', marginBottom: 20 }}>Dashboard</h2>
      <div className="stat-grid">
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-num" style={{ color: s.color }}>{s.num}</div>
            <div className="stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>
      {/* Chamados vencidos em destaque */}
      {counts.vencidos > 0 && (
        <div style={{ padding: '14px 18px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', marginBottom: 24, fontSize: '.875rem', color: '#991B1B' }}>
          ⚠️ <strong>{counts.vencidos} chamado(s)</strong> com SLA vencido requerem atenção imediata.
        </div>
      )}
    </div>
  );
}

// ── App Principal ─────────────────────────────────────────────────────────────
// Decodifica payload do JWT para restaurar sessão sem nova requisição ao servidor
const decodeJwt = (tk) => {
  try {
    const payload = JSON.parse(atob(tk.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null; // expirado
    return { id: payload.id, nome: payload.nome, email: payload.email || '', nivel_acesso: payload.nivel_acesso };
  } catch { return null; }
};

const PAGE_DEFAULTS = { SOLICITANTE: 'meus-chamados', TECNICO: 'bandeja', MASTER_ADMIN: 'dashboard' };

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

  // Conteúdo da página ativa
  const renderPagina = () => {
    switch (pagina) {
      case 'novo-chamado':
        return <NovoChamadoView user={user} api={api} onSucesso={() => { carregar(); setPagina(nivel === 'TECNICO' ? 'bandeja' : 'meus-chamados'); }} />;

      case 'meus-chamados':
        return <ListaChamados titulo="Meus Chamados" chamados={meusChamados} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;

      case 'bandeja':
        return <ListaChamados titulo="Bandeja de Chamados" chamados={disponiveis.filter(c => !c.id_responsavel)} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;

      case 'meus-atend':
        return <ListaChamados titulo="Meus Atendimentos" chamados={disponiveis.filter(c => `${c.id_responsavel}` === `${user.id}`)} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;

      case 'todos-chamados':
        return <ListaChamados titulo="Todos os Chamados" chamados={todos} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;

      case 'dashboard':
        return (
          <div>
            <DashboardView todos={todos} />
            <ListaChamados titulo="Chamados Ativos" chamados={todos.filter(c => c.status !== 'CONCLUIDO')} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />
          </div>
        );

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
        <Sidebar user={user} pagina={pagina} setPagina={setPagina} onSair={sair} />
        <main className="main-content">
          {renderPagina()}
        </main>
      </div>
    </>
  );
}