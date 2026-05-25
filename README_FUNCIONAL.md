# Stratos Suite Frontend

Frontend React/Vite preparado para Vercel consumindo o backend Django por
`VITE_API_BASE_URL`.

## Como rodar localmente

Crie um `.env.local` com a URL do backend local:

```txt
VITE_API_BASE_URL=http://localhost:8000
```

Depois rode:

```bash
npm install
npm run dev
```

## Vercel

Cadastre a variavel abaixo no projeto da Vercel:

```txt
VITE_API_BASE_URL=https://back-nimbus.onrender.com
```

O client central de API adiciona `/api` automaticamente quando necessario.

## Autenticacao

- `401` e `403` limpam a sessao local.
- O `AppShell` redireciona para `/login` quando a API exige nova autenticacao.

## Build validado

```bash
npm run build
```
