# Fiscaliza Pro ENGIE

Sistema operacional de rondas com Next.js, Prisma e MySQL local.

## Banco de dados

Configure um MySQL acessível pela aplicação:

```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/fiscaliza_engie"
AUTH_SECRET="troque-por-uma-chave-grande-e-secreta"
```

Depois crie/atualize as tabelas:

```bash
npm install
npm run prisma:generate
npm run prisma:db:push
```

Opcionalmente carregue dados iniciais:

```bash
npm run prisma:seed
```

## Criar operador administrador

```bash
npm run operator:create -- "email@empresa.com" "senha-com-8-caracteres" "Nome do operador"
```

O login é local: senha com hash `scrypt` gravado na tabela `users.password_hash`.

## Produção

1. Configure `DATABASE_URL` apontando para o MySQL da hospedagem.
2. Configure `AUTH_SECRET` com uma chave forte.
3. Rode `npm run prisma:db:push` no ambiente de hospedagem ou durante a preparação do banco.
4. Rode `npm run build` e `npm start`.

## Registros de ronda

Os dados operacionais ficam em `operational_state`. O endpoint de sincronização usa versão dos dados para evitar que um celular com cópia antiga substitua tudo: quando a versão enviada está desatualizada, o servidor mescla registros, KM, avisos, escalas e funcionários por identificador.
