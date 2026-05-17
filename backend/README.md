# Backend - Plataforma de Atendimento Psicologico Online

API REST em Node.js, Express e MySQL para a Prova de Conceito do Projeto Integrador.

## Requisitos

- Node.js 18+
- MySQL

## Configuracao

```bash
npm install
copy .env.example .env
npm run db:setup
npm run dev
```

## Endpoints principais

Todas as rotas usam o prefixo `/api`.

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/api/auth/registro` | Cadastro de paciente, psicologo ou administrador |
| POST | `/api/auth/login` | Login com e-mail e senha |
| GET | `/api/estatisticas` | Resumo público de profissionais, pacientes e especialidades |
| GET | `/api/usuarios/psicologos` | Lista psicologos disponiveis |
| GET | `/api/usuarios/perfil` | Exibe perfil do usuario autenticado |
| PUT | `/api/usuarios/perfil` | Atualiza perfil |
| GET | `/api/disponibilidades/:psicologoId` | Lista horarios de um psicologo |
| POST | `/api/disponibilidades` | Cadastra disponibilidade do psicologo |
| DELETE | `/api/disponibilidades/:id` | Remove disponibilidade |
| POST | `/api/consultas` | Agenda consulta |
| GET | `/api/consultas` | Lista consultas do usuario autenticado |
| PATCH | `/api/consultas/:id/cancelar` | Cancela consulta |
| PATCH | `/api/consultas/:id/confirmar` | Confirma consulta |
| GET | `/api/mensagens` | Lista conversas |
| POST | `/api/mensagens` | Envia mensagem |
| GET | `/api/mensagens/:userId` | Lista conversa com um usuario |

Use o token retornado no login:

```text
Authorization: Bearer SEU_TOKEN
```
