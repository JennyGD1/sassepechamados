import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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
     (numero_chamado, id_solicitante, descricao, criticidade, complexidade, status, prazo_limite)
     VALUES ($1, $2, $3, $4, $5, 'ABERTO', $6) RETURNING *`,
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
            u2.nome_completo AS responsavel_nome
     FROM chamado_sassepe_chamados c
     LEFT JOIN chamado_sassepe_usuarios u1 ON c.id_solicitante = u1.id
     LEFT JOIN chamado_sassepe_usuarios u2 ON c.id_responsavel = u2.id
     WHERE c.status IN ('ABERTO', 'EM ANALISE', 'AGUARDANDO VALIDACAO')
     ORDER BY c.prazo_limite ASC`
  ),
  getAllChamados: () => pool.query(
    `SELECT c.*,
            u1.nome_completo AS solicitante_nome,
            u2.nome_completo AS responsavel_nome
     FROM chamado_sassepe_chamados c
     LEFT JOIN chamado_sassepe_usuarios u1 ON c.id_solicitante = u1.id
     LEFT JOIN chamado_sassepe_usuarios u2 ON c.id_responsavel = u2.id
     ORDER BY c.data_abertura DESC`
  ),
  updateStatus: (id, status) => pool.query(
    'UPDATE chamado_sassepe_chamados SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  ),
  assignResponsavel: (id, responsavelId) => pool.query(
    `UPDATE chamado_sassepe_chamados
     SET id_responsavel = $1, status = 'EM ANALISE'
     WHERE id = $2 RETURNING *`,
    [responsavelId, id]
  ),
  closeChamado: (id, dataFechamento) => pool.query(
    `UPDATE chamado_sassepe_chamados
     SET status = 'AGUARDANDO VALIDACAO', data_fechamento = $1
     WHERE id = $2 RETURNING *`,
    [dataFechamento, id]
  ),
  finalizeChamado: (id) => pool.query(
    `UPDATE chamado_sassepe_chamados SET status = 'CONCLUIDO' WHERE id = $1 RETURNING *`,
    [id]
  ),

  // Histórico
  addHistorico: (chamadoId, usuarioId, acao, comentario) => pool.query(
    'INSERT INTO chamado_sassepe_historico (id_chamado, id_usuario, acao, comentario) VALUES ($1, $2, $3, $4)',
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
};