import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './database.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// ── Middleware de autenticação ────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userNome = decoded.nome;
    req.userNivel = decoded.nivel_acesso;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const gerarNumero = () => {
  const d = new Date();
  return `CH-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

const PRAZO_HORAS = {
  Alta:  { Alta: 16, Média: 8,  Baixa: 4  },
  Média: { Alta: 48, Média: 24, Baixa: 12 },
  Baixa: { Alta: 72, Média: 48, Baixa: 24 }
};

const calcularPrazo = (crit, comp) => new Date(Date.now() + PRAZO_HORAS[crit][comp] * 3_600_000);

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { identifier, senha } = req.body;
    const { rows } = await db.findUserByEmail(identifier);
    if (!rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = rows[0];
    if (!await bcrypt.compare(senha, user.senha_hash)) return res.status(401).json({ error: 'Credenciais inválidas' });

    // Buscar cargo/nível do usuário
    const cargoResult = await db.getCargoByUserId(user.id);
    const nivel_acesso = cargoResult.rows[0]?.nivel_acesso || 'SOLICITANTE';

    const token = jwt.sign(
      { id: user.id, nome: user.nome_completo, nivel_acesso },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      user: { id: user.id, nome: user.nome_completo, email: user.email, nivel_acesso }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Chamados ──────────────────────────────────────────────────────────────────
app.post('/api/chamados', auth, async (req, res) => {
  try {
    const { descricao, criticidade, complexidade } = req.body;
    const numero = gerarNumero();
    const prazo = calcularPrazo(criticidade, complexidade);
    const { rows } = await db.createChamado(numero, req.userId, descricao, criticidade, complexidade, prazo);
    await db.addHistorico(rows[0].id, req.userId, 'ABERTURA', `Chamado aberto — Criticidade: ${criticidade} | Complexidade: ${complexidade}`);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chamados/meus', auth, async (req, res) => {
  const { rows } = await db.getChamadosBySolicitante(req.userId);
  res.json(rows);
});

app.get('/api/chamados/disponiveis', auth, async (req, res) => {
  const { rows } = await db.getAllChamadosAbertos();
  res.json(rows);
});

app.get('/api/chamados/todos', auth, async (req, res) => {
  if (req.userNivel !== 'MASTER_ADMIN' && req.userNivel !== 'SOLICITANTE2' && req.userNivel !== 'TECNICO') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  const { rows } = await db.getAllChamados();
  res.json(rows);
});

// Dashboard acessível a todos os usuários autenticados
app.get('/api/chamados/dashboard', auth, async (req, res) => {
  try {
    const { mes, ano } = req.query;
    let query;
    let params = [];

    if (mes && ano) {
      query = `
        SELECT c.*,
               u1.nome_completo AS solicitante_nome,
               u2.nome_completo AS responsavel_nome
         FROM chamado_sassepe_chamados c
         LEFT JOIN chamado_sassepe_usuarios u1 ON c.id_solicitante = u1.id
         LEFT JOIN chamado_sassepe_usuarios u2 ON c.id_responsavel = u2.id
         WHERE EXTRACT(MONTH FROM c.data_abertura) = $1
           AND EXTRACT(YEAR  FROM c.data_abertura) = $2
         ORDER BY c.data_abertura DESC`;
      params = [parseInt(mes), parseInt(ano)];
    } else {
      query = `
        SELECT c.*,
               u1.nome_completo AS solicitante_nome,
               u2.nome_completo AS responsavel_nome
         FROM chamado_sassepe_chamados c
         LEFT JOIN chamado_sassepe_usuarios u1 ON c.id_solicitante = u1.id
         LEFT JOIN chamado_sassepe_usuarios u2 ON c.id_responsavel = u2.id
         ORDER BY c.data_abertura DESC`;
    }

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/chamados/:id/assumir', auth, async (req, res) => {
  if (req.userNivel === 'ANALISTA') {
    return res.status(403).json({ error: 'Analistas não podem assumir chamados' });
  }
  try {
    const chamadoResult = await db.getChamadoById(req.params.id);
    const chamado = chamadoResult.rows[0];

    if (chamado.id_responsavel === req.userId) {
      return res.json(chamado);
    }

    const { rows } = await db.assignResponsavel(req.params.id, req.userId);

    if (!chamado.id_responsavel_inicial) {
      await db.query(
        `UPDATE chamado_sassepe_chamados 
         SET id_responsavel_inicial = $1, id_responsavel_final = $1 
         WHERE id = $2`,
        [req.userId, req.params.id]
      );
    }

    await db.addHistorico(req.params.id, req.userId, 'ATRIBUICAO', `Chamado assumido por ${req.userNome}`);

    const updatedChamado = await db.getChamadoById(req.params.id);
    res.json(updatedChamado.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/chamados/:id/fechar', auth, async (req, res) => {
  if (req.userNivel === 'ANALISTA') {
    return res.status(403).json({ error: 'Analistas não podem resolver chamados' });
  }
  try {
    const { descricaoResolucao } = req.body;
    const { rows } = await db.closeChamado(req.params.id, new Date());
    await db.addHistorico(req.params.id, req.userId, 'RESOLUCAO', descricaoResolucao);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/chamados/:id/validar', auth, async (req, res) => {
  try {
    const { aprovado } = req.body;
    if (aprovado) {
      await db.finalizeChamado(req.params.id);
    } else {
      await db.updateStatus(req.params.id, 'EM ANALISE');
    }
    await db.addHistorico(
      req.params.id, req.userId,
      aprovado ? 'APROVACAO' : 'RECUSA',
      aprovado ? 'Solicitante aprovou a resolução — chamado encerrado' : 'Solicitante recusou a resolução — chamado reaberto'
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chamados/:id/historico', auth, async (req, res) => {
  const { rows } = await db.getHistorico(req.params.id);
  res.json(rows);
});
// ── Editar comentário no histórico geral (apenas MASTER_ADMIN) ────────────────
app.put('/api/chamados/:id/validar', auth, async (req, res) => {
  try {
    const { aprovado } = req.body;
    const chamadoId = req.params.id;
    
    // Buscar o chamado atual para ter as informações
    const chamadoResult = await db.getChamadoById(chamadoId);
    if (!chamadoResult.rows.length) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }
    
    const chamado = chamadoResult.rows[0];
    
    // Usar a função validarChamado do database.js (que já tem a lógica de SLA)
    const result = await db.validarChamado(chamadoId, aprovado);
    
    // Adicionar ao histórico
    if (aprovado) {
      await db.addHistorico(
        chamadoId, req.userId, 'APROVACAO',
        'Solicitante aprovou a resolução — chamado encerrado'
      );
    } else {
      // Calcular o tempo que ficou pausado para mostrar no histórico
      let tempoPausado = 0;
      if (chamado.pausa_iniciada_em) {
        const pausaIniciada = new Date(chamado.pausa_iniciada_em);
        const agora = new Date();
        tempoPausado = Math.floor((agora - pausaIniciada) / 60); // minutos
      }
      
      await db.addHistorico(
        chamadoId, req.userId, 'RECUSA',
        `Solicitante recusou a resolução — chamado reaberto${tempoPausado > 0 ? ` com SLA estendido em ${tempoPausado} minutos` : ''}`
      );
    }
    
    // Buscar o chamado atualizado para retornar
    const chamadoAtualizado = await db.getChamadoById(chamadoId);
    res.json(chamadoAtualizado.rows[0]);
    
  } catch (e) { 
    console.error('Erro ao validar chamado:', e);
    res.status(500).json({ error: e.message }); 
  }
});

// Editar comentário no histórico técnico (apenas MASTER_ADMIN)
app.put('/api/admin/historico-tecnico/:id', auth, async (req, res) => {
  if (req.userNivel !== 'MASTER_ADMIN') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  try {
    const { comentario } = req.body;
    const historicoId = req.params.id;
    
    if (!comentario || comentario.trim() === '') {
      return res.status(400).json({ error: 'Comentário não pode estar vazio' });
    }
    
    const query = `
      UPDATE chamado_sassepe_historico_tecnico 
      SET comentario = $1
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await db.query(query, [comentario.trim(), historicoId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Histórico técnico não encontrado' });
    }
    
    res.json({ 
      success: true, 
      message: 'Comentário atualizado com sucesso',
      historico: result.rows[0]
    });
    
  } catch (e) {
    console.error('Erro ao editar histórico técnico:', e);
    res.status(500).json({ error: e.message });
  }
});

// =====================================================
// ROTAS DE ENCAMINHAMENTO E DEVOLUÇÃO
// =====================================================

// 1. Buscar técnicos disponíveis
app.get('/api/tecnicos/disponiveis', auth, async (req, res) => {
  try {
    const { rows } = await db.getTecnicosDisponiveis(req.userId);
    res.json(rows || []);
  } catch (e) { 
    console.error('Erro ao buscar técnicos:', e);
    res.status(500).json({ error: e.message }); 
  }
});

app.put('/api/chamados/:id/encaminhar', auth, async (req, res) => {
  try {
    const { paraUsuarioId, comentarioPublico, comentarioPrivado } = req.body;
    const chamadoId = req.params.id;
    
    const chamadoResult = await db.getChamadoById(chamadoId);
    if (!chamadoResult.rows.length) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }
    
    const chamado = chamadoResult.rows[0];

    if (chamado.id_responsavel !== req.userId && req.userNivel !== 'MASTER_ADMIN') {
      return res.status(403).json({ error: 'Apenas o responsável atual pode encaminhar' });
    }

    if (chamado.status !== 'EM ANALISE') {
      return res.status(400).json({ error: 'Chamado não está em análise' });
    }

    const destinoResult = await db.getUsuarioById(paraUsuarioId);
    if (!destinoResult.rows.length || !['TECNICO', 'MASTER_ADMIN'].includes(destinoResult.rows[0].nivel_acesso)) {
      return res.status(400).json({ error: 'Destino deve ser um técnico' });
    }

    if (!chamado.id_responsavel_inicial) {
      await db.query(
        'UPDATE chamado_sassepe_chamados SET id_responsavel_inicial = $1, id_responsavel_final = $1 WHERE id = $2',
        [chamado.id_responsavel, chamadoId]
      );
    }

    await db.query(
      'UPDATE chamado_sassepe_chamados SET id_responsavel_anterior = $1 WHERE id = $2',
      [chamado.id_responsavel, chamadoId]
    );

    const statusAnterior = chamado.status;

    await db.query(
      `UPDATE chamado_sassepe_chamados 
       SET id_responsavel = $1 
       WHERE id = $2`,
      [paraUsuarioId, chamadoId]
    );

    if (comentarioPublico && comentarioPublico.trim()) {
      await db.addHistoricoTecnico(
        chamadoId, req.userId, 'ENCAMINHAMENTO',
        comentarioPublico, 'PUBLICO', req.userId, paraUsuarioId,
        statusAnterior, 'EM ANALISE'
      );
    }

    if (comentarioPrivado && comentarioPrivado.trim()) {
      await db.addHistoricoTecnico(
        chamadoId, req.userId, 'COMENTARIO_PRIVADO',
        comentarioPrivado, 'PRIVADO', req.userId, paraUsuarioId,
        statusAnterior, 'EM ANALISE'
      );
    }

    await db.addHistoricoGeral(
      chamadoId, req.userId, 'ATRIBUICAO',
      `Chamado encaminhado de ${req.userNome} para ${destinoResult.rows[0].nome_completo}`
    );
    
    res.json({ success: true, message: 'Chamado encaminhado com sucesso' });
    
  } catch (e) { 
    console.error('Erro no encaminhamento:', e);
    res.status(500).json({ error: e.message }); 
  }
});

app.put('/api/chamados/:id/devolver', auth, async (req, res) => {
  try {
    const { comentarioResolucao } = req.body;
    const chamadoId = req.params.id;

    const chamadoResult = await db.getChamadoById(chamadoId);
    if (!chamadoResult.rows.length) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }
    
    const chamado = chamadoResult.rows[0];

    if (chamado.id_responsavel !== req.userId) {
      return res.status(403).json({ error: 'Apenas o responsável atual pode devolver o chamado' });
    }

    if (!chamado.id_responsavel_final) {
      return res.status(400).json({ error: 'Nenhum responsável final definido para este chamado' });
    }
    
    const statusAnterior = chamado.status;
    
    await db.query(
      `UPDATE chamado_sassepe_chamados 
       SET id_responsavel_anterior = $1,
           id_responsavel = $2
       WHERE id = $3`,
      [chamado.id_responsavel, chamado.id_responsavel_final, chamadoId]
    );

    if (comentarioResolucao) {
      await db.addHistoricoTecnico(
        chamadoId, req.userId, 'DEVOLUCAO',
        comentarioResolucao, 'PUBLICO', req.userId, chamado.id_responsavel_final,
        statusAnterior, 'EM ANALISE'
      );
    }
    
    await db.addHistoricoGeral(
      chamadoId, req.userId, 'DEVOLUCAO',
      `Técnico ${req.userNome} devolveu o chamado para ${chamado.responsavel_final_nome || 'responsável final'} com a solução: ${comentarioResolucao || 'Solução aplicada'}`
    );
    
    res.json({ success: true, message: 'Chamado devolvido para o responsável final' });
    
  } catch (e) {
    console.error('Erro ao devolver:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chamados/meus-atendimentos', auth, async (req, res) => {
  try {
    const query = `
      SELECT c.*,
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
      WHERE c.id_responsavel = $1          -- Sou responsável atual
         OR c.id_responsavel_inicial = $1  -- Ou fui o primeiro responsável
      ORDER BY c.data_abertura DESC
    `;
    const { rows } = await db.query(query, [req.userId]);
    res.json(rows);
  } catch (e) {
    console.error('Erro ao buscar meus atendimentos:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chamados/:id/movimentacoes-tecnicas', auth, async (req, res) => {
  try {
    const chamadoResult = await db.getChamadoById(req.params.id);
    if (!chamadoResult.rows.length) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }
    
    const chamado = chamadoResult.rows[0];
    const isSolicitanteDoChamado = chamado.id_solicitante === req.userId;

    const isTecnicoOuAdmin = req.userNivel === 'TECNICO' || req.userNivel === 'MASTER_ADMIN';

    if (isSolicitanteDoChamado && !isTecnicoOuAdmin) {
      const query = `
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
          AND h.tipo_comentario = 'PUBLICO'
        ORDER BY h.data_hora ASC
      `;
      const { rows } = await db.query(query, [req.params.id]);
      return res.json(rows);
    }
    

    const query = `
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
        AND (
          h.tipo_comentario = 'PUBLICO'
          OR h.para_usuario_id = $2
          OR h.id_usuario = $2
          OR $3 = 'MASTER_ADMIN'
        )
      ORDER BY h.data_hora ASC
    `;
    const { rows } = await db.query(query, [req.params.id, req.userId, req.userNivel]);
    res.json(rows);
  } catch (e) {
    console.error('Erro ao buscar movimentações:', e);
    res.status(500).json({ error: e.message });
  }
});
// ── Usuários (MASTER_ADMIN) ───────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.userNivel !== 'MASTER_ADMIN') return res.status(403).json({ error: 'Acesso negado' });
  next();
};

app.get('/api/usuarios', auth, adminOnly, async (req, res) => {
  try {
    const { rows } = await db.getAllUsuarios();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/usuarios', auth, adminOnly, async (req, res) => {
  try {
    const { nome_completo, email, senha, nivel_acesso, ativo = true } = req.body;
    const niveisPermitidos = ['SOLICITANTE', 'SOLICITANTE2', 'TECNICO', 'MASTER_ADMIN'];
    if (nivel_acesso && !niveisPermitidos.includes(nivel_acesso)) {
      return res.status(400).json({ error: 'Nível de acesso inválido' });
    }
    if (!nome_completo || !email || !senha) return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    const senha_hash = await bcrypt.hash(senha, 10);
    const { rows } = await db.createUsuario(
      nome_completo, email, senha_hash,
      nivel_acesso || 'SOLICITANTE',
      ativo
    );
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado.' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/usuarios/:id', auth, adminOnly, async (req, res) => {
  try {
    const { nome_completo, email, senha, nivel_acesso, ativo } = req.body;
    let result;
    if (senha && senha.trim()) {
      const senha_hash = await bcrypt.hash(senha.trim(), 10);
      result = await db.updateUsuarioComSenha(req.params.id, nome_completo, email, senha_hash, nivel_acesso, ativo);
    } else {
      result = await db.updateUsuario(req.params.id, nome_completo, email, nivel_acesso, ativo);
    }
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado.' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/usuarios/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.deleteUsuario(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── Logs de Visualização de Bandeja ───────────────────────────────────────────
app.post('/api/logs/visualizacao-bandeja', auth, async (req, res) => {
  try {
    const { totalChamadosVisiveis } = req.body;
    const { rows } = await db.registrarVisualizacaoBandeja(req.userId, totalChamadosVisiveis);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/logs/visualizacao-bandeja', auth, async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const { rows } = await db.getUltimasVisualizacoesBandeja(req.userId, limit);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Edição de Perfil do Usuário ───────────────────────────────────────────────
app.put('/api/usuarios/perfil', auth, async (req, res) => {
  try {
    const { nome_completo, email, senha_atual, nova_senha } = req.body;
    
    // Buscar usuário atual
    const userResult = await db.findUserByEmail(email);
    if (!userResult.rows.length && email) {
      // Se está trocando de email, verificar se o novo email já existe
      const emailCheck = await db.emailExistsExcludingUser(email, req.userId);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'E-mail já cadastrado por outro usuário.' });
      }
    }
    
    let result;
    
    // Se está tentando mudar a senha
    if (nova_senha && nova_senha.trim()) {
      if (!senha_atual) {
        return res.status(400).json({ error: 'Senha atual é necessária para alterar a senha.' });
      }
      
      // Verificar senha atual
      const user = userResult.rows[0];
      if (!user || !(await bcrypt.compare(senha_atual, user.senha_hash))) {
        return res.status(401).json({ error: 'Senha atual incorreta.' });
      }
      
      const nova_senha_hash = await bcrypt.hash(nova_senha.trim(), 10);
      result = await db.updateUsuarioPerfilComSenha(req.userId, nome_completo, email, nova_senha_hash);
    } else {
      // Apenas atualizar nome e email
      result = await db.updateUsuarioPerfil(req.userId, nome_completo, email);
    }
    
    // Gerar novo token com dados atualizados
    const cargoResult = await db.getCargoByUserId(req.userId);
    const nivel_acesso = cargoResult.rows[0]?.nivel_acesso || 'SOLICITANTE';
    
    const newToken = jwt.sign(
      { id: req.userId, nome: result.rows[0].nome_completo, nivel_acesso },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token: newToken,
      user: {
        id: req.userId,
        nome: result.rows[0].nome_completo,
        email: result.rows[0].email,
        nivel_acesso
      }
    });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado.' });
    res.status(500).json({ error: e.message });
  }
});

// ── Logs de Visualização (Admin) ─────────────────────────────────────────────
app.get('/api/admin/logs-visualizacao', auth, adminOnly, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const { rows } = await db.getAllLogsVisualizacao(limit, offset);
    const totalResult = await db.getTotalLogsVisualizacao();
    res.json({
      logs: rows,
      total: parseInt(totalResult.rows[0]?.total || 0),
      limit,
      offset
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/logs-visualizacao/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.deleteLogVisualizacao(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/logs-visualizacao', auth, adminOnly, async (req, res) => {
  try {
    const { usuarioId, all } = req.query;
    if (all === 'true') {
      await db.deleteAllLogsVisualizacao();
    } else if (usuarioId) {
      await db.deleteLogsByUser(usuarioId);
    } else {
      return res.status(400).json({ error: 'Parâmetro inválido' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/logs/visualizacao-meus-atendimentos', auth, async (req, res) => {
  try {
    const { totalChamadosVisiveis, aba } = req.body;
    
    // Registrar na mesma tabela de logs de visualização
    const { rows } = await db.registrarVisualizacaoMeusAtendimentos(
      req.userId, 
      totalChamadosVisiveis, 
      aba || 'meus_atendimentos'
    );
    
    res.json(rows[0]);
  } catch (e) {
    console.error('❌ Erro ao registrar visualização:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/logs-visualizacao/export', auth, adminOnly, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let logs;
    
    if (startDate && endDate) {
      const result = await db.getLogsByDateRange(startDate, endDate);
      logs = result.rows;
    } else {
      const result = await db.getAllLogsVisualizacao(10000, 0);
      logs = result.rows;
    }
    
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Iniciar ───────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
}

export default app;