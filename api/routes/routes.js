import express from "express"
const routes = express.Router();
import upload from '../middlewares/upload.js';
import { deletarPostagem, atualizarPostagem } from "../controllers/PostController.js";

routes.post("/upload-foto", upload.single("foto"), (req, res) => {
  console.log("Arquivo recebido:", req.file);
  res.redirect("/usuario"); 
});

import { uploadFotoPerfil } from "../controllers/UserController.js";

routes.post("/upload-foto/:id", upload.single("foto"), uploadFotoPerfil);



import { getUsers, createUser, updateUser, deleteUser, login } from "../controllers/UserController.js";
import { esqueceuSenha,  exibirFormularioReset, formularioResetarSenha, redefinirSenha } from "../controllers/UserController.js";

routes.get("/getUsers", getUsers);
routes.post("/createUser", createUser);
routes.put("/updateUser", updateUser);
routes.delete("/deleteUser", deleteUser);
routes.post("/login", login);

routes.get("/esqueci-senha", (req, res) => {
    res.render("esqueciAsenha", { mensagem: null });
  });
  routes.post("/esqueci-senha", esqueceuSenha);
  routes.get('/resetar-senha/:token', exibirFormularioReset);

routes.post('/resetarSenha/:token', redefinirSenha);


routes.delete("/post/:id", deletarPostagem);
routes.put("/post/:id", atualizarPostagem);

routes.put("/post/:id", atualizarPostagem);
routes.delete("/post/:id", deletarPostagem);

import { 
    criarComentario, 
    getComentariosPorPost, 
    atualizarComentario, 
    deletarComentario 
} from "../controllers/comentarioController.js";

// Rotas para comentários
routes.post("/comentario", criarComentario);
routes.get("/post/:id/comentarios", getComentariosPorPost);
routes.put("/comentario/:id", atualizarComentario);
routes.delete("/comentario/:id", deletarComentario);
  
export default routes;