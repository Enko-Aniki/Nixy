import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import session from "express-session";
import routes from "./routes/routes.js";
import { db } from './db.js';
import postagemRoutes from './routes/postagen.js';
import anotacaoRoutes from './routes/anotacao.js';
import { ensureAuthenticated } from './middlewares/auth.js';
import bcrypt from 'bcrypt';
import pomodoroRoutes from './routes/pomodoro.js';


const app = express();


const menuItems = [
  { nome: "Agenda", link: "/agenda" },
  { nome: "Minhas estatísticas", link: "/estatisticas" },
  { nome: "Anotações", link: "/anotacoes" },
  { nome: "Pomodoro", link: "/pomodoro" }
];

app.use((req, res, next) => {
  res.locals.menuItems = menuItems;
  next();
});

app.use(session({
  secret: 'seu_segredo_aqui',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors());
app.use("/uploads", express.static("uploads"));
app.use('/anotacoes', anotacaoRoutes);

app.set('view engine', 'ejs');
app.set('views', './view');
app.use('/pomodoro', pomodoroRoutes);



app.use((req, res, next) => {
  res.locals.menuItems = menuItems;
  next();
});

app.get('/usuario', async (req, res) => {
  const usuarioLogado = req.session.user;

  if (!usuarioLogado) {
    return res.redirect("/login");
  }

  try {
    const [rows] = await db.query("SELECT * FROM usuario_t01 WHERE ID_USUARIO_T01 = ?", [usuarioLogado.ID_USUARIO_T01]);

    if (rows.length === 0) {
      return res.status(404).send("Usuário não encontrado");
    }

    const user = rows[0];

    res.render("usuario", { usuario: user });

  } catch (err) {
    console.error("Erro ao carregar usuário:", err);
    res.status(500).send("Erro ao carregar a página.");
  }
});

app.get("/", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  res.render("index", {
    user: req.session.user,
    usuarioNome: req.session.user.NOME_USUARIO_T01 || "Usuário",
    mostrarMenu: true
  });
});

app.get("/agenda", async (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  const now = new Date();
  const { month, year } = req.query;

  const currentMonth = month ? parseInt(month) : now.getMonth();
  const currentYear = year ? parseInt(year) : now.getFullYear();

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) days.push(d);

  const isToday = (d) => {
    return (
      d === now.getDate() &&
      currentMonth === now.getMonth() &&
      currentYear === now.getFullYear()
    );
  };

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  // 🔍 Consulta ao banco para pegar os dias estudados do usuário naquele mês
  try {
    const [diasEstudados] = await db.query(
      `SELECT DATA_ESTUDO FROM dias_estudados_t01 
       WHERE ID_USUARIO_T01 = ? 
       AND MONTH(DATA_ESTUDO) = ? 
       AND YEAR(DATA_ESTUDO) = ?`,
      [user.ID_USUARIO_T01, currentMonth + 1, currentYear]
    );

    // Cria um Set com os dias estudados (apenas o dia, sem o mês e ano)
    const diasEstudadosSet = new Set(
      diasEstudados.map((row) => new Date(row.DATA_ESTUDO).getDate())
    );

    res.render("agenda", {
      user,
      usuarioNome: user.NOME_USUARIO_T01,
      mostrarMenu: true,
      month: currentMonth,
      year: currentYear,
      days,
      isToday,
      monthName: new Date(currentYear, currentMonth).toLocaleString("pt-BR", { month: "long" }),
      prevMonth,
      prevYear,
      nextMonth,
      nextYear,
      diasEstudadosSet
    });
  } catch (err) {
    console.error("Erro ao carregar dias estudados:", err);
    res.status(500).send("Erro ao carregar a agenda.");
  }
});


app.post('/agenda/marcar-dia', async (req, res) => {
  const user = req.session.user;
  const { data } = req.body;

  if (!user || !data) return res.status(400).send("Requisição inválida");

  try {
    await db.query(
      'INSERT IGNORE INTO dias_estudados_t01 (ID_USUARIO_T01, DATA_ESTUDO) VALUES (?, ?)',
      [user.ID_USUARIO_T01, data]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro ao marcar dia:", err);
    res.status(500).send("Erro ao salvar dia estudado");
  }
});


app.get("/estatisticas", async (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  try {
  
    const [[{ totalSegundos }]] = await db.query(
      `SELECT COALESCE(SUM(SEGUNDOS_GASTOS), 0) AS totalSegundos
       FROM pomodoro_t01
       WHERE ID_USUARIO_T01 = ?`,
      [user.ID_USUARIO_T01]
    );
    const progressoHoras = (totalSegundos / 3600).toFixed(1);

  
    const [diasEstudadosRows] = await db.query(
      `SELECT DATA_ESTUDO FROM dias_estudados_t01 WHERE ID_USUARIO_T01 = ?`,
      [user.ID_USUARIO_T01]
    );

    const diasEstudadosUsuario = diasEstudadosRows.map(row => new Date(row.DATA_ESTUDO));

    const agora = new Date();
    const mesAtual = agora.getMonth();      
    const anoAtual = agora.getFullYear();   

    const diasEstudadosMesAtual = diasEstudadosUsuario.filter(data => {
      return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
    }).length;

   
    const diasEstudadosPorMes = Array(12).fill(0);
    diasEstudadosUsuario.forEach(data => {
      if (data.getFullYear() === anoAtual) {
        diasEstudadosPorMes[data.getMonth()]++;
      }
    });

    res.render('estatisticas', {
      user,
      mostrarMenu: true,
      diasEstudados: diasEstudadosPorMes, 
      diasEstudadosMesAtual,              
      horasEstudadas: progressoHoras,
      posts: 0,
      progressoHoras,
    });

  } catch (err) {
    console.error("Erro ao carregar estatísticas:", err);
    res.status(500).send("Erro ao carregar estatísticas.");
  }
});

app.get("/pomodoro", (req, res) => {
  res.render("pomodoro", { user: req.session.user, usuarioNome: "usuario_nome", mostrarMenu: true });
});



app.get('/login', (req, res) => {
  res.render('login', { mostrarMenu: false, error: null, email: '' });
});

app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM USUARIO_T01 WHERE EMAIL_USUARIO_T01 = ?', [email]);

    if (rows.length === 0) {
      return res.render('login', {
        mostrarMenu: false,
        error: "Email ou senha inválidos",
        email,
        nome: ""
      });
    }

    const user = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, user.SENHA_USUARIO_T01);

    if (!senhaCorreta) {
      return res.render('login', {
        mostrarMenu: false,
        error: "Email ou senha inválidos",
        email,
        nome: ""
      });
    }

    req.session.user = user;
    res.redirect('/');
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).render("login", {
      mostrarMenu: false,
      error: "Erro interno ao tentar fazer login",
      email,
      nome: ""
    });
  }
});


app.get('/esqueciAsenha', (req, res) => {
  res.render('esqueciAsenha', {
    mostrarMenu: false,
    error: null,
    email: "",
    nome: ""
  });
});



app.get('/cadastro', (req, res) => {
  res.status(200).render('cadastro', {
    mostrarMenu: false,
    nome: '',
    email: '',
    error: null
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/landingPage', (req, res) => {
  res.status(200).render('landingPage', { mostrarMenu: false });
});

//forúm


async function buscarPosts() {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.ID_POST_T05 as id,
        p.TITULO_POST_T05 as titulo,
        p.CONTEUDO_POST_T05 as conteudo,
        p.CATEGORIA_POST_T05 as forum,
        u.NOME_USUARIO_T01 as autor,
        p.DATA_CRIACAO_POST_T05 as data
      FROM POST_T05 p
      JOIN USUARIO_T01 u ON p.ID_USUARIO_T01 = u.ID_USUARIO_T01
      ORDER BY p.DATA_CRIACAO_POST_T05 DESC
    `);
    return rows;
  } catch (err) {
    console.error("Erro ao buscar posts:", err);
    return [];
  }
}

async function buscarComunidades() {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT CATEGORIA_POST_T05 as nome 
      FROM POST_T05 
      WHERE CATEGORIA_POST_T05 IS NOT NULL
    `);
    return rows.map(row => row.nome);
  } catch (err) {
    console.error("Erro ao buscar comunidades:", err);
    return [];
  }
}

app.use('/postagens', postagemRoutes);

app.get("/forum", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  try {
    const posts = await buscarPosts();
    const comunidades = await buscarComunidades();

    res.render("forum", {
      user: req.session.user,
      posts,
      comunidades,
      mostrarMenu: true
    });
  } catch (err) {
    console.error("Erro ao carregar fórum:", err);
    res.status(500).send("Erro ao carregar o fórum");
  }
});
app.use(routes);



// Adicionando as rotas de postagem
app.use('/api/postagen', postagemRoutes);

app.listen(8080, () => {
  console.log("Rodando na porta 8080");
})