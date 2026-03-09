# Funcionalidades e Lógica de Automação (Scraping & Sincronização)

Este documento atua como referência primordial para a engine de IA e automações do projeto **Dona D&P**.

## 1. Mapeamento de Contexto

As seguintes fontes de dados são consideradas primárias (SSOT - Single Source of Truth) ou caches vitais para o sistema:

- `Vendas.csv`
- `Clientes.csv`
- `Produtos.csv`
- Diretório de Processamento PDF: `src/assets/catalogos/`

## 2. Automação de Scraping de Catálogos

Quando ativado o scraping de catálogos locais (PDFs depositados no diretório mapeado), a rotina de extração deve seguir este fluxo ético e ordenado:

1. **Identificação de Metadados**: Mapeamento do nome da Marca e Ciclo (ex: "Eudora_Ciclo_01").
2. **Parsing de Texto**: Leitura com expressões regulares dinâmicas para captação de chaves `{Codigo_Produto}`, `{Nome_Produto}` e `{Preco_Sugerido}`.
3. **Consolidação**: Upload automatizado dos produtos no Firebase/Firestore.

## 3. Lógica de Sincronização em Tempo Real (Eventos)

O uso de WebSockets (Firestore real-time listeners) gerencia os updates da interface.

- Qualquer deleção de Venda propagará imediatamente a atualização do `Fluxo Financeiro` (A Receber / A Pagar).
- Tratamentos de concorrência e offline-first habilitados no SDK (persistencia de cache).
