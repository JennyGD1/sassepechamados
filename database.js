import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Configurar pool com timezone de Fortaleza
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Forçar timezone para Fortaleza apenas neste projeto
  options: '-c timezone=America/Fortaleza'
});

export const db = {
  query: (text, params) => pool.query(text, params),

  // Usuários
  createUser: (nome, email, senhaHash) => pool.query(
    'INSERT INTO chamado_sassepe_usuarios (nome_completo, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome_completo, email',
    [nome, email, senhaHash]
  ),
  findUserByEmail: (email) => pool.query(
    'SELECT * FROM chamado_sassepe_usuarios WHERE email = $1 AND ativo = true',
    [email]
  ),
  getCargoByUserId: (userId) => pool.query(
    `SELECT c.nivel_acesso FROM chamado_sassepe_cargos c
     JOIN chamado_sassepe_usuarios u ON u.id_cargo = c.id
     WHERE u.id = $1`,
    [userId]
  ),

  // Chamados
  createChamado: (numero, solicitanteId, descricao, criticidade, complexidade, prazoLimite) => pool.query(
    `INSERT INTO chamado_sassepe_chamados
     (numero_chamado, id_solicitante, descricao, criticidade, complexidade, status, prazo_limite, data_abertura)
     VALUES ($1, $2, $3, $4, $5, 'ABERTO', $6, NOW())
     RETURNING *`,
    [numero, solicitanteId, descricao, criticidade, complexidade, prazoLimite]
  ),
  getChamadosBySolicitante: (solicitanteId) => pool.query(
    `SELECT c.*,
            u1.nome_completo AS solicitante_nome,
            u2.nome_completo AS responsavel_nome
     FROM chamado_sassepe_chamados c
     LEFT JOIN chamado_sassepe_usuarios u1 ON c.id_solicitante = u1.id
     LEFT JOIN chamado_sassepe_usuarios u2 ON c.id_responsavel = u2.id
     WHERE c.id_solicitante = $1
     ORDER BY c.data_abertura DESC`,
    [solicitanteId]
  ),
  getAllChamadosAbertos: () => pool.query(
  `SELECT c.*,
          u1.nome_completo AS solicitante_nome,
          u2.nome_completo AS responsavel_nome,
          u3.nome_completo AS responsavel_inicial_nome,
          u4.nome_completo AS responsavel_anterior_nome,
          u5.nome_completo AS responsavel_final_nome
   FROM chamado_sassepe_chamados c
   LEFT JOIN chamado_sassepe_usuarios u1 ON c.id_solicitante = u1.id
   LEFT JOIN chamado_sassepe_usuarios u2 ON c.id_responsavel = u2.id
   LEFT JOIN chamado_sassepe_usuarios u3 ON c.id_responsavel_inicial = u3.id
   LEFT JOIN chamado_sassepe_usuarios u4 ON c.id_responsavel_anterior = u4.id
   LEFT JOIN chamado_sassepe_usuarios u5 ON c.id_responsavel_final = u5.id
   WHERE c.status IN ('ABERTO', 'EM ANALISE', 'AGUARDANDO VALIDACAO')
   ORDER BY c.prazo_limite ASC`
),
  getAllChamados: () => pool.query(
  `SELECT c.*,
          u1.nome_completo AS solicitante_nome,
          u2.nome_completo AS responsavel_nome,
          u3.nome_completo AS responsavel_inicial_nome,  -- Nome do primeiro responsável
          u4.nome_completo AS responsavel_anterior_nome
   FROM chamado_sassepe_chamados c
   LEFT JOIN chamado_sassepe_usuarios u1 ON c.id_solicitante = u1.id
   LEFT JOIN chamado_sassepe_usuarios u2 ON c.id_responsavel = u2.id  -- Responsável atual
   LEFT JOIN chamado_sassepe_usuarios u3 ON c.id_responsavel_inicial = u3.id  -- Primeiro responsável
   LEFT JOIN chamado_sassepe_usuarios u4 ON c.id_responsavel_anterior = u4.id
   ORDER BY c.data_abertura DESC`
),
  getChamadoById: (id) => pool.query(
  `SELECT c.*,
          u1.nome_completo AS solicitante_nome,
          u2.nome_completo AS responsavel_nome,
          u3.nome_completo AS responsavel_inicial_nome,
          u4.nome_completo AS responsavel_anterior_nome,
          u5.nome_completo AS responsavel_final_nome   -- Adicionar este
   FROM chamado_sassepe_chamados c
   LEFT JOIN chamado_sassepe_usuarios u1 ON c.id_solicitante = u1.id
   LEFT JOIN chamado_sassepe_usuarios u2 ON c.id_responsavel = u2.id
   LEFT JOIN chamado_sassepe_usuarios u3 ON c.id_responsavel_inicial = u3.id
   LEFT JOIN chamado_sassepe_usuarios u4 ON c.id_responsavel_anterior = u4.id
   LEFT JOIN chamado_sassepe_usuarios u5 ON c.id_responsavel_final = u5.id   -- Adicionar este
   WHERE c.id = $1`,
  [id]
),
  updateStatus: (id, status) => pool.query(
    'UPDATE chamado_sassepe_chamados SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  ),
 closeChamado: async (id, dataFechamento) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Atualiza status e data de fechamento
    const result = await client.query(
      `UPDATE chamado_sassepe_chamados
       SET status = 'AGUARDANDO VALIDACAO', 
           data_fechamento = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    // PAUSA O SLA - registra quando a pausa começou
    await client.query(
      `UPDATE chamado_sassepe_chamados
       SET pausa_iniciada_em = NOW()
       WHERE id = $1 AND pausa_iniciada_em IS NULL`,
      [id]
    );
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
},
validarChamado: async (id, aprovado) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const chamado = await client.query(
      'SELECT id, numero_chamado, status, pausa_iniciada_em, tempo_pausado_segundos, prazo_limite FROM chamado_sassepe_chamados WHERE id = $1',
      [id]
    );
    
    if (chamado.rows.length === 0) {
      throw new Error('Chamado não encontrado');
    }
    
    const c = chamado.rows[0];
    
    let result;
    
    if (aprovado) {
      result = await client.query(
        `UPDATE chamado_sassepe_chamados 
         SET status = 'CONCLUIDO'
         WHERE id = $1 RETURNING *`,
        [id]
      );
    } else {
      
      let tempoPausadoTotal = c.tempo_pausado_segundos || 0;
      let segundosPausadosNestaValidacao = 0;
      
      if (c.pausa_iniciada_em) {
        const pausaIniciada = new Date(c.pausa_iniciada_em);
        const agora = new Date();
        segundosPausadosNestaValidacao = Math.floor((agora - pausaIniciada) / 1000);
        tempoPausadoTotal += segundosPausadosNestaValidacao;
        
      } else {
      }
      
      // SOMA o tempo pausado ao prazo limite (estende o SLA)
      const prazoOriginal = new Date(c.prazo_limite);
      const novoPrazo = new Date(prazoOriginal.getTime() + (segundosPausadosNestaValidacao * 1000));
      
      // Volta para EM ANALISE, atualiza prazo e limpa pausa
      result = await client.query(
        `UPDATE chamado_sassepe_chamados 
         SET status = 'EM ANALISE',
             tempo_pausado_segundos = $2,
             prazo_limite = $3,
             pausa_iniciada_em = NULL
         WHERE id = $1 RETURNING *`,
        [id, tempoPausadoTotal, novoPrazo]
      );
      
    } 
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
},

// Modificar assignResponsavel (assumir chamado)
assignResponsavel: async (id, responsavelId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Verifica se é o primeiro responsável
    const chamado = await client.query(
      'SELECT id_responsavel_inicial FROM chamado_sassepe_chamados WHERE id = $1',
      [id]
    );
    
    const isFirstResponsible = !chamado.rows[0]?.id_responsavel_inicial;
    
    const result = await client.query(
      `UPDATE chamado_sassepe_chamados
       SET id_responsavel = $1, 
           status = 'EM ANALISE',
           id_responsavel_inicial = COALESCE(id_responsavel_inicial, $1)
       WHERE id = $2 RETURNING *`,
      [responsavelId, id]
    );
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
},
  finalizeChamado: (id) => pool.query(
    `UPDATE chamado_sassepe_chamados SET status = 'CONCLUIDO' WHERE id = $1 RETURNING *`,
    [id]
  ),
  getSLARestante: async (chamadoId) => {
  const chamado = await pool.query(
    `SELECT id, numero_chamado, status, prazo_limite, 
            tempo_pausado_segundos, pausa_iniciada_em
     FROM chamado_sassepe_chamados 
     WHERE id = $1`,
    [chamadoId]
  );
  
  if (chamado.rows.length === 0) return null;
  
  const c = chamado.rows[0];
  const agora = new Date();
  let prazoFinal = new Date(c.prazo_limite);
  let estaPausado = false;
  
  if (c.status === 'AGUARDANDO VALIDACAO' && c.pausa_iniciada_em) {
    estaPausado = true;
  } else if (c.tempo_pausado_segundos > 0) {
    prazoFinal = new Date(prazoFinal.getTime());
  }
  
  const estaVencido = !estaPausado && agora > prazoFinal;
  const tempoRestanteMs = prazoFinal - agora;
  const tempoRestanteHoras = tempoRestanteMs / (1000 * 60 * 60);
  
  return {
    prazoFinal,
    estaVencido,
    estaPausado,
    tempoRestanteHoras: Math.max(0, tempoRestanteHoras),
    tempoPausadoTotal: c.tempo_pausado_segundos || 0
  };
},
  // Histórico
  addHistorico: (chamadoId, usuarioId, acao, comentario) => pool.query(
    'INSERT INTO chamado_sassepe_historico (id_chamado, id_usuario, acao, comentario, data_hora) VALUES ($1, $2, $3, $4, NOW())',
    [chamadoId, usuarioId, acao, comentario]
  ),
  getHistorico: (chamadoId) => pool.query(
    `SELECT h.*, u.nome_completo
     FROM chamado_sassepe_historico h
     JOIN chamado_sassepe_usuarios u ON h.id_usuario = u.id
     WHERE h.id_chamado = $1
     ORDER BY h.data_hora ASC`,
    [chamadoId]
  ),

  // =====================================================
  // FUNÇÕES COMPLETAS PARA ENCAMINHAMENTO
  // =====================================================

  // Buscar chamado completo
  getChamadoCompleto: async (id) => {
    const query = `
      SELECT c.*,
            u1.nome_completo AS solicitante_nome,
            u2.nome_completo AS responsavel_nome,
            u3.nome_completo AS responsavel_inicial_nome,
            u4.nome_completo AS responsavel_anterior_nome
      FROM chamado_sassepe_chamados c
      LEFT JOIN chamado_sassepe_usuarios u1 ON c.id_solicitante = u1.id
      LEFT JOIN chamado_sassepe_usuarios u2 ON c.id_responsavel = u2.id
      LEFT JOIN chamado_sassepe_usuarios u3 ON c.id_responsavel_inicial = u3.id
      LEFT JOIN chamado_sassepe_usuarios u4 ON c.id_responsavel_anterior = u4.id
      WHERE c.id = $1
    `;
    return pool.query(query, [id]);
  },

  // Buscar técnicos disponíveis
  getTecnicosDisponiveis: async (usuarioId) => {
    const query = `
      SELECT u.id, u.nome_completo, u.email
      FROM chamado_sassepe_usuarios u
      JOIN chamado_sassepe_cargos cargos ON u.id_cargo = cargos.id
      WHERE cargos.nivel_acesso IN ('TECNICO', 'MASTER_ADMIN')
        AND u.ativo = true
        AND u.id != $1
      ORDER BY u.nome_completo
    `;
    return pool.query(query, [usuarioId]);
  },

  // Buscar usuário por ID
  getUsuarioById: async (id) => {
    const query = `
      SELECT u.id, u.nome_completo, u.email, u.ativo, c.nivel_acesso
      FROM chamado_sassepe_usuarios u
      LEFT JOIN chamado_sassepe_cargos c ON u.id_cargo = c.id
      WHERE u.id = $1
    `;
    return pool.query(query, [id]);
  },

  // Adicionar ao histórico técnico (encaminhamentos/comentários privados) - 
  addHistoricoTecnico: async (chamadoId, usuarioId, acao, comentario, tipoComentario = 'PUBLICO', deUsuarioId = null, paraUsuarioId = null, statusAnterior = null, statusNovo = null) => {
    const query = `
      INSERT INTO chamado_sassepe_historico_tecnico 
      (id_chamado, id_usuario, acao, comentario, tipo_comentario, de_usuario_id, para_usuario_id, status_anterior, status_novo, data_hora)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `;
    return pool.query(query, [chamadoId, usuarioId, acao, comentario, tipoComentario, deUsuarioId, paraUsuarioId, statusAnterior, statusNovo]);
  },

  // Adicionar ao histórico geral (visível para todos)
  addHistoricoGeral: async (chamadoId, usuarioId, acao, comentario) => {
    const query = `
      INSERT INTO chamado_sassepe_historico 
      (id_chamado, id_usuario, acao, comentario, data_hora)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    return pool.query(query, [chamadoId, usuarioId, acao, comentario]);
  },

  // Atualizar responsável do chamado (encaminhamento)
  updateResponsavel: async (chamadoId, novoResponsavelId, responsavelAnteriorId) => {
    const query = `
      UPDATE chamado_sassepe_chamados 
      SET id_responsavel_anterior = $2,
          id_responsavel = $1
      WHERE id = $3
      RETURNING *
    `;
    return pool.query(query, [novoResponsavelId, responsavelAnteriorId, chamadoId]);
  },

  // Buscar movimentações técnicas 
getMovimentacoesTecnicas: async (chamadoId, usuarioId, nivelUsuario) => {
  const chamadoInfo = await pool.query(
    `SELECT id_solicitante, id_responsavel_inicial, id_responsavel_final 
     FROM chamado_sassepe_chamados 
     WHERE id = $1`,
    [chamadoId]
  );
  
  const chamado = chamadoInfo.rows[0] || {};
  const isResponsavelInicial = chamado.id_responsavel_inicial === usuarioId;
  const isResponsavelFinal = chamado.id_responsavel_final === usuarioId;
  const isSolicitante = chamado.id_solicitante === usuarioId;
  const isAdmin = nivelUsuario === 'MASTER_ADMIN';
  
  let query = `
    SELECT 
      h.*,
      u.nome_completo as usuario_nome,
      u2.nome_completo as de_usuario_nome,
      u3.nome_completo as para_usuario_nome,
      to_char(h.data_hora, 'DD/MM/YYYY HH24:MI:SS') as data_hora_formatada
    FROM chamado_sassepe_historico_tecnico h
    LEFT JOIN chamado_sassepe_usuarios u ON h.id_usuario = u.id
    LEFT JOIN chamado_sassepe_usuarios u2 ON h.de_usuario_id = u2.id
    LEFT JOIN chamado_sassepe_usuarios u3 ON h.para_usuario_id = u3.id
    WHERE h.id_chamado = $1
  `;
  
  const params = [chamadoId];
  let conditions = [];
  
  if (isAdmin) {
    conditions = [];
  } 
  else if (isResponsavelInicial || isResponsavelFinal) {
    conditions = [
      `h.tipo_comentario = 'PUBLICO'`,
      `h.para_usuario_id = $2`,
      `h.id_usuario = $2`
    ];
    params.push(usuarioId);
  }
  else if (nivelUsuario === 'TECNICO') {
    conditions = [
      `h.tipo_comentario = 'PUBLICO'`,
      `h.para_usuario_id = $2`,
      `h.id_usuario = $2`
    ];
    params.push(usuarioId);
  }
  // Solicitante vê apenas comentários públicos
  else if (isSolicitante) {
    conditions = [`h.tipo_comentario = 'PUBLICO'`];
  }
  else {
    conditions = [`h.tipo_comentario = 'PUBLICO'`];
  }
  if (conditions.length > 0) {
    query += ` AND (${conditions.join(' OR ')})`;
  }
  query += ` ORDER BY h.data_hora ASC`;

  const { rows } = await pool.query(query, params);
  return { rows };
},
  // Pausar SLA (quando entra em AGUARDANDO VALIDACAO)
pausarSLA: async (chamadoId) => {
  const query = `
    UPDATE chamado_sassepe_chamados 
    SET pausa_iniciada_em = NOW()
    WHERE id = $1 AND pausa_iniciada_em IS NULL
    RETURNING *
  `;
  return pool.query(query, [chamadoId]);
},

// Retomar SLA (quando volta do cliente)
retomarSLA: async (chamadoId) => {
  // Primeiro calcula o tempo que ficou pausado
  const chamado = await pool.query(
    'SELECT pausa_iniciada_em, tempo_pausado_segundos FROM chamado_sassepe_chamados WHERE id = $1',
    [chamadoId]
  );
  
  if (chamado.rows.length === 0 || !chamado.rows[0].pausa_iniciada_em) {
    return { rows: [] };
  }
  
  const pausaIniciada = new Date(chamado.rows[0].pausa_iniciada_em);
  const agora = new Date();
  const segundosPausados = Math.floor((agora - pausaIniciada) / 1000);
  const tempoPausadoTotal = (chamado.rows[0].tempo_pausado_segundos || 0) + segundosPausados;
  
  const query = `
    UPDATE chamado_sassepe_chamados 
    SET tempo_pausado_segundos = $2,
        pausa_iniciada_em = NULL
    WHERE id = $1
    RETURNING *
  `;
  return pool.query(query, [chamadoId, tempoPausadoTotal]);
},

// Calcular SLA restante considerando tempo pausado
calcularSLARestante: async (chamadoId) => {
  const chamado = await pool.query(
    `SELECT data_abertura, prazo_limite, tempo_pausado_segundos, 
            pausa_iniciada_em, status
     FROM chamado_sassepe_chamados 
     WHERE id = $1`,
    [chamadoId]
  );
  
  if (chamado.rows.length === 0) return null;
  
  const c = chamado.rows[0];
  const prazoOriginal = new Date(c.prazo_limite);
  const agora = new Date();
  
  // Se está pausado, usa o tempo da pausa como referência
  let tempoPausado = c.tempo_pausado_segundos || 0;
  if (c.pausa_iniciada_em && c.status === 'AGUARDANDO VALIDACAO') {
    const pausaAtual = Math.floor((agora - new Date(c.pausa_iniciada_em)) / 1000);
    tempoPausado += pausaAtual;
  }
  
  // Adiciona o tempo pausado ao prazo (estende o prazo)
  const prazoEstendido = new Date(prazoOriginal.getTime() + (tempoPausado * 1000));
  
  return {
    prazoOriginal,
    prazoEstendido,
    tempoPausadoSegundos: tempoPausado,
    tempoPausadoHoras: (tempoPausado / 3600).toFixed(1),
    estaPausado: !!c.pausa_iniciada_em,
    estaVencido: agora > prazoEstendido && c.status !== 'CONCLUIDO'
  };
},

// Calcular tempo real de trabalho (sem considerar pausas)
calcularTempoTrabalho: async (chamadoId) => {
  const chamado = await pool.query(
    `SELECT data_abertura, data_fechamento, tempo_pausado_segundos,
            pausa_iniciada_em, status
     FROM chamado_sassepe_chamados 
     WHERE id = $1`,
    [chamadoId]
  );
  
  if (chamado.rows.length === 0) return null;
  
  const c = chamado.rows[0];
  const dataAbertura = new Date(c.data_abertura);
  const dataFechamento = c.data_fechamento ? new Date(c.data_fechamento) : new Date();
  let tempoTrabalhado = (dataFechamento - dataAbertura) / 1000; // em segundos
  
  // Subtrai tempo pausado
  let tempoPausado = c.tempo_pausado_segundos || 0;
  if (c.pausa_iniciada_em && c.status === 'AGUARDANDO VALIDACAO') {
    const pausaAtual = Math.floor((new Date() - new Date(c.pausa_iniciada_em)) / 1000);
    tempoPausado += pausaAtual;
  }
  
  tempoTrabalhado -= tempoPausado;
  
  return {
    segundos: Math.max(0, tempoTrabalhado),
    minutos: Math.max(0, Math.floor(tempoTrabalhado / 60)),
    horas: Math.max(0, (tempoTrabalhado / 3600).toFixed(1))
  };
},

  // Buscar notificações não lidas
  getNotificacoesNaoLidas: async (usuarioId) => {
    const query = `
      SELECT 
        h.*,
        c.numero_chamado,
        u.nome_completo as remetente_nome,
        to_char(h.data_hora, 'DD/MM/YYYY HH24:MI:SS') as data_envio
      FROM chamado_sassepe_historico_tecnico h
      JOIN chamado_sassepe_chamados c ON h.id_chamado = c.id
      LEFT JOIN chamado_sassepe_usuarios u ON h.id_usuario = u.id
      WHERE h.para_usuario_id = $1 
        AND h.lido = false
        AND h.tipo_comentario = 'PRIVADO'
      ORDER BY h.data_hora DESC
      LIMIT 20
    `;
    return pool.query(query, [usuarioId]);
  },

  marcarComoLida: async (historicoId, usuarioId) => {
    const query = `
      UPDATE chamado_sassepe_historico_tecnico 
      SET lido = true
      WHERE id = $1 AND para_usuario_id = $2
      RETURNING *
    `;
    return pool.query(query, [historicoId, usuarioId]);
  },

  // Encaminhar chamado (preservando responsável final)
  updateResponsavelComFinal: async (chamadoId, novoResponsavelId, responsavelAnteriorId, responsavelFinalId) => {
    const query = `
      UPDATE chamado_sassepe_chamados 
      SET id_responsavel_anterior = $2,
          id_responsavel = $1,
          id_responsavel_final = $4
      WHERE id = $3
      RETURNING *
    `;
    return pool.query(query, [novoResponsavelId, responsavelAnteriorId, chamadoId, responsavelFinalId]);
  },

  // Verificar se usuário pode finalizar (enviar para cliente)
  podeFinalizarChamado: async (chamadoId, usuarioId) => {
    const query = `
      SELECT id, id_responsavel, id_responsavel_final
      FROM chamado_sassepe_chamados
      WHERE id = $1 
        AND (id_responsavel_final = $2 OR id_responsavel = $2)
    `;
    return pool.query(query, [chamadoId, usuarioId]);
  },

  // Devolver chamado do técnico atual para o responsável final
  devolverParaResponsavelFinal: async (chamadoId, responsavelAtualId, comentario) => {
    const chamado = await pool.query(
      'SELECT id_responsavel_final, id_responsavel FROM chamado_sassepe_chamados WHERE id = $1',
      [chamadoId]
    );
    
    if (!chamado.rows.length) throw new Error('Chamado não encontrado');
    
    const responsavelFinal = chamado.rows[0].id_responsavel_final;
    
    if (!responsavelFinal) throw new Error('Nenhum responsável final definido');
    
    const query = `
      UPDATE chamado_sassepe_chamados 
      SET id_responsavel_anterior = $2,
          id_responsavel = $1,
          status = 'EM ANALISE'
      WHERE id = $3
      RETURNING *
    `;
    return pool.query(query, [responsavelFinal, responsavelAtualId, chamadoId]);
  },
  // ── Gestão de Usuários (MASTER_ADMIN) ────────────────────────────────────────
  getAllUsuarios: () => pool.query(
    `SELECT u.id, u.nome_completo, u.email, u.ativo,
            c.nivel_acesso,
            c.nome AS cargo_nome
     FROM chamado_sassepe_usuarios u
     LEFT JOIN chamado_sassepe_cargos c ON u.id_cargo = c.id
     ORDER BY u.nome_completo ASC`
  ),

  // Cria usuário: busca o id do cargo pelo nivel_acesso e insere
  createUsuario: (nome_completo, email, senha_hash, nivel_acesso, cargo_nome, ativo) => pool.query(
    `INSERT INTO chamado_sassepe_usuarios (nome_completo, email, senha_hash, id_cargo, ativo)
     VALUES (
       $1, $2, $3,
       (SELECT id FROM chamado_sassepe_cargos WHERE nivel_acesso = $4 LIMIT 1),
       $5
     )
     RETURNING id, nome_completo, email, ativo`,
    [nome_completo, email, senha_hash, nivel_acesso, ativo]
  ),

  // Atualiza usuário sem trocar a senha
  updateUsuario: (id, nome_completo, email, nivel_acesso, ativo) => pool.query(
    `UPDATE chamado_sassepe_usuarios
     SET nome_completo = $2,
         email         = $3,
         id_cargo      = (SELECT id FROM chamado_sassepe_cargos WHERE nivel_acesso = $4 LIMIT 1),
         ativo         = $5
     WHERE id = $1
     RETURNING id, nome_completo, email, ativo`,
    [id, nome_completo, email, nivel_acesso, ativo]
  ),

  // Atualiza usuário trocando também a senha
  updateUsuarioComSenha: (id, nome_completo, email, senha_hash, nivel_acesso, ativo) => pool.query(
    `UPDATE chamado_sassepe_usuarios
     SET nome_completo = $2,
         email         = $3,
         senha_hash    = $4,
         id_cargo      = (SELECT id FROM chamado_sassepe_cargos WHERE nivel_acesso = $5 LIMIT 1),
         ativo         = $6
     WHERE id = $1
     RETURNING id, nome_completo, email, ativo`,
    [id, nome_completo, email, senha_hash, nivel_acesso, ativo]
  ),

  deleteUsuario: (id) => pool.query(
    'DELETE FROM chamado_sassepe_usuarios WHERE id = $1',
    [id]
  ),
  
  // ── Logs de Visualização de Bandeja ───────────────────────────────────────────
registrarVisualizacaoBandeja: (usuarioId, totalChamadosVisiveis) => pool.query(
  `INSERT INTO chamado_sassepe_logs_visualizacao_bandeja (id_usuario, total_chamados_visiveis, data_visualizacao)
   VALUES ($1, $2, NOW())
   RETURNING *`,
  [usuarioId, totalChamadosVisiveis]
),

// ── Logs de Visualização de Meus Atendimentos ─────────────────────────────────
registrarVisualizacaoMeusAtendimentos: (usuarioId, totalChamadosVisiveis, aba = 'meus_atendimentos') => pool.query(
  `INSERT INTO chamado_sassepe_logs_visualizacao_bandeja (id_usuario, total_chamados_visiveis, data_visualizacao)
   VALUES ($1, $2, NOW())
   RETURNING *`,
  [usuarioId, totalChamadosVisiveis]
),

  getUltimasVisualizacoesBandeja: (usuarioId, limit = 10) => pool.query(
    `SELECT * FROM chamado_sassepe_logs_visualizacao_bandeja
     WHERE id_usuario = $1
     ORDER BY data_visualizacao DESC
     LIMIT $2`,
    [usuarioId, limit]
  ),

  // ── Edição de Perfil do Usuário ──────────────────────────────────────────────
  updateUsuarioPerfil: (id, nome_completo, email) => pool.query(
    `UPDATE chamado_sassepe_usuarios
     SET nome_completo = $2,
         email = $3
     WHERE id = $1
     RETURNING id, nome_completo, email, ativo`,
    [id, nome_completo, email]
  ),

  updateUsuarioPerfilComSenha: (id, nome_completo, email, senha_hash) => pool.query(
    `UPDATE chamado_sassepe_usuarios
     SET nome_completo = $2,
         email = $3,
         senha_hash = $4
     WHERE id = $1
     RETURNING id, nome_completo, email, ativo`,
    [id, nome_completo, email, senha_hash]
  ),

  // Verificar se email já existe (exceto o próprio usuário)
  emailExistsExcludingUser: (email, userId) => pool.query(
    `SELECT id FROM chamado_sassepe_usuarios 
     WHERE email = $1 AND id != $2`,
    [email, userId]
  ),
  
  // ── Logs de Visualização (Admin) ─────────────────────────────────────────────
  getAllLogsVisualizacao: (limit = 100, offset = 0) => pool.query(
    `SELECT l.*, u.nome_completo, u.email, c.nivel_acesso
     FROM chamado_sassepe_logs_visualizacao_bandeja l
     JOIN chamado_sassepe_usuarios u ON l.id_usuario = u.id
     LEFT JOIN chamado_sassepe_cargos c ON u.id_cargo = c.id
     ORDER BY l.data_visualizacao DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  ),

  getTotalLogsVisualizacao: () => pool.query(
    `SELECT COUNT(*) as total FROM chamado_sassepe_logs_visualizacao_bandeja`,
    []
  ),

  deleteLogVisualizacao: (id) => pool.query(
    'DELETE FROM chamado_sassepe_logs_visualizacao_bandeja WHERE id = $1',
    [id]
  ),

  deleteAllLogsVisualizacao: () => pool.query(
    'DELETE FROM chamado_sassepe_logs_visualizacao_bandeja',
    []
  ),

  deleteLogsByUser: (usuarioId) => pool.query(
    'DELETE FROM chamado_sassepe_logs_visualizacao_bandeja WHERE id_usuario = $1',
    [usuarioId]
  ),

  getLogsByDateRange: (startDate, endDate) => pool.query(
    `SELECT l.*, u.nome_completo, u.email, c.nivel_acesso
     FROM chamado_sassepe_logs_visualizacao_bandeja l
     JOIN chamado_sassepe_usuarios u ON l.id_usuario = u.id
     LEFT JOIN chamado_sassepe_cargos c ON u.id_cargo = c.id
     WHERE l.data_visualizacao::date >= $1::date AND l.data_visualizacao::date <= $2::date
     ORDER BY l.data_visualizacao DESC`,
    [startDate, endDate]
  ),
};