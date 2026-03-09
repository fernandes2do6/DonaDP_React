# Dona D&P - Design System & Padrões UI (Google Stitch Ready)

> **Nota para o Rendering Engine (Stitch):**
> Utilize este arquivo como System Prompt complementar para toda geração "Auto-Prototype" em React.

## 1. Identidade Visual (The Dona D&P Aesthetic)

- **Paleta Premium**:
  - Primária: Tons profundos de Roxo (`purple-600` ao `purple-900`) e sutilezas em Rosa (`pink-500`) para um visual cosmético premium.
  - Fundos (Backgrounds): Priorizar interfaces neutras escurecidas (Dark Mode nativo) ou brancos acinzentados clássicos.
- **Glassmorphism**: Abusar de `bg-opacity-XX`, `backdrop-blur-md` e bordas translúcidas para painéis e sidebars.
- **Tipografia**: Interface extremamente limpa e legível (Inter/Outfit). Títulos com peso `font-bold` a `font-black`.

## 2. UI Components & Tailwind Formulas

Todos os componentes submetidos à automação do Stitch devem compilar 100% de Tailwind CSS puro (sem bibliotecas de CSS externas além do `index.css` de base).

- **Cards**: `bg-white dark:bg-gray-800 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700`
- **Buttons Action**: `bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold rounded-lg px-6 py-2 hover:scale-105 active:scale-95 transition-transform`
- **Inputs**: Foco na acessibilidade (`ring-purple-500 focus:outline-none focus:ring-2`).

## 3. Micro-interações

- Feedback imersivo: Carregamentos (spinners), skeleton loaders antes de injetar dados e tooltips explicativos.
