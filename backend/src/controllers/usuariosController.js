const { query } = require("../config/database");

async function listarPsicologos(req, res, next) {
  try {
    const psicologos = await query(
      `SELECT id_usuario, nome, email, telefone, crp, especialidade
       FROM usuario
       WHERE perfil_id = 2
       ORDER BY nome`
    );

    return res.json(psicologos);
  } catch (error) {
    return next(error);
  }
}

async function obterPerfil(req, res, next) {
  try {
    const usuarios = await query(
      `SELECT id_usuario, nome, email, telefone, idade, ocupacao, crp, especialidade, perfil_id
       FROM usuario
       WHERE id_usuario = :id`,
      { id: req.usuario.id_usuario }
    );

    return res.json(usuarios[0]);
  } catch (error) {
    return next(error);
  }
}

async function atualizarPerfil(req, res, next) {
  try {
    const { nome, telefone, idade, ocupacao, crp, especialidade } = req.body;

    await query(
      `UPDATE usuario
       SET nome = COALESCE(:nome, nome),
           telefone = COALESCE(:telefone, telefone),
           idade = COALESCE(:idade, idade),
           ocupacao = COALESCE(:ocupacao, ocupacao),
           crp = COALESCE(:crp, crp),
           especialidade = COALESCE(:especialidade, especialidade)
       WHERE id_usuario = :id`,
      {
        id: req.usuario.id_usuario,
        nome: nome || null,
        telefone: telefone || null,
        idade: idade || null,
        ocupacao: ocupacao || null,
        crp: crp || null,
        especialidade: especialidade || null
      }
    );

    return res.json({ mensagem: "Perfil atualizado com sucesso." });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listarPsicologos, obterPerfil, atualizarPerfil };

