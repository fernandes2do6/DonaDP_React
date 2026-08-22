import { formatCurrency, formatDateForDisplay } from '../../utils/formatters';

export const formatters = {
    // Saudação e Boas-Vindas
    welcomeMessage: () => ({
        type: 'text',
        text: `👋 **Olá, Patrícia! Sou sua assistente virtual do Dona D&P.**\n\nVocê pode me pedir para consultar, cadastrar, editar ou apagar informações sobre clientes, vendas, pagamentos, ciclos e financeiro.\n\n💡 **Dicas do que você pode me pedir:**\n- *"Listar clientes"* ou *"Buscar cliente Maria"*\n- *"Cadastrar cliente Carla, whatsapp (11) 98888-7777"*\n- *"Vendas pendentes"* ou *"Vendas de hoje"*\n- *"Nova venda para Carla, produto Natura, valor 150,00"*\n- *"Saldo financeiro"* ou *"Quanto tenho a receber?"*\n- *"Ciclos ativos"* ou *"Resumo do mês"*`
    }),

    helpMessage: () => ({
        type: 'text',
        text: `🤖 **Guia de Comandos e Dicas de Conversa:**\n\n` +
            `👤 **Clientes:**\n` +
            `- \`Listar clientes\` | \`Buscar cliente [nome]\`\n` +
            `- \`Cadastrar cliente [nome], whatsapp [número], endereço [rua]\`\n` +
            `- \`Editar cliente [nome], whatsapp [novo], endereço [novo]\`\n` +
            `- \`Excluir cliente [nome]\`\n\n` +
            `🛒 **Vendas:**\n` +
            `- \`Vendas pendentes\` | \`Vendas pagas\` | \`Vendas de hoje\` | \`Vendas atrasadas\`\n` +
            `- \`Vendas da [cliente]\`\n` +
            `- \`Nova venda para [cliente], produto [nome], marca [Natura/Avon/etc], valor [R$], parcelas [2x]\`\n` +
            `- \`Marcar venda da [cliente] como paga\`\n` +
            `- \`Excluir venda [id ou cliente]\`\n\n` +
            `💰 **Financeiro & Relatórios:**\n` +
            `- \`Saldo financeiro\` | \`Quanto tenho a receber?\` | \`A pagar\`\n` +
            `- \`Despesas pendentes\` | \`Receitas de hoje\`\n` +
            `- \`Resumo do mês\` | \`Lucro do mês\` | \`DRE\`\n\n` +
            `📦 **Ciclos & Produtos:**\n` +
            `- \`Listar ciclos\` | \`Ciclos ativos\` | \`Ciclos da Natura\`\n` +
            `- \`Criar ciclo [nome], marca [marca], inicio [data], fim [data]\``
    }),

    // Clientes
    clientList: (clients) => {
        if (!clients || clients.length === 0) {
            return { type: 'text', text: '🔍 Nenhum cliente encontrado.' };
        }
        return {
            type: 'client_list',
            text: `📋 Encontrei **${clients.length} cliente(s)**:`,
            items: clients.map(c => ({
                id: c.id,
                nome: c.nome || 'Sem nome',
                whatsapp: c.whatsapp || 'Não informado',
                endereco: c.endereco || '',
                saldo: c.saldo || 'R$ 0,00'
            }))
        };
    },

    clientDetail: (client, sales = []) => {
        const totalVendas = sales.reduce((acc, s) => acc + (s.total ? Number(s.total.replace(/[^\d,]/g, '').replace(',', '.')) || 0 : 0), 0);
        const pendentes = sales.filter(s => s.status !== 'Pago');
        return {
            type: 'card',
            title: `👤 ${client.nome}`,
            text: `📱 **WhatsApp:** ${client.whatsapp || 'Não informado'}\n` +
                `📍 **Endereço:** ${client.endereco || 'Não informado'}\n` +
                `🛍️ **Histórico:** ${sales.length} venda(s) registrada(s) (Total: ${formatCurrency(totalVendas)})\n` +
                `⏳ **Vendas Pendentes:** ${pendentes.length} pendência(s)`
        };
    },

    // Vendas
    salesList: (sales, filterTitle = 'Vendas encontradas') => {
        if (!sales || sales.length === 0) {
            return { type: 'text', text: `🔍 Nenhuma venda encontrada para o filtro solicitado.` };
        }
        return {
            type: 'sales_list',
            text: `🛒 **${filterTitle} (${sales.length}):**`,
            items: sales.slice(0, 15).map(s => ({
                id: s.id,
                cliente: s.cliente || 'Sem cliente',
                produto: s.produtoDesc || s.marca || 'Produto',
                marca: s.marca || '',
                total: s.total || 'R$ 0,00',
                status: s.status || 'Pendente',
                data: s.dataPagamento ? formatDateForDisplay(s.dataPagamento) : (s.data || ''),
                isPgo: s.tipo === 'PGO'
            })),
            hasMore: sales.length > 15 ? sales.length - 15 : 0
        };
    },

    // Financeiro
    financialSummary: (summary) => {
        return {
            type: 'card',
            title: '💰 Resumo Financeiro Atual',
            text: `📈 **Total Vendas:** ${formatCurrency(summary.totalVendas)}\n` +
                `📉 **Total Custos:** ${formatCurrency(summary.totalCusto)}\n` +
                `✨ **Lucro Previsto:** ${formatCurrency(summary.saldoPrevisto)}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `⏳ **A Receber (Pendentes):** ${formatCurrency(summary.aReceber)}\n` +
                `💸 **A Pagar:** ${formatCurrency(summary.aPagar)}\n` +
                `🚨 **Cobranças Atrasadas:** ${summary.overdueCount} venda(s) (${formatCurrency(summary.overdueTotal)})`
        };
    },

    // Relatórios / DRE
    reportSummary: (dre) => {
        return {
            type: 'card',
            title: `📊 DRE & Indicadores (${dre.periodo})`,
            text: `💵 **Receita Bruta:** ${formatCurrency(dre.receitaBruta)}\n` +
                `📦 **CMV (Custo Mercadorias):** ${formatCurrency(dre.cmv)}\n` +
                `🎯 **Lucro Bruto:** ${formatCurrency(dre.lucroBruto)} (Margem: ${dre.margemBruta}%)\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🏦 **Faturamento Realizado (Caixa):** ${formatCurrency(dre.faturamentoRealizado)}\n` +
                `⏳ **Contas a Receber (Pendente):** ${formatCurrency(dre.contasAReceber)}\n` +
                `🛒 **Qtd. Vendas:** ${dre.qtdVendas} | **Ticket Médio:** ${formatCurrency(dre.ticketMedio)}\n` +
                `⚠️ **Inadimplência:** ${dre.inadimplencia}%`
        };
    },

    // Produtos / Ciclos
    productList: (products) => {
        if (!products || products.length === 0) {
            return { type: 'text', text: '🔍 Nenhum ciclo/produto encontrado.' };
        }
        return {
            type: 'product_list',
            text: `📦 Encontrei **${products.length} ciclo(s)/marca(s)**:`,
            items: products.slice(0, 15).map(p => ({
                id: p.id,
                nome: p.nome || 'Sem nome',
                marca: p.marca || 'Geral',
                inicio: p.dataInicio ? formatDateForDisplay(p.dataInicio) : '',
                fim: p.dataFim ? formatDateForDisplay(p.dataFim) : '',
                porcentagem: p.porcentagem ? `${p.porcentagem}%` : '',
                custo: p.custo || ''
            })),
            hasMore: products.length > 15 ? products.length - 15 : 0
        };
    }
};
