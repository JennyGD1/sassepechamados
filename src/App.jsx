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
  Alta:  { label: 'Indisponibilidade total do sistema',              desc: 'O sistema está completamente fora do ar ou inacessível para todos os usuários.' },
  Média: { label: 'Falhas parciais ou em módulos secundários',       desc: 'Parte do sistema apresenta falhas, mas a operação principal continua funcionando.' },
  Baixa: { label: 'Impacto baixo, sem prejuízo imediato à operação', desc: 'Problema de baixo impacto, pode aguardar atendimento dentro do prazo normal.' }
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

// ================================================================
// CSS GLOBAL — Estética iMaida
// ================================================================
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

  :root {
    /* Brand Colors */
    --maida-blue:        #0070ff;
    --maida-blue-deep:   #004aad;
    --maida-blue-soft:   #e6f0ff;
    --maida-pink:        #ff0073;
    --maida-pink-soft:   #ffe1ee;
    --maida-yellow:      #ffcc00;
    --maida-yellow-soft: #fff8d6;
    --maida-dark-blue:   #004aad;

    /* Ink (texto) */
    --ink:        #0a0e1a;
    --ink-soft:   #4a5168;
    --ink-faint:  #8893a8;
    --ink-mute:   #c5cbd6;

    /* Paper (fundos) */
    --paper:      #fafbfd;
    --paper-pure: #ffffff;
    --line:       #eef0f5;
    --line-soft:  #f4f6fa;
    --border-color: #eef0f5;

    /* Rounded */
    --r-sm:   10px;
    --r:      18px;
    --r-lg:   26px;
    --r-xl:   36px;
    --r-full: 9999px;
    --radius: 18px;

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06);
    --shadow:    0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -2px rgba(15, 23, 42, 0.04);
    --shadow-md: 0 8px 20px -4px rgba(15, 23, 42, 0.08);
    --shadow-lg: 0 24px 48px -12px rgba(15, 23, 42, 0.10), 0 8px 16px -8px rgba(15, 23, 42, 0.04);
    --shadow-pink: 0 12px 32px -8px rgba(255, 0, 115, 0.30);
    --shadow-blue: 0 12px 32px -8px rgba(0, 112, 255, 0.28);

    /* Motion */
    --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --transition:  all 0.2s var(--ease-out);
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--paper);
    color: var(--ink);
    height: 100vh;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* Mesh decorativo no fundo */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      radial-gradient(at 5% 8%, rgba(0, 112, 255, 0.05) 0px, transparent 50%),
      radial-gradient(at 95% 92%, rgba(255, 0, 115, 0.04) 0px, transparent 50%),
      radial-gradient(at 50% 50%, rgba(255, 204, 0, 0.025) 0px, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  h1, h2, h3, h4, h5 {
    font-family: 'Bricolage Grotesque', 'Inter', sans-serif;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--ink);
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d6dce6; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--maida-blue); }

  ::selection { background: var(--maida-blue); color: white; }

  /* Layout */
  .app-layout { display: flex; min-height: 100vh; position: relative; z-index: 1; }

  /* Sidebar */
  .sidebar {
    width: 280px;
    background: var(--paper-pure);
    display: flex;
    flex-direction: column;
    padding: 24px 20px;
    border-right: 1px solid var(--line);
    flex-shrink: 0;
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 100;
  }

  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 32px;
    padding: 0 8px;
  }

  .sidebar-logo h1 {
    font-family: 'Bricolage Grotesque';
    font-size: 1.45rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .brand-pink { color: var(--maida-pink); }
  .brand-blue { color: var(--maida-blue); }

  .nav-section {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin: 20px 0 6px 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    font-family: 'Inter', sans-serif;
  }

  .nav-item {
    padding: 10px 14px;
    text-decoration: none;
    color: var(--ink-soft);
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: var(--transition);
    font-weight: 500;
    font-size: 0.92rem;
    background: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
    border: none;
  }

  .nav-item svg { width: 18px; height: 18px; stroke-width: 1.8; }

  .nav-item:hover { background: var(--line-soft); color: var(--ink); }

  .nav-item.active {
    background: var(--ink);
    color: white;
    font-weight: 600;
    box-shadow: var(--shadow);
    position: relative;
  }

  .nav-item.active::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    width: 6px;
    height: 6px;
    background: var(--maida-pink);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--maida-pink);
  }

  .sidebar-footer {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid var(--line);
  }

  .sidebar-user {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 14px;
    margin-bottom: 16px;
  }

  .avatar {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, var(--maida-blue), var(--maida-pink));
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .user-info { flex: 1; min-width: 0; }
  .user-name { font-weight: 600; font-size: 0.86rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .user-email { font-size: 0.72rem; color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .nivel-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: .65rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  /* Main Content */
  .main-content {
    margin-left: 280px;
    flex: 1;
    padding: 32px 40px;
    overflow-y: auto;
    background: radial-gradient(at 100% 0%, var(--maida-pink-soft) 0px, transparent 35%),
                radial-gradient(at 0% 100%, var(--maida-blue-soft) 0px, transparent 35%),
                var(--paper);
    min-width: 0;
    height: 100vh;
  }

  /* Top Bar */
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    gap: 16px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }

  .page-title {
    font-family: 'Bricolage Grotesque';
    font-size: 2rem;
    font-weight: 600;
    letter-spacing: -0.03em;
    color: var(--ink);
    margin: 0;
  }

  /* Buttons - Enhanced Styling */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: var(--r-full);
    font-weight: 600;
    font-size: 0.875rem;
    transition: var(--transition);
    cursor: pointer;
    border: none;
    font-family: 'Inter', sans-serif;
    line-height: 1;
    white-space: nowrap;
  }

  .btn svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .btn-primary {
    background: var(--ink);
    color: white;
    box-shadow: var(--shadow);
  }

  .btn-primary:hover { 
    background: var(--maida-blue); 
    transform: translateY(-2px); 
    box-shadow: var(--shadow-blue);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-secondary {
    background: white;
    color: var(--ink-soft);
    border: 1.5px solid var(--line);
  }

  .btn-secondary:hover { 
    background: var(--paper); 
    color: var(--ink); 
    border-color: var(--ink-mute);
    transform: translateY(-1px);
  }

  .btn-danger {
    background: white;
    color: var(--maida-pink);
    border: 1.5px solid var(--maida-pink-soft);
  }

  .btn-danger:hover { 
    background: var(--maida-pink); 
    color: white; 
    border-color: var(--maida-pink);
    transform: translateY(-1px);
  }

  .btn-success {
    background: #10B981;
    color: white;
  }
  
  .btn-success:hover { 
    background: #059669; 
    transform: translateY(-1px);
  }

  .btn-warning {
    background: #F59E0B;
    color: white;
  }
  
  .btn-warning:hover { 
    background: #D97706; 
    transform: translateY(-1px);
  }

  .btn-outline {
    background: transparent;
    color: var(--ink-soft);
    border: 1.5px solid var(--line);
  }

  .btn-outline:hover {
    background: var(--line-soft);
    color: var(--ink);
    border-color: var(--ink-mute);
  }

  .btn-icon {
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    border: 1px solid var(--line);
    background: white;
    color: var(--ink-soft);
    transition: var(--transition);
    cursor: pointer;
  }

  .btn-icon svg {
    width: 14px;
    height: 14px;
  }

  .btn-icon:hover { 
    background: var(--maida-blue); 
    color: white; 
    border-color: var(--maida-blue);
    transform: scale(1.05);
  }

  .btn-sm {
    padding: 6px 14px;
    font-size: 0.75rem;
  }

  .btn-lg {
    padding: 12px 28px;
    font-size: 1rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Cards */
  .card {
    background: var(--paper-pure);
    padding: 24px;
    border-radius: var(--r-lg);
    border: 1px solid var(--line);
    margin-bottom: 22px;
    box-shadow: var(--shadow-sm);
  }

  /* Stats Grid */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 18px;
    margin-bottom: 26px;
  }

  .stat-card {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    padding: 22px;
    background: var(--paper-pure);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    position: relative;
    overflow: hidden;
    transition: transform 0.4s var(--ease-out), box-shadow 0.4s var(--ease-out);
  }

  .stat-card::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.5;
    pointer-events: none;
    transition: opacity 0.4s;
    background: radial-gradient(circle at 85% 15%, var(--maida-blue-soft) 0%, transparent 55%);
  }

  .stat-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
  .stat-card:hover::before { opacity: 1; }

  .stat-icon {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: var(--maida-blue);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
    position: relative;
    z-index: 2;
    box-shadow: 0 6px 14px -4px rgba(0, 112, 255, 0.45);
    flex-shrink: 0;
  }

  .stat-data { position: relative; z-index: 2; }
  .stat-number { font-family: 'Bricolage Grotesque'; font-size: 2.2rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: var(--ink); margin-bottom: 3px; }
  .stat-label { color: var(--ink-soft); font-size: 0.85rem; font-weight: 500; margin: 0; }

  /* Ticket Cards com Corner Cutout */
  .tickets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 22px;
  }

  .chamado-card {
    --accent: var(--maida-blue);
    --corner-bg: var(--paper);
    background: var(--paper-pure);
    border-radius: var(--r-lg);
    padding: 24px;
    padding-top: 20px;
    position: relative;
    border: 1px solid var(--line);
    transition: transform 0.4s var(--ease-out), box-shadow 0.4s var(--ease-out);
    display: flex;
    flex-direction: column;
    isolation: isolate;
    overflow: hidden;
  }

  .chamado-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }

  /* Faixa lateral de status */
  .chamado-card::after {
    content: '';
    position: absolute;
    left: 0;
    top: 20px;
    bottom: 20px;
    width: 3px;
    background: var(--accent);
    border-radius: 0 3px 3px 0;
    opacity: 0.8;
    transition: background 0.3s;
  }

  .chamado-card.sla-ok    { --accent: var(--maida-blue); }
  .chamado-card.sla-vencido { --accent: var(--maida-pink); --corner-bg: #fff5f9; }
  .chamado-card.sla-atencao { --accent: #d49500; --corner-bg: #fffbee; }
  .chamado-card.status-concluido { --accent: #16a34a; --corner-bg: #f0fdf4; }

  /* Corner Cutout */
  .chamado-card .corner {
    position: absolute;
    top: 0;
    right: 0;
    background: var(--corner-bg, var(--paper));
    padding: 9px 14px 10px 14px;
    border-bottom-left-radius: 20px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    z-index: 3;
  }

  .chamado-card .corner::before {
    content: '';
    position: absolute;
    top: 0;
    right: 100%;
    width: 20px;
    height: 20px;
    background: transparent;
    border-top-right-radius: 20px;
    box-shadow: 8px -8px 0 0 var(--corner-bg, var(--paper));
    pointer-events: none;
  }

  .chamado-card .corner::after {
    content: '';
    position: absolute;
    top: 100%;
    right: 0;
    width: 20px;
    height: 20px;
    background: transparent;
    border-top-right-radius: 20px;
    box-shadow: 8px -8px 0 0 var(--corner-bg, var(--paper));
    pointer-events: none;
  }

  /* Corner buttons */
  .corner-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1.5px solid var(--line);
    background: var(--paper-pure);
    color: var(--ink-soft);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.72rem;
    transition: all 0.22s var(--ease-out);
    flex-shrink: 0;
  }

  .corner-btn svg {
    width: 12px;
    height: 12px;
  }

  .corner-btn:hover {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
    transform: scale(1.1);
  }

  .corner-btn.btn-assume  { background: var(--maida-blue); color: white; border-color: var(--maida-blue); }
  .corner-btn.btn-resolve { background: var(--maida-blue); color: white; border-color: var(--maida-blue); }
  .corner-btn.btn-approve { background: #10B981; color: white; border-color: #10B981; }
  .corner-btn.btn-reject  { background: #EF4444; color: white; border-color: #EF4444; }

  /* Conteúdo do card */
  .chamado-card .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-right: 0;
    min-height: 28px;
  }

  .ticket-id {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    padding: 3px 10px 3px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--r-full);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .ticket-title {
    font-family: 'Bricolage Grotesque';
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.3;
    margin-bottom: 12px;
    color: var(--ink);
  }

  .ticket-desc {
    font-size: 13px;
    color: var(--ink-soft);
    line-height: 1.55;
    flex: 1;
    margin-bottom: 16px;
  }

  .ticket-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 14px;
    margin-top: auto;
    border-top: 1px dashed var(--line);
    gap: 12px;
    font-size: 12px;
  }

  /* Inputs */
  .input-field {
    width: 100%;
    padding: 12px 16px;
    border: 1.5px solid var(--line);
    border-radius: 12px;
    font-size: 0.92rem;
    font-family: 'Inter', sans-serif;
    color: var(--ink);
    transition: var(--transition);
    background: white;
    outline: none;
  }

  .input-field:focus { border-color: var(--maida-blue); box-shadow: 0 0 0 4px var(--maida-blue-soft); }

  textarea.input-field { resize: vertical; min-height: 80px; line-height: 1.55; }

  .label {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
    color: var(--ink-soft);
  }

  /* Modais */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10, 14, 26, 0.45);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease;
  }

  .modal {
    background: white;
    width: 560px;
    max-width: 100%;
    max-height: 90vh;
    border-radius: var(--r-lg);
    transform: translateY(20px) scale(0.96);
    transition: transform 0.4s var(--ease-spring);
    box-shadow: 0 30px 80px -20px rgba(10, 14, 26, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-overlay .modal {
    transform: translateY(0) scale(1);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 26px;
    background: var(--paper);
    border-bottom: 1px solid var(--line);
  }

  .modal-header h2 { font-size: 1.25rem; margin: 0; }

  .modal-body { flex: 1; overflow-y: auto; padding: 24px 26px; }

  /* Button group */
  .button-group {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* Animations */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .sidebar {
      position: fixed;
      left: -290px;
      transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
    }
    .sidebar.open { left: 0; }
    .main-content { margin-left: 0; width: 100%; padding: 24px; }
    .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }

  @media (max-width: 768px) {
    .stat-grid { grid-template-columns: 1fr !important; }
    .tickets-grid { grid-template-columns: 1fr; }
    .top-bar .btn-primary { display: none; }
    .main-content { padding: 18px; }
    .page-title { font-size: 1.4rem; }
    .btn { padding: 8px 16px; font-size: 0.8rem; }
  }
`;

// ── Componentes iMaida ──────────────────────────────────────────────────────────

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
    <div className="card" style={{ background: 'linear-gradient(135deg, #1A1714 0%, #2d2926 100%)', color: '#fff', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: '1.75rem' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '.7rem', opacity: .7, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Prazo SLA</div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{data.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
          <div style={{ fontSize: '.8rem', opacity: .65, marginTop: 2 }}>{horas}h a partir da abertura</div>
        </div>
      </div>
    </div>
  );
}

function CriticidadeBalloon({ crit }) {
  if (!crit) return null;
  const info = CRITICIDADE_INFO[crit];
  const color = CRIT_COLOR[crit];
  return (
    <div className="card" style={{ background: color + '12', borderColor: color, marginTop: 12, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill={color}/></svg>
        <strong style={{ fontSize: '.875rem', color }}>{info.label}</strong>
      </div>
      <p style={{ fontSize: '.8125rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{info.desc}</p>
    </div>
  );
}

// ── Histórico e Modais Auxiliares ─────────────────────────────────────────────
const ACAO_META = {
  ABERTURA:   { label: 'Abertura',   color: '#10B981' },
  ATRIBUICAO: { label: 'Atribuição', color: '#3B82F6' },
  RESOLUCAO:  { label: 'Resolução',  color: '#F59E0B' },
  APROVACAO:  { label: 'Aprovação',  color: '#10B981' },
  RECUSA:     { label: 'Recusa',     color: '#EF4444' },
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
      <div className="modal-header">
        <div>
          <div className="label">Histórico do Chamado</div>
          <h2>{chamado.numero_chamado}</h2>
        </div>
        <button className="btn-icon" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="modal-body">
        <div className="card" style={{ padding: 12, marginBottom: 20, background: 'var(--paper)' }}>
          {chamado.descricao}
        </div>
        {loading ? <p style={{ textAlign: 'center', padding: 20 }}>Carregando…</p> : hist.map((h, i) => {
          const meta = ACAO_META[h.acao] || { icon: '•', label: h.acao, color: 'var(--ink-mute)' };
          return (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: meta.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{meta.label}</span>
                  <span style={{ fontSize: '.75rem', color: 'var(--ink-faint)' }}>{fmt(h.data_hora)}</span>
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--ink-soft)', marginBottom: 4 }}>por {h.nome_completo}</div>
                {h.comentario && <div className="card" style={{ padding: 8, background: 'var(--paper)', marginTop: 4 }}>{h.comentario}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function ResolucaoModal({ chamado, onClose, onConfirm }) {
  const [texto, setTexto] = useState('');
  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h2>Finalizar Atendimento</h2>
        <button className="btn-icon" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="modal-body">
        <p style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>Descreva a solução aplicada. O solicitante deverá validar antes do chamado ser encerrado.</p>
        <div style={{ marginBottom: 20 }}>
          <label className="label">Descrição da Resolução</label>
          <textarea className="input-field" rows={5} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Descreva detalhadamente o que foi feito…" />
        </div>
        <div className="button-group" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-success" disabled={!texto.trim()} onClick={() => onConfirm(texto)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Enviar para Validação
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Card de Chamado (Estilo iMaida com Corner Cutout) ──────────────────────────
// ── Card de Chamado (Estilo iMaida com Corner Cutout) ──────────────────────────
function ChamadoCard({ c, userId, nivel, onAssumir, onFechar, onValidar, onHistorico }) {
  const isMeu       = `${c.id_solicitante}` === `${userId}`;
  const isResp      = `${c.id_responsavel}` === `${userId}`;
  const vencido     = c.prazo_limite && new Date(c.prazo_limite) < new Date() && c.status !== 'CONCLUIDO';
  const podeAssumir = !c.id_responsavel && !isMeu && (nivel === 'TECNICO' || nivel === 'MASTER_ADMIN');

  let slaClass = 'sla-ok';
  if (c.status === 'CONCLUIDO') slaClass = 'status-concluido';
  else if (vencido) slaClass = 'sla-vencido';
  else if (c.prazo_limite) {
    const diffH = (new Date(c.prazo_limite) - new Date()) / 36e5;
    if (diffH < 4) slaClass = 'sla-atencao';
  }

  const statusColor = STATUS_COLOR[c.status] || '#888';
  const podeEditar  = (isMeu || nivel === 'MASTER_ADMIN') && c.status !== 'CONCLUIDO';

  // Funções auxiliares para os botões
  const handleAssumir = (e) => {
    e.stopPropagation();
    onAssumir(c.id);
  };

  const handleEditar = (e) => {
    e.stopPropagation();
    // Implementar edição se necessário
    console.log('Editar chamado', c.id);
  };

  const handleFechar = (e) => {
    e.stopPropagation();
    onFechar(c);
  };

  const handleAprovar = (e) => {
    e.stopPropagation();
    onValidar(c.id, true);
  };

  const handleRejeitar = (e) => {
    e.stopPropagation();
    onValidar(c.id, false);
  };

  return (
    <div className={`chamado-card ${slaClass}`}>
      {/* Corner cutout com botões */}
      <div className="corner">
        {podeEditar && (
          <button className="corner-btn" title="Editar" onClick={handleEditar}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
        {podeAssumir && (
          <button className="corner-btn btn-assume" title="Assumir Chamado" onClick={handleAssumir}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/>
              <line x1="10" y1="1" x2="10" y2="4"/>
              <line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </button>
        )}
        {((isResp || nivel === 'MASTER_ADMIN') && c.status === 'EM ANALISE') && (
          <button className="corner-btn btn-resolve" title="Finalizar Atendimento" onClick={handleFechar}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        )}
        {(isMeu && c.status === 'AGUARDANDO VALIDACAO') && (
          <>
            <button className="corner-btn btn-approve" title="Aprovar resolução" onClick={handleAprovar}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
            </button>
            <button className="corner-btn btn-reject" title="Recusar resolução" onClick={handleRejeitar}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Header: ID + botão histórico */}
      <div className="ticket-header">
        <div className="ticket-id">#{c.numero_chamado}</div>
        <button
          className="corner-btn"
          style={{ marginRight: 4 }}
          title="Histórico"
          onClick={(e) => {
            e.stopPropagation();
            onHistorico(c);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
      </div>

      {/* Badges de status */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <Badge label={c.criticidade}                       color={CRIT_COLOR[c.criticidade]} />
        <Badge label={`Compl. ${c.complexidade}`}          color="#6B7280" />
        <Badge label={STATUS_LABEL[c.status] || c.status}  color={statusColor} />
        {vencido && <Badge label="SLA" color="#EF4444" />}
      </div>

      {/* Título / descrição resumida */}
      <div className="ticket-title">
        {c.descricao.length > 85 ? c.descricao.substring(0, 85) + '…' : c.descricao}
      </div>

      {/* Footer */}
      <div className="ticket-footer">
        <div>
          <div><strong>Solicitante:</strong> {c.solicitante_nome?.split(' ')[0] || c.solicitante_nome}</div>
          <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: 2 }}>Aberto: {fmt(c.data_abertura)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>Responsável:</strong> {c.responsavel_nome?.split(' ')[0] || c.responsavel_nome || '—'}</div>
          <div style={{ fontSize: '11px', color: vencido ? '#EF4444' : 'var(--ink-faint)', marginTop: 2, fontWeight: vencido ? 700 : 400 }}>
            SLA: {fmt(c.prazo_limite)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tela de Login (Estilizada iMaida) ─────────────────────────────────────────
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', padding: 20, position: 'relative', zIndex: 1 }}>
      <div style={{ width: 420, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="sidebar-logo" style={{ justifyContent: 'center', padding: 0 }}>
            <h1><span className="brand-pink">i</span><span className="brand-blue">Maida</span></h1>
          </div>
          <p style={{ color: 'var(--ink-soft)', fontSize: '.875rem' }}>Central de Chamados — Área Técnica</p>
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
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 13 }} disabled={loading} type="submit">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar (Estilo iMaida) ───────────────────────────────────────────────────
const NIVEL_META = {
  SOLICITANTE:  { label: 'Solicitante',  color: '#F59E0B' },
  TECNICO:      { label: 'Técnico',      color: '#3B82F6' },
  MASTER_ADMIN: { label: 'Master Admin', color: '#8B5CF6' },
};

function Sidebar({ user, pagina, setPagina, onSair, onAbrirPerfil }) {
  const nivel = user?.nivel_acesso || 'SOLICITANTE';
  const meta  = NIVEL_META[nivel] || NIVEL_META.SOLICITANTE;

  const navSolicitante = [
    { id: 'dashboard',      icon: <path d="M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zM3 14h7v7H3z"/>, label: 'Dashboard' },
    { id: 'meus-chamados',  icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>, label: 'Meus Chamados' },
    { id: 'novo-chamado',   icon: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, label: 'Abrir Chamado' },
  ];

  const navTecnico = [
    { id: 'dashboard',      icon: <path d="M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zM3 14h7v7H3z"/>, label: 'Dashboard' },
    { id: 'bandeja',        icon: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>, label: 'Bandeja' },
    { id: 'meus-atend',     icon: <path d="M13 2L3 14h8l-2 8 10-12h-8z"/>, label: 'Meus Atendimentos' },
  ];

  const navAdmin = [
    { id: 'dashboard',      icon: <path d="M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zM3 14h7v7H3z"/>, label: 'Dashboard' },
    { id: 'todos-chamados', icon: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>, label: 'Todos os Chamados' },
    { id: 'meus-chamados',  icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>, label: 'Meus Chamados' },
    { id: 'novo-chamado',   icon: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, label: 'Abrir Chamado' },
    { id: 'bandeja',        icon: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>, label: 'Bandeja' },
    { id: 'usuarios',       icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>, label: 'Usuários' },
    { id: 'logs-visualizacao', icon: <><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>, label: 'Logs' },
  ];

  const items = nivel === 'MASTER_ADMIN' ? navAdmin : nivel === 'TECNICO' ? navTecnico : navSolicitante;

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <h1><span className="brand-pink">i</span><span className="brand-blue">Maida</span></h1>
      </div>
      <div className="nav-section">Menu</div>
      {items.map(item => (
        <button key={item.id} className={`nav-item${pagina === item.id ? ' active' : ''}`} onClick={() => setPagina(item.id)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {item.icon}
          </svg>
          {item.label}
        </button>
      ))}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">{user?.nome?.charAt(0).toUpperCase() || 'U'}</div>
          <div className="user-info">
            <div className="user-name">{user?.nome}</div>
            <div className="user-email">{user?.email}</div>
            <span className="nivel-badge" style={{ background: meta.color + '30', color: meta.color }}>{meta.label}</span>
          </div>
        </div>
        <button className="btn btn-outline" style={{ width: '100%', marginBottom: '8px' }} onClick={onAbrirPerfil}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Meu Perfil
        </button>
        <button className="btn btn-outline" style={{ width: '100%' }} onClick={onSair}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair
        </button>
      </div>
    </nav>
  );
}

// ── View: Novo Chamado (Estilo iMaida) ───────────────────────────────────────
function NovoChamadoView({ user, api, onSucesso }) {
  const [form, setForm] = useState({ descricao: '', criticidade: '', complexidade: 'Média' });
  const [salvando, setSalvando] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!form.criticidade) return;
    setSalvando(true);
    const data = await api('/chamados', { method: 'POST', body: JSON.stringify(form) });
    if (data?.id) { setForm({ descricao: '', criticidade: '', complexidade: 'Média' }); onSucesso(); }
    setSalvando(false);
  };

  return (
    <div>
      <div className="top-bar">
        <h1 className="page-title">Abrir Novo Chamado</h1>
      </div>
      <p style={{ color: 'var(--ink-soft)', marginBottom: 28 }}>Preencha os dados abaixo para registrar um novo protocolo.</p>

      <div className="card" style={{ maxWidth: 680 }}>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22, opacity: .6 }}>
            <div>
              <label className="label">Responsável</label>
              <input className="input-field" value={user?.nome || ''} readOnly />
            </div>
            <div>
              <label className="label">Data / Hora</label>
              <input className="input-field" value={new Date().toLocaleString('pt-BR')} readOnly />
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <label className="label">Descrição do Problema *</label>
            <textarea className="input-field" rows={4} required value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva o problema com detalhes suficientes para diagnóstico…" />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label className="label">Grau de Criticidade *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {['Alta', 'Média', 'Baixa'].map(c => {
                const descMap = { Alta: 'Sistema fora do ar', Média: 'Falhas parciais', Baixa: 'Baixo impacto' };
                const isSel = form.criticidade === c;
                return (
                  <div key={c} className="card" style={{ padding: 14, cursor: 'pointer', borderColor: isSel ? CRIT_COLOR[c] : 'var(--line)', background: isSel ? CRIT_COLOR[c] + '12' : 'var(--paper-pure)' }} onClick={() => setForm({ ...form, criticidade: c })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: CRIT_COLOR[c], display: 'inline-block' }} />
                      <strong>{c}</strong>
                    </div>
                    <div style={{ fontSize: '.7rem', color: 'var(--ink-soft)' }}>{descMap[c]}</div>
                  </div>
                );
              })}
            </div>
            <CriticidadeBalloon crit={form.criticidade} />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label className="label">Grau de Complexidade *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {['Alta', 'Média', 'Baixa'].map(cp => {
                const isSel = form.complexidade === cp;
                return (
                  <div key={cp} className="card" style={{ padding: 14, cursor: 'pointer', textAlign: 'center', borderColor: isSel ? 'var(--maida-blue)' : 'var(--line)', background: isSel ? 'var(--maida-blue-soft)' : 'var(--paper-pure)' }} onClick={() => setForm({ ...form, complexidade: cp })}>
                    <strong>{cp}</strong>
                    <div style={{ fontSize: '.7rem', color: 'var(--ink-soft)', marginTop: 4 }}>{cp === 'Alta' ? 'Solução complexa' : cp === 'Média' ? 'Solução moderada' : 'Solução simples'}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--maida-blue)', marginTop: 4, fontWeight: 600 }}>
                        {form.criticidade ? `${PRAZO_HORAS[form.criticidade][cp]}h de SLA` : 'SLA pendente'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {form.criticidade && <SlaBox crit={form.criticidade} comp={form.complexidade} />}

          <div className="button-group">
            <button className="btn btn-primary" type="submit" disabled={salvando || !form.descricao || !form.criticidade}>
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
  const [histModal, setHistModal] = useState(null);
  const [resolModal, setResolModal] = useState(null);

  useEffect(() => {
    if (registrarVisualizacao && chamados.length >= 0) {
      const registrar = async () => {
        try { await api('/logs/visualizacao-bandeja', { method: 'POST', body: JSON.stringify({ totalChamadosVisiveis: chamados.length }) }); } catch (err) { console.debug(err); }
      };
      registrar();
    }
  }, [registrarVisualizacao, chamados.length, api]);

  const assumir  = async id => { await api(`/chamados/${id}/assumir`, { method: 'PUT' }); onRecarregar(); };
  const fechar   = async (ch, txt) => { await api(`/chamados/${ch.id}/fechar`, { method: 'PUT', body: JSON.stringify({ descricaoResolucao: txt }) }); setResolModal(null); onRecarregar(); };
  const validar  = async (id, ok) => { await api(`/chamados/${id}/validar`, { method: 'PUT', body: JSON.stringify({ aprovado: ok }) }); onRecarregar(); };

  return (
    <div>
      <div className="top-bar">
        <h1 className="page-title">{titulo}</h1>
      </div>
      {chamados.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
          </div>
          <p>Nenhum chamado encontrado.</p>
        </div>
      ) : (
        <div className="tickets-grid">
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
      <div className="modal-header">
        <h2>{isEdicao ? 'Editar Usuário' : 'Novo Usuário'}</h2>
        <button className="btn-icon" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="modal-body">
        {erro && <div className="card" style={{ background: '#FEF2F2', color: '#EF4444', marginBottom: 16 }}>{erro}</div>}
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
            <label className="label">{isEdicao ? 'Nova Senha' : 'Senha *'}</label>
            <input className="input-field" type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder="••••••••" />
          </div>
          <div>
            <label className="label">Cargo / Função</label>
            <input className="input-field" value={form.cargo_nome} onChange={e => setForm({ ...form, cargo_nome: e.target.value })} placeholder="Ex: Analista de TI" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
            <input type="checkbox" id="ativo-chk" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--maida-blue)' }} />
            <label htmlFor="ativo-chk">Usuário ativo</label>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label className="label">Nível de Acesso *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {CARGOS.map(c => (
              <div key={c.id} className="card" style={{ padding: 12, cursor: 'pointer', borderColor: form.nivel_acesso === c.id ? c.color : 'var(--line)', background: form.nivel_acesso === c.id ? c.color + '12' : 'var(--paper-pure)' }} onClick={() => setForm({ ...form, nivel_acesso: c.id })}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                  <strong style={{ color: form.nivel_acesso === c.id ? c.color : 'var(--ink)' }}>{c.label}</strong>
                </div>
                <p style={{ fontSize: '.72rem', color: 'var(--ink-soft)' }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="button-group" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={salvando} onClick={submit}>
            {salvando ? 'Salvando…' : (isEdicao ? 'Salvar' : 'Cadastrar')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UsuariosView({ api }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('TODOS');
  const [confirmDel, setConfirmDel] = useState(null);
  const [toast, setToast] = useState(null);

  const mostrarToast = (msg, tipo = 'ok') => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };
  const carregar = async () => { setLoading(true); const d = await api('/usuarios'); if (d) setUsuarios(d); setLoading(false); };
  useEffect(() => { carregar(); }, []);

  const salvar = async (form, id) => {
    const endpoint = id ? `/usuarios/${id}` : '/usuarios';
    const method = id ? 'PUT' : 'POST';
    const res = await api(endpoint, { method, body: JSON.stringify(form) });
    if (!res || res.error) return false;
    mostrarToast(id ? 'Usuário atualizado.' : 'Usuário cadastrado.');
    setModal(null); carregar(); return true;
  };

  const toggleAtivo = async (u) => {
    await api(`/usuarios/${u.id}`, { method: 'PUT', body: JSON.stringify({ ...u, ativo: !u.ativo }) });
    mostrarToast(`Usuário ${!u.ativo ? 'ativado' : 'desativado'}.`); carregar();
  };
  const excluir = async (id) => { await api(`/usuarios/${id}`, { method: 'DELETE' }); mostrarToast('Usuário removido.', 'err'); carregar(); setConfirmDel(null); };

  const listagem = usuarios.filter(u => {
    const ok = filtroNivel === 'TODOS' || u.nivel_acesso === filtroNivel;
    const q = busca.toLowerCase();
    return ok && (!q || u.nome_completo.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  return (
    <div>
      {toast && <div className="card" style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 2000, display: 'flex', alignItems: 'center', gap: 8, background: toast.tipo === 'err' ? '#FEF2F2' : '#F0FDF4', color: toast.tipo === 'err' ? '#991B1B' : '#166534', borderLeft: `3px solid ${toast.tipo === 'err' ? '#EF4444' : '#10B981'}` }}>
        {toast.tipo === 'err'
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        {toast.msg}
      </div>}
      <div className="top-bar">
        <h1 className="page-title">Gerenciamento de Usuários</h1>
        <button className="btn btn-primary" onClick={() => setModal('novo')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo Usuário
        </button>
      </div>

      <div className="stat-grid">
        {[{ num: usuarios.length, lbl: 'Total', color: 'var(--ink)' }, { num: usuarios.filter(u => u.ativo).length, lbl: 'Ativos', color: '#10B981' }, { num: usuarios.filter(u => !u.ativo).length, lbl: 'Inativos', color: '#EF4444' }].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-number" style={{ color: s.color }}>{s.num}</div>
            <div className="stat-label">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input className="input-field" style={{ maxWidth: 280 }} placeholder="Buscar por nome ou e-mail…" value={busca} onChange={e => setBusca(e.target.value)} />
        <div className="button-group">
          {['TODOS', 'SOLICITANTE', 'TECNICO', 'MASTER_ADMIN'].map(n => {
            const meta = n === 'TODOS' ? { label: 'Todos', color: 'var(--ink)' } : NIVEL_META[n];
            return <button key={n} className={`btn btn-outline btn-sm${filtroNivel === n ? ' active' : ''}`} onClick={() => setFiltroNivel(n)}>{meta.label}</button>;
          })}
        </div>
      </div>

      {loading ? <div className="card" style={{ textAlign: 'center' }}>Carregando…</div> : listagem.length === 0 ? <div className="card" style={{ textAlign: 'center' }}>Nenhum usuário encontrado.</div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
                {['Nome', 'E-mail', 'Nível', 'Cargo', 'Status', 'Ações'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '.68rem', fontWeight: 700 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {listagem.map(u => {
                const nvMeta = NIVEL_META[u.nivel_acesso] || NIVEL_META.SOLICITANTE;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{u.nome_completo}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}><span className="badge" style={{ background: nvMeta.color + '20', color: nvMeta.color }}>{nvMeta.label}</span></td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{u.cargo_nome || '—'}</td>
                    <td style={{ padding: '12px 16px' }}><span className="badge" style={{ background: u.ativo ? '#D1FAE5' : '#FEE2E2', color: u.ativo ? '#065F46' : '#991B1B' }}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td style={{ padding: '12px 16px' }}>
                      <div className="button-group" style={{ gap: 6 }}>
                        <button className="btn-icon" style={{ width: 32, height: 32 }} title="Editar" onClick={() => setModal(u)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button className="btn-icon" style={{ width: 32, height: 32, color: u.ativo ? '#EF4444' : '#10B981' }} title={u.ativo ? 'Desativar' : 'Ativar'} onClick={() => toggleAtivo(u)}>
                          {u.ativo
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                        <button className="btn-icon" style={{ width: 32, height: 32, color: '#EF4444' }} title="Excluir" onClick={() => setConfirmDel(u)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal && <UsuarioModal usuario={modal === 'novo' ? null : modal} onClose={() => setModal(null)} onSalvar={salvar} />}
      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)}>
          <div className="modal-header"><h2>Excluir Usuário</h2><button className="btn-icon" onClick={() => setConfirmDel(null)}>✕</button></div>
          <div className="modal-body">
            <p>Tem certeza que deseja excluir <strong>{confirmDel.nome_completo}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="button-group" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => excluir(confirmDel.id)}>
                Excluir
              </button>
            </div>
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

  const mostrarToast = (msg, tipo = 'ok') => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };
  const carregarLogs = async () => {
    setLoading(true);
    try {
      const data = await api(`/admin/logs-visualizacao?limit=${limit}&offset=${offset}`);
      if (data) { setLogs(data.logs || []); setTotal(data.total || 0); }
    } catch (err) { mostrarToast('Erro ao carregar logs', 'err'); } finally { setLoading(false); }
  };
  useEffect(() => { carregarLogs(); }, [limit, offset]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const excluirLog = async (id) => { await api(`/admin/logs-visualizacao/${id}`, { method: 'DELETE' }); mostrarToast('Log excluído!'); carregarLogs(); setConfirmDelete(null); };
  const excluirTodosLogs = async () => { await api('/admin/logs-visualizacao?all=true', { method: 'DELETE' }); mostrarToast('Todos os logs foram excluídos!'); carregarLogs(); setConfirmDelete(null); };
  const excluirLogsPorUsuario = async (usuarioId) => { await api(`/admin/logs-visualizacao?usuarioId=${usuarioId}`, { method: 'DELETE' }); mostrarToast('Logs do usuário excluídos!'); carregarLogs(); setConfirmDelete(null); };

  const logsFiltrados = logs.filter(log => !filtroUsuario || log.nome_completo.toLowerCase().includes(filtroUsuario.toLowerCase()) || log.email.toLowerCase().includes(filtroUsuario.toLowerCase()));

  return (
    <div>
      {toast && <div className="card" style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 2000, display: 'flex', alignItems: 'center', gap: 8, background: toast.tipo === 'err' ? '#FEF2F2' : '#F0FDF4', color: toast.tipo === 'err' ? '#991B1B' : '#166534', borderLeft: `3px solid ${toast.tipo === 'err' ? '#EF4444' : '#10B981'}` }}>
        {toast.tipo === 'err'
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        {toast.msg}
      </div>}
      <div className="top-bar">
        <h1 className="page-title">Logs de Visualização</h1>
        <div className="button-group">
          <button className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
          <button className="btn btn-danger" onClick={() => setConfirmDelete({ type: 'all' })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            Limpar Todos
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div><label className="label">Filtrar por Usuário</label><input className="input-field" placeholder="Nome ou e-mail..." value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} /></div>
            <div><label className="label">Data Início</label><input className="input-field" type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
            <div><label className="label">Data Fim</label><input className="input-field" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
          </div>
        </div>
      )}

      <div className="stat-grid">
        {[{ num: total, lbl: 'Total de Visualizações', color: 'var(--ink)' }, { num: logsFiltrados.length, lbl: 'Registros Exibidos', color: '#3B82F6' }, { num: new Set(logs.map(l => l.id_usuario)).size, lbl: 'Usuários Únicos', color: '#10B981' }].map((s, i) => (
          <div key={i} className="stat-card"><div className="stat-number" style={{ color: s.color }}>{s.num}</div><div className="stat-label">{s.lbl}</div></div>
        ))}
      </div>

      {loading ? <div className="card" style={{ textAlign: 'center' }}>Carregando logs...</div> : logsFiltrados.length === 0 ? <div className="card" style={{ textAlign: 'center' }}>Nenhum log encontrado.</div> : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
                  {['ID', 'Usuário', 'E-mail', 'Nível', 'Data', 'Chamados', 'Ações'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '.68rem', fontWeight: 700 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {logsFiltrados.map((log, i) => {
                  const nivelColor = log.nivel_acesso === 'MASTER_ADMIN' ? '#8B5CF6' : log.nivel_acesso === 'TECNICO' ? '#3B82F6' : '#F59E0B';
                  return (
                    <tr key={log.id} style={{ borderBottom: i < logsFiltrados.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>#{log.id}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.nome_completo}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--ink-soft)' }}>{log.email}</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge" style={{ background: nivelColor + '20', color: nivelColor }}>{log.nivel_acesso || 'SOLICITANTE'}</span></td>
                      <td style={{ padding: '12px 16px' }}>{new Date(log.data_visualizacao).toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge" style={{ background: '#3B82F620', color: '#3B82F6' }}>{log.total_chamados_visiveis} chamados</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        <div className="button-group" style={{ gap: 6 }}>
                          <button className="btn-icon" style={{ width: 32, height: 32, color: '#EF4444' }} title="Excluir log" onClick={() => setConfirmDelete({ type: 'single', id: log.id })}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                            </svg>
                          </button>
                          <button className="btn-icon" style={{ width: 32, height: 32, color: '#F59E0B' }} title="Excluir logs do usuário" onClick={() => setConfirmDelete({ type: 'user', usuarioId: log.id_usuario, nome: log.nome_completo })}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="button-group" style={{ justifyContent: 'center', marginTop: 24 }}>
              <button className="btn btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>← Anterior</button>
              <span style={{ padding: '8px 16px', background: 'var(--paper-pure)', border: '1px solid var(--line)', borderRadius: 8 }}>Página {currentPage} de {totalPages}</span>
              <button className="btn btn-secondary" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>Próxima →</button>
            </div>
          )}
        </>
      )}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div className="modal-header"><h2>{confirmDelete.type === 'all' ? 'Limpar Todos os Logs' : confirmDelete.type === 'user' ? `Excluir Logs de ${confirmDelete.nome}` : 'Excluir Log'}</h2><button className="btn-icon" onClick={() => setConfirmDelete(null)}>✕</button></div>
          <div className="modal-body">
            <p>{confirmDelete.type === 'all' && 'Tem certeza que deseja excluir TODOS os logs?'}{confirmDelete.type === 'user' && `Tem certeza que deseja excluir todos os logs do usuário "${confirmDelete.nome}"?`}{confirmDelete.type === 'single' && 'Tem certeza que deseja excluir este log?'}</p>
            <div className="button-group" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { if (confirmDelete.type === 'all') excluirTodosLogs(); else if (confirmDelete.type === 'user') excluirLogsPorUsuario(confirmDelete.usuarioId); else excluirLog(confirmDelete.id); }}>Excluir</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── View: Dashboard (Estilo iMaida) ─────────────────────────────────────────
// ── View: Dashboard (Estilo iMaida) ─────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function gerarCompetencias() { const now = new Date(); const lista = []; for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); lista.push({ mes: d.getMonth() + 1, ano: d.getFullYear(), label: `${MESES[d.getMonth()]}/${d.getFullYear()}` }); } return lista.reverse(); }

function DashboardView({ api, user }) {
  const now = new Date();
  const competencias = gerarCompetencias();
  const [competencia, setCompetencia] = useState({ mes: now.getMonth() + 1, ano: now.getFullYear() });
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const carregar = useCallback(async () => { setLoading(true); const data = await api(`/chamados/dashboard?mes=${competencia.mes}&ano=${competencia.ano}`); if (data) setChamados(data); setLoading(false); }, [api, competencia.mes, competencia.ano]);
  useEffect(() => { carregar(); }, [carregar]);

  const counts = { total: chamados.length, abertos: chamados.filter(c => c.status === 'ABERTO').length, analise: chamados.filter(c => c.status === 'EM ANALISE').length, validacao: chamados.filter(c => c.status === 'AGUARDANDO VALIDACAO').length, concluido: chamados.filter(c => c.status === 'CONCLUIDO').length, vencidos: chamados.filter(c => c.prazo_limite && new Date(c.prazo_limite) < new Date() && c.status !== 'CONCLUIDO').length, alta: chamados.filter(c => c.criticidade === 'Alta').length, media: chamados.filter(c => c.criticidade === 'Média').length, baixa: chamados.filter(c => c.criticidade === 'Baixa').length };
  const taxaConclusao = counts.total > 0 ? Math.round((counts.concluido / counts.total) * 100) : 0;
  const slaMediaHoras = chamados.filter(c => c.status === 'CONCLUIDO' && c.data_abertura && c.data_fechamento).length > 0 ? Math.round(chamados.filter(c => c.status === 'CONCLUIDO' && c.data_abertura && c.data_fechamento).reduce((acc, c) => acc + (new Date(c.data_fechamento) - new Date(c.data_abertura)) / 3_600_000, 0) / chamados.filter(c => c.status === 'CONCLUIDO' && c.data_abertura && c.data_fechamento).length) : null;

  const labelCompetencia = `${MESES[competencia.mes - 1]}/${competencia.ano}`;

  return (
    <div>
      <div className="top-bar">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-secondary" onClick={() => setShowPicker(v => !v)}>
            {labelCompetencia} ▾
          </button>
          {showPicker && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200, background: 'var(--paper-pure)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', padding: '8px 0', minWidth: 200, maxHeight: 260, overflowY: 'auto' }}>
              {competencias.map((c, i) => {
                const ativo = c.mes === competencia.mes && c.ano === competencia.ano;
                return (
                  <button key={i} onClick={() => { setCompetencia({ mes: c.mes, ano: c.ano }); setShowPicker(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 18px', background: ativo ? 'var(--maida-blue)' : 'transparent', color: ativo ? '#fff' : 'var(--ink)', border: 'none', cursor: 'pointer', fontSize: '.875rem', fontWeight: ativo ? 600 : 400 }}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {loading ? <div className="card" style={{ textAlign: 'center' }}>Carregando…</div> : (
        <>
          {counts.vencidos > 0 && <div className="card" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B', marginBottom: 20 }}><strong>{counts.vencidos} chamado(s)</strong> com SLA vencido.</div>}
          {counts.total === 0 ? <div className="card" style={{ textAlign: 'center' }}>Nenhum chamado encontrado em {labelCompetencia}.</div> : (
            <>
              <div className="stat-grid">
                {[
                  { num: counts.total, lbl: 'Total', color: 'var(--ink)' }, 
                  { num: counts.abertos, lbl: 'Abertos', color: '#F59E0B' }, 
                  { num: counts.analise, lbl: 'Em Análise', color: '#3B82F6' }, 
                  { num: counts.validacao, lbl: 'Aguard. Validação', color: '#8B5CF6' }, 
                  { num: counts.concluido, lbl: 'Concluídos', color: '#10B981' }, 
                  { num: counts.vencidos, lbl: 'SLA Vencido', color: '#EF4444' }
                ].map((s, i) => (
                  <div key={i} className="stat-card">
                    <div className="stat-number" style={{ color: s.color }}>{s.num}</div>
                    <div className="stat-label">{s.lbl}</div>
                  </div>
                ))}
              </div>

              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-number" style={{ color: '#10B981' }}>{taxaConclusao}%</div>
                  <div className="stat-label">Taxa de Conclusão</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number" style={{ color: '#EF4444' }}>{counts.alta}</div>
                  <div className="stat-label">Criticidade Alta</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number" style={{ color: '#F59E0B' }}>{counts.media}</div>
                  <div className="stat-label">Criticidade Média</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number" style={{ color: '#10B981' }}>{counts.baixa}</div>
                  <div className="stat-label">Criticidade Baixa</div>
                </div>
                {slaMediaHoras !== null && (
                  <div className="stat-card">
                    <div className="stat-number" style={{ color: 'var(--maida-blue)' }}>{slaMediaHoras}h</div>
                    <div className="stat-label">Tempo Médio de Resolução</div>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 16 }}>Distribuição por Status</h3>
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 28, gap: 2 }}>
                  {[
                    { val: counts.abertos, color: '#F59E0B', lbl: 'Aberto' }, 
                    { val: counts.analise, color: '#3B82F6', lbl: 'Em Análise' }, 
                    { val: counts.validacao, color: '#8B5CF6', lbl: 'Aguard. Validação' }, 
                    { val: counts.concluido, color: '#10B981', lbl: 'Concluído' }
                  ].filter(s => s.val > 0).map((s, i) => (
                    <div key={i} title={`${s.lbl}: ${s.val}`} style={{ flex: s.val, background: s.color, borderRadius: 4, minWidth: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.7rem', fontWeight: 700 }}>
                      {s.val > 2 ? `${s.val}` : ''}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                  <strong>Chamados — {labelCompetencia}</strong> <span style={{ color: 'var(--ink-soft)' }}>({chamados.length} registros)</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--paper)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Número</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Criticidade</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Complexidade</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Solicitante</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Responsável</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Abertura</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Prazo SLA</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chamados.map((c, i) => {
                        const vencido = c.prazo_limite && new Date(c.prazo_limite) < new Date() && c.status !== 'CONCLUIDO';
                        return (
                          <tr key={c.id} style={{ borderBottom: i < chamados.length - 1 ? '1px solid var(--line)' : 'none' }}>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{c.numero_chamado}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className="badge" style={{ background: (STATUS_COLOR[c.status] || '#888') + '20', color: STATUS_COLOR[c.status] || '#888' }}>
                                {STATUS_LABEL[c.status] || c.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className="badge" style={{ background: (CRIT_COLOR[c.criticidade] || '#888') + '20', color: CRIT_COLOR[c.criticidade] || '#888' }}>
                                {c.criticidade}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--ink-soft)' }}>{c.complexidade}</td>
                            <td style={{ padding: '10px 14px' }}>{c.solicitante_nome || '—'}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--ink-soft)' }}>{c.responsavel_nome || '—'}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--ink-soft)' }}>{fmt(c.data_abertura)}</td>
                            <td style={{ padding: '10px 14px', color: vencido ? '#EF4444' : 'var(--ink-soft)', fontWeight: vencido ? 700 : 400 }}>
                              {fmt(c.prazo_limite)}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {vencido ? 
                                <span className="badge" style={{ background: '#FEE2E2', color: '#DC2626' }}>Vencido</span> : 
                                <span className="badge" style={{ background: '#D1FAE5', color: '#065F46' }}>OK</span>
                              }
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
  const [form, setForm] = useState({ nome_completo: user?.nome || '', email: user?.email || '', senha_atual: '', nova_senha: '', confirmar_nova_senha: '' });
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const submit = async () => {
    setErro('');
    if (!form.nome_completo.trim()) { setErro('Nome é obrigatório.'); return; }
    if (alterandoSenha && form.nova_senha) {
      if (form.nova_senha !== form.confirmar_nova_senha) { setErro('As senhas não coincidem.'); return; }
      if (form.nova_senha.length < 6) { setErro('A nova senha deve ter no mínimo 6 caracteres.'); return; }
    }
    setSalvando(true);
    try {
      const payload = { nome_completo: form.nome_completo, email: form.email };
      if (alterandoSenha && form.nova_senha) { payload.senha_atual = form.senha_atual; payload.nova_senha = form.nova_senha; }
      const token = localStorage.getItem('token');
      const r = await fetch('/api/usuarios/perfil', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
      const res = await r.json();
      if (r.ok) {
        localStorage.setItem('token', res.token);
        if (onPerfilAtualizado) onPerfilAtualizado(res.user);
        onClose();
      } else { setErro(res.error || 'Erro ao atualizar perfil.'); }
    } catch (err) { setErro('Erro de conexão.'); } finally { setSalvando(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-header"><h2>Editar Perfil</h2><button className="btn-icon" onClick={onClose}>✕</button></div>
      <div className="modal-body">
        {erro && <div className="card" style={{ background: '#FEF2F2', color: '#EF4444', marginBottom: 16 }}>{erro}</div>}
        <div style={{ marginBottom: 18 }}><label className="label">Nome Completo *</label><input className="input-field" value={form.nome_completo} onChange={e => setForm({ ...form, nome_completo: e.target.value })} /></div>
        <div style={{ marginBottom: 22 }}><label className="label">E-mail *</label><input className="input-field" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div style={{ marginBottom: 16 }}><label><input type="checkbox" checked={alterandoSenha} onChange={e => { setAlterandoSenha(e.target.checked); if (!e.target.checked) setForm({ ...form, senha_atual: '', nova_senha: '', confirmar_nova_senha: '' }); }} /> Alterar senha</label></div>
        {alterandoSenha && (
          <>
            <div style={{ marginBottom: 14 }}><label className="label">Senha Atual</label><input className="input-field" type="password" value={form.senha_atual} onChange={e => setForm({ ...form, senha_atual: e.target.value })} /></div>
            <div style={{ marginBottom: 14 }}><label className="label">Nova Senha</label><input className="input-field" type="password" value={form.nova_senha} onChange={e => setForm({ ...form, nova_senha: e.target.value })} /></div>
            <div style={{ marginBottom: 14 }}><label className="label">Confirmar Nova Senha</label><input className="input-field" type="password" value={form.confirmar_nova_senha} onChange={e => setForm({ ...form, confirmar_nova_senha: e.target.value })} /></div>
          </>
        )}
        <div className="button-group" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={salvando} onClick={submit}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── App Principal ────────────────────────────────────────────────────────────
const decodeJwt = (tk) => { try { const payload = JSON.parse(atob(tk.split('.')[1])); if (payload.exp && payload.exp * 1000 < Date.now()) return null; return { id: payload.id, nome: payload.nome, email: payload.email || '', nivel_acesso: payload.nivel_acesso }; } catch { return null; } };
const PAGE_DEFAULTS = { SOLICITANTE: 'dashboard', TECNICO: 'dashboard', MASTER_ADMIN: 'dashboard' };

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => { const tk = localStorage.getItem('token'); return tk ? decodeJwt(tk) : null; });
  const [pagina, setPagina] = useState(() => { const tk = localStorage.getItem('token'); if (!tk) return null; const u = decodeJwt(tk); return u ? (PAGE_DEFAULTS[u.nivel_acesso] || 'meus-chamados') : null; });
  const [meusChamados, setMeusChamados] = useState([]);
  const [disponiveis, setDisponiveis] = useState([]);
  const [todos, setTodos] = useState([]);
  const [showPerfilModal, setShowPerfilModal] = useState(false);

  const api = useCallback(async (endpoint, opts = {}) => {
    const r = await fetch(`/api${endpoint}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...opts.headers } });
    if (r.status === 401) { localStorage.removeItem('token'); setToken(null); return null; }
    return r.json();
  }, [token]);

  const carregar = useCallback(async () => {
    const [m, d] = await Promise.all([api('/chamados/meus'), api('/chamados/disponiveis')]);
    if (m) setMeusChamados(m);
    if (d) setDisponiveis(d);
    if (user?.nivel_acesso === 'MASTER_ADMIN') { const t = await api('/chamados/todos'); if (t) setTodos(t); }
  }, [api, user?.nivel_acesso]);

  useEffect(() => { if (token && user) carregar(); }, [token, user, carregar]);

  const handleLogin = (tk, u) => { setToken(tk); setUser(u); setPagina(PAGE_DEFAULTS[u.nivel_acesso] || 'meus-chamados'); };
  const sair = () => { localStorage.removeItem('token'); setToken(null); setUser(null); setPagina(null); };

  if (!token || !user) return <><style>{G}</style><LoginScreen onLogin={handleLogin} /></>;

  const nivel = user.nivel_acesso;
  const handlePerfilAtualizado = (novoUsuario) => { setUser(novoUsuario); carregar(); };

  const renderPagina = () => {
    switch (pagina) {
      case 'novo-chamado': return <NovoChamadoView user={user} api={api} onSucesso={() => { carregar(); setPagina(nivel === 'TECNICO' ? 'bandeja' : 'meus-chamados'); }} />;
      case 'meus-chamados': return <ListaChamados titulo="Meus Chamados" chamados={meusChamados} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;
      case 'bandeja': return <ListaChamados titulo="Bandeja de Chamados" chamados={disponiveis.filter(c => !c.id_responsavel)} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} registrarVisualizacao={true} />;
      case 'meus-atend': return <ListaChamados titulo="Meus Atendimentos" chamados={disponiveis.filter(c => `${c.id_responsavel}` === `${user.id}`)} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;
      case 'todos-chamados': return <ListaChamados titulo="Todos os Chamados" chamados={todos} userId={user.id} nivel={nivel} api={api} onRecarregar={carregar} />;
      case 'logs-visualizacao': return nivel === 'MASTER_ADMIN' ? <LogsVisualizacaoView api={api} /> : null;
      case 'dashboard': return <DashboardView api={api} user={user} />;
      case 'usuarios': return nivel === 'MASTER_ADMIN' ? <UsuariosView api={api} /> : null;
      default: return null;
    }
  };

  return (
    <>
      <style>{G}</style>
      <div className="app-layout">
        <Sidebar user={user} pagina={pagina} setPagina={setPagina} onSair={sair} onAbrirPerfil={() => setShowPerfilModal(true)} />
        <main className="main-content">{renderPagina()}</main>
      </div>
      {showPerfilModal && <PerfilModal user={user} onClose={() => setShowPerfilModal(false)} onPerfilAtualizado={handlePerfilAtualizado} />}
    </>
  );
}