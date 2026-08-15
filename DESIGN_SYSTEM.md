# Design System Base — Sara Cota SaaS

Este documento define as diretrizes visuais, os design tokens centralizados e os princípios de UI/UX do **Sara Cota**, um SaaS premium para o setor de **material de construção, elétrica e hidráulica**, projetado para lojistas, engenheiros e encarregados de obra.

---

## 💎 1. Conceito Visual & Referências

O design do **Sara Cota** combina a elegância e eficiência dos melhores produtos SaaS modernos (ex: *Linear*, *Stripe Dashboard*, *Notion*) com a robustez e precisão do setor técnico/industrial de construção civil.

### Princípios Chave:
1. **Sofisticação Sem Excesso:** Interface dark vitrificada (glassmorphism sutil), contrastes de alta legibilidade sob luz de obra ou escritório.
2. **Mobile-First Por Natureza:** Todos os componentes são concebidos primeiro para uso em smartphones/tablets de campo (encarregados e compradores de obra), escalando com fluidez para telas ultra-wide.
3. **Sem Margem para Ambiguidade:** Tipografia numérica monoespaçada para quantitativos, bitolas, unidades e cálculo tributário (ICMS-ST).

---

## 🎨 2. Paleta de Cores & Destaque (Design Tokens)

Toda a paleta é controlada via **Variáveis CSS (`app/globals.css`)** e estendida no `tailwind.config.ts`.

### Base Neutra (Dark Luxury Industrial)
| Token | Cor Hex / RGBA | Uso e Aplicação |
|---|---|---|
| `--sara-canvas` | `#0A0C0E` | Fundo principal da aplicação (Grafite Chumbo Profundo) |
| `--sara-surface` | `#111419` | Superfície de cards, tabelas e contêineres vitrificados |
| `--sara-elevated` | `#181C22` | Modais, dropdowns e painéis flutuantes |
| `--sara-hover` | `#20252D` | Estado hover de linhas e itens selecionáveis |
| `--sara-border` | `rgba(255, 255, 255, 0.08)` | Bordas sutis separadoras |
| `--sara-border-highlight` | `rgba(255, 255, 255, 0.16)` | Bordas de cards ativos ou com foco |

### Tom de Destaque Vibrante Recomendado
* **Laranja Âmbar Industrial (`#F59E0B` / `--brand-primary`):** 
  * **Por que esta escolha?** No universo da construção civil e suprimentos (elétrica/hidráulica), o âmbar/laranja transmite **energia de obra, ação rápida, alerta produtivo e cotação de alto valor**, diferindo de dashboards azuis genéricos e mantendo um ar contemporâneo e executivo.

### Acentos Operacionais Secundários
| Token | Cor Hex | Aplicação no Domínio |
|---|---|---|
| `--accent-cyan` | `#0EA5E9` | Dados de tubulações hidráulicas, fiação elétrica, especificações técnicas |
| `--accent-emerald` | `#10B981` | Cotação aprovada, margem de lucro, economia atingida |
| `--accent-amber` | `#F59E0B` | Pedidos pendentes, cotações em andamento |
| `--accent-rose` | `#EF4444` | Alerta de falta de estoque, erro de tributação |

---

## 🔤 3. Tipografia & Hierarquia

* **Fonte Principal (Sans-Serif):** `Outfit` / `Inter`
  * Usada para títulos, rótulos de botões, navegação e textos corridos.
  * Hierarquia de peso: Light (300) para legendas, Medium (500) para corpo, Bold (700) para títulos.
* **Fonte Numérica & Técnica (Monospace):** `JetBrains Mono`
  * Usada para quantitativos (`50m`, `120 un`), códigos NCM/SKU, valores monetários (R$), alíquotas de ICMS-ST e tabelas de comparação.

---

## 📐 4. Espaçamento, Cantos Arredondados & Sombras

### Radius Controlled (`--radius-*`)
- **Pequeno (`6px`):** Badges, tags e inputs internos de tabelas.
- **Médio (`10px`):** Botões, selects e campos de formulário.
- **Grande (`14px`):** Cards principais de produtos e listas.
- **Extra Grande (`20px` - `28px`):** Painéis vitrificados e modais flutuantes.

### Elevação e Sombras
- `shadow-card`: `0 4px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05)`
- `shadow-floating`: `0 16px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)`
- `shadow-glow`: `0 0 24px rgba(245, 158, 11, 0.22)`

---

## ⚡ 5. Micro-animações & Sensação HÁPTICA/SaaS

- **Duração de Transição:** `200ms` a `300ms`
- **Curva de Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (Resposta instantânea e desaceleração suave estilo iOS/Linear).
- **Feedback ao Toque (Mobile):** `active:scale-[0.98]` para botões e cards interativos.

---

## 📱 6. Regras de Arquitetura Mobile-First

1. **Touch Targets Mínimos:** Todos os elementos interativos possuem área mínima de clique de `44x44px`.
2. **Sem Overflow Horizontal:** Containers utilizam `w-full max-w-7xl mx-auto px-4 sm:px-6`.
3. **Ícones Consistentes:** Biblioteca oficial `lucide-react` para garantia de traço e proporcionalidade.

---

## 📂 7. Estrutura de Pastas Implementada

```
Saracota/
├── app/
│   ├── globals.css         <-- Design tokens, variáveis CSS e resets
│   ├── layout.tsx          <-- Layout Next.js com suporte PWA & Dark Mode
│   └── page.tsx            <-- Preview do Design System Base
├── components/
│   ├── ui/                 <-- Futuros componentes reutilizáveis (Card, Button, Badge, etc.)
│   └── layout/             <-- Futuros elementos de navegação (Header, BottomNav, Sidebar)
├── styles/
│   └── tokens.ts           <-- Mapeamento tipado dos tokens para TypeScript
├── lib/
│   └── utils.ts            <-- Utilitários (cn merger, formatadores BRL e quantitativos)
├── hooks/                  <-- Custom React Hooks
├── tailwind.config.ts      <-- Mapeamento do Tailwind para as variáveis CSS
├── package.json
└── DESIGN_SYSTEM.md        <-- Este documento
```

---

> ⚠️ **Status Atual:** A base do design system e a estrutura de pastas estão 100% criadas. Nenhuma tela ou componente de produto foi montado ainda, conforme solicitado. Aguardando sua confirmação para prosseguir.
