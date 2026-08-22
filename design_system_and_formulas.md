# Dona D&P - Design System & Padrões UI (Google Stitch Ready)

> **Nota para o Rendering Engine (Stitch):**
> Utilize este arquivo como System Prompt complementar para toda geração "Auto-Prototype" em React.

## 1. Identidade Visual (The Dona D&P Aesthetic - Tema Outono)

- **Paleta Premium (Outono)**:
  - Primária: Tons quentes e elegantes de Laranja (`orange-500` ao `orange-600`) e Amarelo Dourado (`yellow-500`) e detalhes em Marrom (`brown`).
  - Fundos (Backgrounds): Priorizar interfaces com fundo Gelo Off-White (`light.bg`) e cards Brancos (`light.surface`), abandonando o Dark Mode. Textos em Marrom Escuro (`light.text`) para legibilidade e suavidade.
- **Glassmorphism Claro**: Abusar de `bg-white bg-opacity-XX` (como `.glass` e `.glass-card`), `backdrop-blur-md` e bordas claras translúcidas para painéis e sidebars. Sombras devem ser mais sutis (`shadow-md` ou `shadow-lg` claras).
- **Tipografia**: Interface extremamente limpa e legível (Inter). Títulos com peso `font-bold` a `font-black`.

## 2. UI Components & Tailwind Formulas

Todos os componentes submetidos à automação do Stitch devem compilar 100% de Tailwind CSS puro (sem bibliotecas de CSS externas além do `index.css` de base).

- **Cards**: `bg-light-surface rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-light-border`
- **Buttons Action**: `bg-gradient-to-r from-brand-orange to-brand-yellow text-white font-semibold rounded-lg px-6 py-2 hover:scale-105 active:scale-95 transition-transform shadow-md shadow-brand-orange/20`
- **Inputs**: Foco na acessibilidade (`focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/25 focus:outline-none bg-light-surface text-light-text border-light-border`).

## 3. Micro-interações

- Feedback imersivo: Carregamentos (spinners), skeleton loaders antes de injetar dados e tooltips explicativos.
