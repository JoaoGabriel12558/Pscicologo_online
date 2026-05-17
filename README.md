# Plataforma de Atendimento Psicologico Online

Projeto Integrador para uma plataforma web de atendimento psicologico online, com documentacao final, diagramas, prototipo web e backend API em Node.js.

## Estrutura

```text
atendimento pscicologico/
├── backend/              # API REST Node.js + Express + MySQL
├── web/                  # Site/prototipo navegavel
├── docs/                 # Documento final em HTML/PDF e imagens
└── entrega/originais/    # Arquivos originais usados como base
```

## Como abrir o site

Abra o arquivo:

```text
web/index.html
```

O prototipo funciona no navegador sem servidor e simula login, cadastro, agendamento, agenda e mensagens com `localStorage`.

## Como rodar o backend

```bash
cd backend
npm install
copy .env.example .env
npm run db:setup
npm run dev
```

Servidor padrao: `http://localhost:3000`

## Banco de dados local

O backend usa MySQL. Depois de configurar o arquivo `backend/.env`, rode:

```bash
cd backend
npm run db:setup
node src/index.js
```

Endpoints principais:

- `GET http://localhost:3000/api/estatisticas`
- `POST http://localhost:3000/api/auth/registro`
- `POST http://localhost:3000/api/auth/login`
- `GET http://localhost:3000/api/consultas`

Contas de teste criadas no banco local:

| Perfil | E-mail | Senha |
|---|---|---|
| Paciente | `ana@email.com` | `123456` |
| Psicologo | `marina@portalterapia.com` | `123456` |
| Psicologo | `rafael@portalterapia.com` | `123456` |
| Psicologo | `beatriz@portalterapia.com` | `123456` |
| Administrador | `admin@portalterapia.com` | `123456` |

O arquivo `backend/.env` nao deve ser enviado ao GitHub.

## Entrega final

O documento principal fica em:

```text
docs/projeto-final.html
docs/projeto-final.pdf
```

## Tecnologias

- HTML5, CSS3 e JavaScript
- Node.js, Express, JWT e bcryptjs
- MySQL
- Git e GitHub
