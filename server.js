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
  // Apenas MASTER_ADMIN
  if (req.userNivel !== 'MASTER_ADMIN') return res.status(403).json({ error: 'Acesso negado' });
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
  try {
    const { rows } = await db.assignResponsavel(req.params.id, req.userId);
    await db.addHistorico(req.params.id, req.userId, 'ATRIBUICAO', `Chamado assumido por ${req.userNome}`);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/chamados/:id/fechar', auth, async (req, res) => {
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
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));