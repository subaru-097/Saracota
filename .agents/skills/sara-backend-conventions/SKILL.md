---
name: sara-backend-conventions
description: Padrões de arquitetura e código do backend da Sara Cota. Use sempre que criar ou modificar rotas de API, models ou services.
---

# Backend Conventions

## Stack
- FastAPI (Python) ou NestJS (Node) como framework de API
- Postgres como banco principal
- Redis para fila/cache

## Padrões de API
- Toda rota deve seguir REST, com prefixo /api/v1/
- Resposta de erro: { "error": true, "message": string, "code": string }
- Resposta de sucesso: { "data": ..., "meta": {} }

## Entidades principais
Cliente, Fornecedor, Lista, ItemLista, Cotacao, ItemCotacao, HistoricoCotacao

## Regras
- Autenticação via JWT
- Multi-tenant: toda tabela relevante deve ter cliente_id
- Suporte a múltiplos CNPJs/obras por cliente (tabela Projeto vinculada a Cliente)
- Jobs assíncronos (cotação, transcrição) sempre via fila (BullMQ ou Celery), nunca síncrono bloqueando a API
