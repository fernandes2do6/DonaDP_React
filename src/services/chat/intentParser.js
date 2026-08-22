// Normalizador de texto para facilitar matching
export const normalizeText = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

// Extração de entidades
export const extractEntities = (rawText) => {
    const norm = normalizeText(rawText);

    // Extrair Valor monetário (ex: R$ 150,00 ou 150,00 ou 150.50 ou 150)
    let valor = null;
    const valorMatch = rawText.match(/(?:r\$|valor:?|preco:?|por)?\s*(\d+(?:[.,]\d{1,2})?)/i);
    if (valorMatch) {
        // Ignora se for ano como 2026 ou número isolado no início de comando
        const num = parseFloat(valorMatch[1].replace(',', '.'));
        if (num > 0 && num !== 2026) {
            valor = num;
        }
    }

    // Extrair WhatsApp / Telefone
    let whatsapp = null;
    const phoneMatch = rawText.match(/(?:whats(?:app)?|tel(?:efone)?|cel(?:ular)?|fone)?\s*:?\s*(\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4})/i);
    if (phoneMatch) {
        whatsapp = phoneMatch[1].trim();
    }

    // Extrair Marca
    let marca = null;
    if (norm.includes('natura')) marca = 'Natura';
    else if (norm.includes('boticario') || norm.includes('o boticario')) marca = 'Boticário';
    else if (norm.includes('avon')) marca = 'Avon';
    else if (norm.includes('eudora')) marca = 'Eudora';

    // Extrair Parcelas
    let parcelas = '1x';
    const parcelasMatch = norm.match(/(\d{1,2})\s*(?:x|vezes|parcelas?)/i);
    if (parcelasMatch) {
        parcelas = `${parcelasMatch[1]}x`;
    }

    // Extrair Nome de Cliente / Alvo
    let nomeCliente = null;
    const clienteMatch = rawText.match(/(?:cliente|para|da|do|de)\s+([A-ZÀ-Úa-zà-ú\s]{2,30})(?:,|\.|\s+com|\s+valor|\s+whats|\s+tel|\s+end|\s+marca|\s+produto|$)/i);
    if (clienteMatch) {
        const candidate = clienteMatch[1].trim();
        // Filtrar palavras reservadas
        const stopWords = ['natura', 'avon', 'boticario', 'eudora', 'hoje', 'ontem', 'amanha', 'mes', 'novo', 'nova', 'venda', 'ciclo', 'produto'];
        if (!stopWords.includes(normalizeText(candidate))) {
            nomeCliente = candidate;
        }
    }

    // Extrair Endereço
    let endereco = null;
    const endMatch = rawText.match(/(?:endereco|end|rua|av|avenida)\s*:?\s*([A-Za-z0-9\s,.-]+?)(?:,|\.|\s+whats|\s+tel|$)/i);
    if (endMatch) {
        endereco = endMatch[1].trim();
    }

    return {
        valor,
        whatsapp,
        marca,
        parcelas,
        nomeCliente,
        endereco
    };
};

// Interpretador principal de intenções
export const parseIntent = (text) => {
    if (!text || typeof text !== 'string') {
        return { intent: 'UNKNOWN', entities: {} };
    }

    const norm = normalizeText(text);
    const entities = extractEntities(text);

    // 1. Saudação
    if (/^(oi|ola|olaa|oie|bom dia|boa tarde|boa noite|opa|fala|hello|hey|tudo bem|tudo bom)\b/.test(norm)) {
        return { intent: 'GREETING', entities };
    }

    // 2. Ajuda / Comandos
    if (norm.includes('ajuda') || norm.includes('comandos') || norm.includes('o que voce faz') || norm.includes('como funciona') || norm.includes('menu') || norm === '?') {
        return { intent: 'HELP', entities };
    }

    // 3. Clientes
    // 3.1 Cadastrar / Criar cliente
    if (/^(cadastr|cria|adiciona|inclui|novo|nova)/.test(norm) && norm.includes('cliente')) {
        return { intent: 'CLIENT_CREATE', entities };
    }
    // 3.2 Excluir / Deletar cliente
    if (/(exclui|deleta|remover?|apagar?|cancelar?)\s+(?:o\s+|a\s+)?cliente/.test(norm)) {
        return { intent: 'CLIENT_DELETE', entities };
    }
    // 3.3 Editar / Alterar cliente
    if (/(edita|altera|atualiza|muda)\s+(?:o\s+|a\s+)?cliente/.test(norm) || (norm.includes('cliente') && (norm.includes('mudar') || norm.includes('trocar')))) {
        return { intent: 'CLIENT_UPDATE', entities };
    }
    // 3.4 Buscar cliente específico
    if (norm.startsWith('buscar cliente') || norm.startsWith('procurar cliente') || norm.startsWith('cliente ') || norm.startsWith('dados de') || norm.startsWith('dados da') || norm.startsWith('dados do') || norm.startsWith('whats da') || norm.startsWith('whatsapp da') || norm.startsWith('telefone da') || norm.startsWith('contato de') || norm.startsWith('contato da')) {
        return { intent: 'CLIENT_SEARCH', entities };
    }
    // 3.5 Listar todos os clientes
    if (norm.includes('clientes') && (norm.includes('listar') || norm.includes('todos') || norm.includes('ver') || norm.includes('mostrar') || norm.includes('quantos') || norm === 'clientes')) {
        return { intent: 'CLIENT_LIST', entities };
    }

    // 4. Vendas
    // 4.1 Nova venda / Cadastrar venda
    if (/(nova venda|cadastrar venda|adicionar venda|lancar venda|vender|fiz uma venda|registra(?:r)? venda)/.test(norm)) {
        return { intent: 'SALES_CREATE', entities };
    }
    // 4.2 Marcar venda como paga / Dar baixa
    if (/(marcar.*paga|marcar.*pago|dar baixa|quitar venda|pagou venda|pagou|recebi da|recebi de)/.test(norm)) {
        return { intent: 'SALES_MARK_PAID', entities };
    }
    // 4.3 Excluir venda
    if (/(exclui|deleta|remover?|apagar?|cancelar?)\s+(?:a\s+)?venda/.test(norm)) {
        return { intent: 'SALES_DELETE', entities };
    }
    // 4.4 Vendas Atrasadas / Cobranças urgentes
    if (norm.includes('atrasad') || norm.includes('vencid') || norm.includes('cobrar') || norm.includes('urgente')) {
        return { intent: 'SALES_OVERDUE', entities };
    }
    // 4.5 Vendas de Hoje
    if (norm.includes('vendas') && (norm.includes('hoje') || norm.includes('do dia'))) {
        return { intent: 'SALES_TODAY', entities };
    }
    // 4.6 Vendas Pagas
    if (norm.includes('vendas') && (norm.includes('pagas') || norm.includes('recebidas') || norm.includes('quitadas'))) {
        return { intent: 'SALES_PAID', entities };
    }
    // 4.7 Vendas Pendentes / A Receber
    if ((norm.includes('vendas') && (norm.includes('pendente') || norm.includes('aberto') || norm.includes('fiado'))) || norm.includes('quem me deve') || norm.includes('pendencias')) {
        return { intent: 'SALES_PENDING', entities };
    }
    // 4.8 Vendas de um cliente específico
    if ((norm.includes('vendas') || norm.includes('compras') || norm.includes('pedidos')) && (norm.includes('da ') || norm.includes('do ') || norm.includes('de '))) {
        return { intent: 'SALES_CLIENT', entities };
    }
    // 4.9 Listar Vendas geral
    if (norm.includes('vendas') || norm === 'vendas' || norm.includes('listar vendas')) {
        return { intent: 'SALES_LIST', entities };
    }

    // 5. Financeiro & Saldo
    if (norm.includes('saldo') || norm.includes('financeiro') || norm.includes('quanto tenho') || norm.includes('balanco') || norm.includes('caixa')) {
        return { intent: 'FINANCIAL_SUMMARY', entities };
    }
    if (norm.includes('a receber') || norm.includes('recebiveis') || norm.includes('receitas pendentes')) {
        return { intent: 'FINANCIAL_RECEIVABLES', entities };
    }
    if (norm.includes('a pagar') || norm.includes('despesas') || norm.includes('contas a pagar') || norm.includes('custos')) {
        return { intent: 'FINANCIAL_PAYABLES', entities };
    }

    // 6. Relatórios & DRE & Indicadores
    if (norm.includes('relatorio') || norm.includes('dre') || norm.includes('lucro') || norm.includes('faturamento') || norm.includes('ticket medio') || norm.includes('inadimplencia') || norm.includes('resumo do mes') || norm.includes('indicadores')) {
        return { intent: 'REPORT_SUMMARY', entities };
    }

    // 7. Ciclos / Produtos
    if (/^(cria|cadastr|adiciona|novo)\s+ciclo/.test(norm)) {
        return { intent: 'PRODUCT_CREATE', entities };
    }
    if (norm.includes('ciclos ativos') || norm.includes('ciclos abertos') || norm.includes('ciclo atual')) {
        return { intent: 'PRODUCT_ACTIVE', entities };
    }
    if (norm.includes('ciclo') || norm.includes('produtos') || norm.includes('marcas') || norm.includes('revistas') || norm.includes('catalogos')) {
        return { intent: 'PRODUCT_LIST', entities };
    }

    // 8. Fallback
    return { intent: 'UNKNOWN', entities };
};
