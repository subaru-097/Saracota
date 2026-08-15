---
name: sara-whatsapp-integration
description: Padrões de integração com WhatsApp Business API para receber áudios/textos e montar listas de compra. Use sempre que trabalhar na integração de WhatsApp.
---

# Integração WhatsApp

## Regras
- Áudio recebido deve ser transcrito via Whisper (ou similar) antes de qualquer processamento
- Texto/transcrição deve passar pelo mesmo pipeline de extração de atributos usado no painel web (reaproveitar a skill sara-matching-produtos)
- Após processar a lista, responder ao cliente no WhatsApp com um resumo estruturado + link direto para o painel web para revisão e início da cotação
- Nunca fechar cotações automaticamente via WhatsApp — a confirmação final sempre acontece no painel
