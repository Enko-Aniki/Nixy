import { db } from "../db.js";

// Função para criar uma postagem
export const criarPostagem = async (req, res) => {
    try {
        console.log("Dados recebidos no backend:", req.body);

        const { ID_USUARIO_T01, TITULO_POST_T05, CONTEUDO_POST_T05 } = req.body;

        if (!ID_USUARIO_T01 || !TITULO_POST_T05 || !CONTEUDO_POST_T05) {
            return res.status(400).json({ 
                erro: 'Campos obrigatórios não preenchidos',
                recebido: req.body
            });
        }

        const query = `
            INSERT INTO POST_T05 
            (ID_USUARIO_T01, TITULO_POST_T05, CONTEUDO_POST_T05) 
            VALUES (?, ?, ?)
        `;

        const result = await db.query(query, [ID_USUARIO_T01, TITULO_POST_T05, CONTEUDO_POST_T05]);
        
        res.status(201).json({ 
            mensagem: 'Postagem criada com sucesso', 
            id_post: result.insertId 
        });

    } catch (err) {
        console.error('Erro ao criar postagem:', err);
        res.status(500).json({ 
            erro: 'Erro interno ao criar postagem',
            detalhes: err.message
        });
    }
};


// Função para obter todas as postagens
export const getTodasPostagens = (req, res) => {
    const query = `
        SELECT 
            p.ID_POST_T05 as id,
            p.TITULO_POST_T05 as titulo,
            p.CONTEUDO_POST_T05 as conteudo,
            p.CATEGORIA_POST_T05 as forum,
            p.ARQUIVO_POST_T05 as arquivo,
            u.NOME_USUARIO_T01 as autor,
            u.ID_USUARIO_T01 as autor_id,  
            u.FOTO_PERFIL_URL as autor_foto,
            p.DATA_CRIACAO_POST_T05 as data,
            SUM(CASE WHEN LOWER(TRIM(TIPO_AVALIACAO_T08)) = 'positivo' THEN 1 ELSE 0 END) AS likes,
            SUM(CASE WHEN LOWER(TRIM(TIPO_AVALIACAO_T08)) = 'negativo' THEN 1 ELSE 0 END) AS dislikes,
            (SELECT TIPO_AVALIACAO_T08 FROM AVALIACAO_T08 
             WHERE ID_POST_T05 = p.ID_POST_T05 AND ID_USUARIO_T01 = ? LIMIT 1) as user_vote
        FROM POST_T05 p
        JOIN USUARIO_T01 u ON p.ID_USUARIO_T01 = u.ID_USUARIO_T01
        LEFT JOIN AVALIACAO_T08 a ON p.ID_POST_T05 = a.ID_POST_T05
        GROUP BY p.ID_POST_T05
        ORDER BY p.DATA_CRIACAO_POST_T05 DESC
    `;

    const userId = req.session.user?.ID_USUARIO_T01 || 0;

    db.query(query, [userId])
        .then(result => {
            res.status(200).json(result);
        })
        .catch(err => {
            console.error('Erro ao buscar postagens:', err);
            return res.status(500).json({ erro: 'Erro ao buscar postagens' });
        });
};

// Função para obter uma postagem por ID
export const getPostagemPorId = (req, res) => {
    const id = req.params.id;
    const query = 'SELECT * FROM POST_T05 WHERE ID_POST_T05 = ?';

    db.query(query, [id])
        .then(result => {
            if (result.length === 0) {
                return res.status(404).json({ erro: 'Postagem não encontrada' });
            }
            res.status(200).json(result[0]);
        })
        .catch(err => {
            console.error('Erro ao buscar postagem:', err);
            return res.status(500).json({ erro: 'Erro ao buscar postagem' });
        });
};
// Função para atualizar uma postagem
export const atualizarPostagem = async (req, res) => {
      console.log('Corpo da requisição:', req.body); 
    console.log('ID do post:', req.params.id); 
    const id = req.params.id;
    const { TITULO_POST_T05, CONTEUDO_POST_T05, CATEGORIA_POST_T05 } = req.body;
    const userId = req.session.user?.ID_USUARIO_T01;

    if (!userId) {
        return res.status(401).json({ erro: 'Usuário não autenticado' });
    }

    if (!TITULO_POST_T05 || !CONTEUDO_POST_T05) {
        return res.status(400).json({ erro: 'Campos obrigatórios não preenchidos' });
    }

    try {
        // Verifica se o post existe e se o usuário é o autor
        const [checkResult] = await db.query('SELECT ID_USUARIO_T01 FROM POST_T05 WHERE ID_POST_T05 = ?', [id]);
        
        if (checkResult.length === 0) {
            return res.status(404).json({ erro: 'Postagem não encontrada' });
        }
        
        const postAuthorId = checkResult[0].ID_USUARIO_T01;
        
        if (postAuthorId !== userId) {
            return res.status(403).json({ erro: 'Você não tem permissão para editar este post' });
        }

        // Atualiza o post
        const query = `
            UPDATE POST_T05
            SET TITULO_POST_T05 = ?, 
                CONTEUDO_POST_T05 = ?, 
                CATEGORIA_POST_T05 = ?,
                DATA_ATUALIZACAO_POST_T05 = NOW()  # Adiciona data de atualização
            WHERE ID_POST_T05 = ?
        `;

        const [result] = await db.query(query, [
            TITULO_POST_T05, 
            CONTEUDO_POST_T05, 
            CATEGORIA_POST_T05 || null, 
            id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ erro: 'Postagem não encontrada' });
        }

        // Retorna os dados atualizados
        const [updatedPost] = await db.query('SELECT * FROM POST_T05 WHERE ID_POST_T05 = ?', [id]);
        
        res.status(200).json({ 
            mensagem: 'Postagem atualizada com sucesso',
            post: updatedPost[0]
        });

    } catch (err) {
        console.error('Erro ao atualizar postagem:', err);
        return res.status(500).json({ erro: 'Erro interno ao atualizar postagem' });
    }
};


// Função para deletar uma postagem
export const deletarPostagem = async (req, res) => {
    const id = req.params.id;
    const userId = req.session.user?.ID_USUARIO_T01;

    if (!userId) {
        return res.status(401).json({ erro: 'Usuário não autenticado' });
    }

    try {
        // Primeiro verifica se o post existe e se o usuário é o autor
        const [checkResult] = await db.query('SELECT ID_USUARIO_T01 FROM POST_T05 WHERE ID_POST_T05 = ?', [id]);
        
        if (checkResult.length === 0) {
            return res.status(404).json({ erro: 'Postagem não encontrada' });
        }
        
        const postAuthorId = checkResult[0].ID_USUARIO_T01;
        
        if (postAuthorId !== userId) {
            return res.status(403).json({ erro: 'Você não tem permissão para deletar este post' });
        }
        
        // Se for o autor, procede com a deleção
        const [result] = await db.query('DELETE FROM POST_T05 WHERE ID_POST_T05 = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ erro: 'Postagem não encontrada' });
        }
        
        res.status(200).json({ mensagem: 'Postagem deletada com sucesso' });
    } catch (err) {
        console.error('Erro ao deletar postagem:', err);
        return res.status(500).json({ erro: 'Erro interno ao deletar postagem' });
    }
};


// Função para adicionar ou atualizar avaliação (positiva ou negativa)
export const adicionarOuAtualizarAvaliacao = (req, res) => {

    console.log('Corpo da requisição:', req.body);
    console.log('Parâmetros da URL:', req.params);
    console.log('Headers:', req.headers);



    // if (!req.session.user || !req.session.user.ID_USUARIO_T01) {
    //     return res.status(401).json({ erro: 'Usuário não autenticado' });
    // }

    const idPost = req.params.id;
    const idUsuario = req.body.ID_USUARIO_T01;
    const tipoAvaliacao = req.body.tipo;
    // Verificar se o tipo de avaliação é válido
    const { ID_USUARIO_T01, tipo } = req.body;
    if (tipo !== 'positivo' && tipo !== 'negativo') {
        return res.status(400).json({ erro: 'Tipo de avaliação inválido. Use "positivo" ou "negativo".' });
    }
    // Verificar se o usuário já avaliou essa postagem
    const checkQuery = 'SELECT TIPO_AVALIACAO_T08 FROM AVALIACAO_T08 WHERE ID_POST_T05 = ? AND ID_USUARIO_T01 = ?';

    db.query(checkQuery, [idPost, idUsuario])
        .then(result => {
            if (result.length > 0) {
                const avaliacaoExistente = result[0].TIPO_AVALIACAO_T08;

                if (avaliacaoExistente === tipoAvaliacao) {
                    // Remove a avaliação se for o mesmo tipo
                    const deleteQuery = 'DELETE FROM AVALIACAO_T08 WHERE ID_POST_T05 = ? AND ID_USUARIO_T01 = ?';

                    return db.query(deleteQuery, [idPost, idUsuario])
                        .then(() => {

                            // Atualiza contagem de likes/dislikes
                            const countQuery = `
                                SELECT 
                                    SUM(CASE WHEN TIPO_AVALIACAO_T08 = 'positivo' THEN 1 ELSE 0 END) as likes,
                                    SUM(CASE WHEN TIPO_AVALIACAO_T08 = 'negativo' THEN 1 ELSE 0 END) as dislikes
                                FROM AVALIACAO_T08 
                                WHERE ID_POST_T05 = ?
                            `;

                            return db.query(countQuery, [idPost])
                                .then((countResult) => {
                                    console.log('countResult raw:', countResult);
                                    const contagem = countResult[0][0];
                                    res.status(200).json({
                                        mensagem: 'Avaliação registrada com sucesso',
                                        acao: 'adicionado',
                                        likes: contagem.likes || 0,
                                        dislikes: contagem.dislikes || 0,
                                        user_vote: tipoAvaliacao
                                    });
                                });
                        });
                } else {
                    // Atualiza o tipo de avaliação
                    const updateQuery = `
                        UPDATE AVALIACAO_T08 
                        SET TIPO_AVALIACAO_T08 = ? 
                        WHERE ID_POST_T05 = ? AND ID_USUARIO_T01 = ?
                    `;

                    return db.query(updateQuery, [tipoAvaliacao, idPost, idUsuario])
                        .then(() => {
                            // Atualiza contagem de likes/dislikes
                            const countQuery = `
                                SELECT 
                                    SUM(CASE WHEN TIPO_AVALIACAO_T08 = 'positivo' THEN 1 ELSE 0 END) as likes,
                                    SUM(CASE WHEN TIPO_AVALIACAO_T08 = 'negativo' THEN 1 ELSE 0 END) as dislikes
                                FROM AVALIACAO_T08 
                                WHERE ID_POST_T05 = ?
                            `;

                            return db.query(countQuery, [idPost])
                                .then((countResult) => {
                                    console.log('countResult raw:', countResult);
                                    const contagem = countResult[0][0];
                                    res.status(200).json({
                                        mensagem: 'Avaliação registrada com sucesso',
                                        acao: 'adicionado',
                                        likes: contagem.likes || 0,
                                        dislikes: contagem.dislikes || 0,
                                        user_vote: tipoAvaliacao
                                    });
                                });
                        });
                }
            } else {
                // Adiciona nova avaliação
                const insertQuery = `
                    INSERT INTO AVALIACAO_T08 (ID_POST_T05, ID_USUARIO_T01, TIPO_AVALIACAO_T08)
                    VALUES (?, ?, ?)
                `;

                return db.query(insertQuery, [idPost, idUsuario, tipoAvaliacao])
                    .then((insertResult) => {
                        console.log('Resultado da inserção:', insertResult);
                        // Atualiza contagem de likes/dislikes
                        console.log('Tentando inserir:', { idPost, idUsuario, tipoAvaliacao });
                        const countQuery = `
                                    SELECT 
                                        SUM(CASE WHEN LOWER(TRIM(TIPO_AVALIACAO_T08)) = 'positivo' THEN 1 ELSE 0 END) AS likes,
                                        SUM(CASE WHEN LOWER(TRIM(TIPO_AVALIACAO_T08)) = 'negativo' THEN 1 ELSE 0 END) AS dislikes
                                    FROM AVALIACAO_T08 
                                    WHERE ID_POST_T05 = ?
                                `;

                        return db.query(countQuery, [idPost])
                            .then((countResult) => {
                                console.log('countResult raw:', countResult);
                                const contagem = countResult[0][0];
                                console.log('likes:', contagem.likes, 'dislikes:', contagem.dislikes);
                                res.status(200).json({
                                    mensagem: 'Avaliação registrada com sucesso',
                                    acao: 'adicionado',
                                    likes: contagem.likes || 0,
                                    dislikes: contagem.dislikes || 0,
                                    user_vote: tipoAvaliacao
                                });
                            });
                    });
            }
        })
        .catch(err => {
            console.error('Erro ao verificar/atualizar avaliação:', err);
            return res.status(500).json({ erro: 'Erro interno ao processar avaliação' });
        });
};
// Função para remover a avaliação 
export const removerAvaliacao = (req, res) => {
    const idPost = req.params.id;
    const idUsuario = req.body.ID_USUARIO_T01;

    // Verificar se o usuário já avaliou essa postagem
    const checkQuery = 'SELECT * FROM AVALIACAO_T08 WHERE ID_POST_T05 = ? AND ID_USUARIO_T01 = ?';

    db.query(checkQuery, [idPost, idUsuario])
        .then(result => {
            if (result.length === 0) {
                return res.status(400).json({ erro: 'Você não avaliou esta postagem.' });
            }

            // Remover a avaliação 
            const deleteQuery = 'DELETE FROM AVALIACAO_T08 WHERE ID_POST_T05 = ? AND ID_USUARIO_T01 = ?';

            db.query(deleteQuery, [idPost, idUsuario])
                .then(() => {
                    res.status(200).json({ mensagem: 'Avaliação removida com sucesso' });
                })
                .catch(err => {
                    console.error('Erro ao remover avaliação:', err);
                    return res.status(500).json({ erro: 'Erro interno ao remover avaliação' });
                });
        })
        .catch(err => {
            console.error('Erro ao verificar avaliação existente:', err);
            return res.status(500).json({ erro: 'Erro ao verificar avaliação' });
        });
};
