# Stratos Suite Frontend — Versão integrada ao backend

## O que foi implementado

- API client centralizado em `src/lib/api.ts`.
- Login real via backend Django JWT.
- Persistência de sessão em `localStorage`.
- Refresh token automático.
- Logout.
- Proteção das telas internas pelo `AppShell`.
- Listagens principais conectadas ao backend:
  - Dashboard;
  - Clientes;
  - Projetos;
  - Chamados;
  - Equipe;
  - Sprints;
  - Kanban;
  - Backlog;
  - Atividades.
- Formulários principais salvando na API real:
  - cliente;
  - membro/equipe;
  - projeto;
  - chamado;
  - sprint;
  - atividade;
  - item de backlog.
- Nova rota `/backlog/new`.
- Build executado com sucesso.
- Layout, identidade visual, componentes, cores e estrutura visual preservados.

## Como rodar

Antes, rode o backend em `http://localhost:8000`.

```bash
npm install
npm run dev
```

A variável já está configurada no `.env`:

```txt
VITE_API_BASE_URL=http://localhost:8000/api
```

## Login demo

```txt
Usuário: admin
Senha: admin123
```

## Build validado

```bash
npm run build
```
