# Fiscaliza Pro ENGIE

Sistema web local para registro guiado de rondas ENGIE.

## Acessos

- Admin: `admin` / `admin123`
- Supervisor: `Engie` / `engie123`

## Funcionalidades

- Login por perfil.
- Dashboard com registros, ocorrências e avisos.
- Chatbot/checklist para preenchimento de ronda.
- Regras por TAG:
  - TAG Tims: 1ª e 2ª ronda.
  - TAG Itapemirim: somente 1ª ronda.
  - TAG Viana: somente 1ª ronda.
- Cálculo automático de saída com permanência fixa de 30 minutos.
- Upload de quatro fotos.
- Histórico com filtros por data e TAG.
- Exportacao em `.xls`.
- Escalas diurna/noturna, editáveis somente pelo admin.
- Avisos editáveis somente pelo admin.

## Rodar localmente

```bash
npm run dev
```

Abra `http://localhost:4173`.

## Observacao sobre a planilha

A exportação atual segue a estrutura solicitada. Para ficar idêntica ao modelo final do cliente, envie o arquivo exemplo da planilha para ajuste fino de células, logos, dimensões, bordas e posicionamento.
