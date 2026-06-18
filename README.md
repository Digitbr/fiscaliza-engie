# Fiscaliza Pro ENGIE

Sistema de fiscalização operacional preparado para Next.js, Vercel, Supabase PostgreSQL, Prisma ORM e Supabase Storage.

A interface operacional existente foi preservada em `public/` para evitar regressões no fluxo de rondas e exportação XLSX. A nova camada de dados está disponível nas rotas Next.js e pode substituir gradualmente o armazenamento legado em `localStorage`.

## Persistência operacional

Após autenticar, rondas, registros de KM, avisos e escalas são carregados de
`operational_state` no PostgreSQL e cada alteração é sincronizada com o banco.
IndexedDB/localStorage permanecem somente como espelho local para contingência.

## Primeiro operador programador

Depois de aplicar migrations e seed, crie o seu login com acesso total:

```bash
npm run operator:create -- "seu-email@empresa.com" "uma-senha-segura" "Seu nome"
```

O comando cria ou atualiza o usuário no Supabase Auth e no PostgreSQL com:

- perfil administrador;
- todas as funções disponíveis;
- proteção contra exclusão por outros administradores;
- acesso à tela **Usuários**, onde novos usuários podem ser criados, editados,
  ativados, desativados ou removidos.

## Stack

- Next.js (App Router e Route Handlers)
- PostgreSQL da Supabase
- Prisma ORM 7 com adapter `pg`
- Supabase Auth para autenticar as APIs
- Supabase Storage para evidências
- Zod para validação

## Modelagem

O schema inclui:

- clientes e postos;
- colaboradores e usuários;
- fiscalizações;
- modelos e itens de checklist;
- respostas;
- evidências;
- ocorrências;
- planos de ação;
- logs de auditoria.

Arquivo principal: `prisma/schema.prisma`.

## Configuração local

1. Instale Node.js 22 LTS ou uma versão compatível com `>=20.19`.
2. Instale as dependências:

```bash
npm install
```

3. Copie `.env.example` para `.env` e preencha somente com dados do seu projeto:

```bash
Copy-Item .env.example .env
```

Variáveis:

```dotenv
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Nunca prefixe a service role com `NEXT_PUBLIC_`. Ela deve existir apenas no servidor.

4. Gere o Prisma Client:

```bash
npm run prisma:generate
```

5. Aplique as migrations e execute o seed:

```bash
npm run prisma:migrate:deploy
npm run prisma:seed
```

6. Inicie o sistema:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Supabase PostgreSQL

No painel da Supabase:

1. Abra **Connect**.
2. Use a URL do Supavisor em **Transaction mode**, porta `6543`, em `DATABASE_URL`. Essa conexão é usada pela aplicação serverless na Vercel.
3. Use a URL do Supavisor em **Session mode**, porta `5432`, em `DIRECT_URL`. Essa conexão é usada pelo Prisma CLI para migrations e seed.
4. Inclua `sslmode=require` nas URLs.
5. Não utilize a senha do banco no frontend.

Exemplos sem credenciais reais:

```dotenv
DATABASE_URL="postgresql://prisma.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_URL="postgresql://prisma.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres?sslmode=require"
```

O arquivo `prisma.config.ts` usa `DIRECT_URL` para operações do Prisma CLI. O cliente da aplicação usa `DATABASE_URL`.

## Supabase Auth

As rotas CRUD exigem:

```http
Authorization: Bearer <access_token_do_supabase_auth>
```

O seed cria perfis de exemplo sem senha:

- `operador@prime.local`
- `supervisor@example.com`

Crie os usuários equivalentes em **Authentication > Users**. No primeiro acesso à API, o sistema associa automaticamente o UUID do Supabase Auth ao usuário local quando o e-mail for igual.

Troque os e-mails de exemplo antes de usar em produção.

## Supabase Storage

Crie um bucket privado chamado `evidencias` em **Storage**.

O endpoint abaixo gera uma URL temporária de upload usando a service role somente no servidor:

```http
POST /api/evidences/upload
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "inspectionId": "uuid-da-fiscalizacao",
  "fileName": "foto-portao.jpg",
  "mimeType": "image/jpeg",
  "bucket": "evidencias"
}
```

Depois do upload, registre os metadados em:

```http
POST /api/resources/evidences
```

O bucket deve permanecer privado. O frontend nunca recebe `SUPABASE_SERVICE_ROLE_KEY`.

## API

Recursos CRUD:

- `clients`
- `posts`
- `collaborators`
- `users`
- `checklists`
- `checklist-items`
- `inspections`
- `responses`
- `evidences`
- `occurrences`
- `action-plans`

Rotas:

```text
GET    /api/resources/:resource
POST   /api/resources/:resource
GET    /api/resources/:resource/:id
PATCH  /api/resources/:resource/:id
DELETE /api/resources/:resource/:id
```

As operações de criação, alteração e exclusão geram registros em `audit_logs`.

Health check:

```text
GET /api/health/db
```

Resposta esperada:

```json
{
  "status": "ok",
  "database": "connected",
  "latencyMs": 25,
  "timestamp": "2026-06-18T12:00:00.000Z"
}
```

## Vercel

1. Importe o repositório ou mantenha o projeto Vercel já vinculado.
2. Em **Settings > Environment Variables**, cadastre as cinco variáveis do `.env.example` para Production, Preview e Development conforme necessário.
3. Não coloque aspas extras nos valores cadastrados no painel.
4. O Build Command pode permanecer:

```bash
npm run build
```

5. A migration deve ser executada de forma controlada antes do deploy:

```bash
npm run prisma:migrate:deploy
```

Evite executar migrations concorrentes em várias funções serverless. O `postinstall` gera o Prisma Client durante o build da Vercel.

## Validação antes da produção

```bash
npm install
npm run prisma:generate
npm run prisma:validate
npm run check
npm run lint
npm run build
npm run prisma:migrate:deploy
npm run prisma:seed
```

Após o deploy:

```text
https://fiscaliza-engie.vercel.app/api/health/db
```

O endpoint só estará saudável depois que as variáveis forem configuradas e a migration tiver sido aplicada.
