import { parseIntent, normalizeText } from './intentParser';
import { formatters } from './responseFormatter';
import { formatCurrency, parseCurrency, getLocalISODate } from '../../utils/formatters';
import { collection, addDoc, doc, setDoc, deleteDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

// Helper para calcular datas futuras de parcelas
const addMonthsToDate = (dateStr, monthsToAdd) => {
    if (!dateStr) return dateStr;
    const date = new Date(dateStr + 'T00:00:00');
    date.setMonth(date.getMonth() + monthsToAdd);
    const tzoffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzoffset).toISOString().split('T')[0];
};

export const processChatMessage = async (userMessage, contextData) => {
    const { clientes = [], produtos = [], vendas = [], financeiro = [], saldos = [] } = contextData;
    const { intent, entities } = parseIntent(userMessage);

    const todayISO = getLocalISODate();

    try {
        switch (intent) {
            case 'GREETING':
                return formatters.welcomeMessage();

            case 'HELP':
                return formatters.helpMessage();

            // ─────────────────────────────────────────────
            // CLIENTES
            // ─────────────────────────────────────────────
            case 'CLIENT_LIST':
                return formatters.clientList(clientes);

            case 'CLIENT_SEARCH': {
                const target = normalizeText(entities.nomeCliente || userMessage.replace(/buscar cliente|procurar cliente|cliente|dados de|dados da|whats da|telefone da|contato de/gi, ''));
                if (!target) {
                    return { type: 'text', text: '❓ Quem você deseja buscar? Exemplo: *"Buscar cliente Maria"*\n\nOu digite *"Listar clientes"* para ver todos.' };
                }

                const found = clientes.filter(c => normalizeText(c.nome).includes(target));
                if (found.length === 1) {
                    const client = found[0];
                    const clientSales = vendas.filter(v => v.cliente && normalizeText(v.cliente) === normalizeText(client.nome));
                    return formatters.clientDetail(client, clientSales);
                } else if (found.length > 1) {
                    return formatters.clientList(found);
                } else {
                    return { type: 'text', text: `🔍 Não encontrei nenhum cliente com o nome **"${target}"**.\n\nDeseja cadastrar? Digite: *"Cadastrar cliente ${target}, whatsapp (00) 00000-0000"*` };
                }
            }

            case 'CLIENT_CREATE': {
                let name = entities.nomeCliente;
                if (!name) {
                    // Tenta capturar o nome após "cadastrar cliente"
                    const match = userMessage.match(/(?:cadastrar|criar|adicionar|incluir|novo)\s+cliente\s+([^,]+)/i);
                    if (match) name = match[1].trim();
                }

                if (!name) {
                    return { type: 'text', text: '⚠️ Por favor informe o nome do cliente. Exemplo:\n*"Cadastrar cliente Mariana Silva, whatsapp (11) 98765-4321, endereço Rua Flores 100"*' };
                }

                // Verifica se já existe
                const existing = clientes.find(c => normalizeText(c.nome) === normalizeText(name));
                if (existing) {
                    return { type: 'text', text: `⚠️ Já existe um cliente cadastrado com o nome **${existing.nome}** (WhatsApp: ${existing.whatsapp || 'não informado'}).` };
                }

                const newClient = {
                    nome: name,
                    whatsapp: entities.whatsapp || '(00) 00000-0000',
                    endereco: entities.endereco || '',
                    saldo: 'R$ 0,00',
                    timestamp: Date.now()
                };

                const docRef = await addDoc(collection(db, 'clientes'), newClient);

                return {
                    type: 'success',
                    title: '✅ Cliente cadastrado com sucesso!',
                    text: `👤 **Nome:** ${name}\n📱 **WhatsApp:** ${newClient.whatsapp}\n📍 **Endereço:** ${newClient.endereco || 'Não informado'}\n🆔 **ID:** \`${docRef.id.slice(0, 6)}\``
                };
            }

            case 'CLIENT_UPDATE': {
                const target = normalizeText(entities.nomeCliente || '');
                const client = clientes.find(c => target && normalizeText(c.nome).includes(target));

                if (!client) {
                    return { type: 'text', text: '❓ Qual cliente você quer editar? Exemplo:\n*"Editar cliente Maria, whatsapp (11) 99999-8888, endereço Rua Nova 50"*' };
                }

                const updates = {};
                if (entities.whatsapp) updates.whatsapp = entities.whatsapp;
                if (entities.endereco) updates.endereco = entities.endereco;

                if (Object.keys(updates).length === 0) {
                    return { type: 'text', text: `ℹ️ O que você deseja alterar no cliente **${client.nome}**?\nExemplo: *"Mudar whatsapp da ${client.nome} para (11) 98888-7777"*` };
                }

                await setDoc(doc(db, 'clientes', client.id), updates, { merge: true });

                return {
                    type: 'success',
                    title: `✅ Cliente ${client.nome} atualizado!`,
                    text: `${updates.whatsapp ? `📱 Novo WhatsApp: ${updates.whatsapp}\n` : ''}${updates.endereco ? `📍 Novo Endereço: ${updates.endereco}\n` : ''}`
                };
            }

            case 'CLIENT_DELETE': {
                const target = normalizeText(entities.nomeCliente || userMessage.replace(/excluir cliente|deletar cliente|remover cliente|apagar cliente/gi, ''));
                if (!target) {
                    return { type: 'text', text: '❓ Qual cliente você deseja excluir? Exemplo: *"Excluir cliente João"*\n\nVocê também pode digitar *"Listar clientes"*, localizar e pedir a exclusão.' };
                }

                const client = clientes.find(c => normalizeText(c.nome).includes(target));
                if (!client) {
                    return { type: 'text', text: `🔍 Não encontrei o cliente **"${target}"** para exclusão.` };
                }

                return {
                    type: 'confirm',
                    actionId: 'delete_client',
                    targetId: client.id,
                    targetName: client.nome,
                    title: '⚠️ Confirmação de Exclusão',
                    text: `Tem certeza que deseja apagar o cadastro do cliente **${client.nome}**?\nEssa ação não pode ser desfeita.`
                };
            }

            // ─────────────────────────────────────────────
            // VENDAS
            // ─────────────────────────────────────────────
            case 'SALES_LIST':
                return formatters.salesList(vendas.filter(v => v.tipo !== 'PGO'), 'Últimas Vendas');

            case 'SALES_PENDING': {
                const pending = vendas.filter(v => v.status !== 'Pago' && v.tipo !== 'PGO');
                return formatters.salesList(pending, 'Vendas Pendentes / A Receber');
            }

            case 'SALES_PAID': {
                const paid = vendas.filter(v => v.status === 'Pago' && v.tipo !== 'PGO');
                return formatters.salesList(paid, 'Vendas Pagas / Concluídas');
            }

            case 'SALES_TODAY': {
                const todaySales = vendas.filter(v => (v.dataPagamento === todayISO || v.data === todayISO) && v.tipo !== 'PGO');
                return formatters.salesList(todaySales, 'Vendas / Vencimentos de Hoje');
            }

            case 'SALES_OVERDUE': {
                const overdue = vendas.filter(v => v.status !== 'Pago' && v.dataPagamento && v.dataPagamento < todayISO && v.tipo !== 'PGO');
                return formatters.salesList(overdue, '🚨 Cobranças Atrasadas / Vencidas');
            }

            case 'SALES_CLIENT': {
                const target = normalizeText(entities.nomeCliente || userMessage.replace(/vendas da|vendas do|vendas de|compras da|compras do|compras de/gi, ''));
                if (!target) {
                    return { type: 'text', text: '❓ De qual cliente você quer ver as vendas? Exemplo: *"Vendas da Maria"*\n\nOu digite *"Vendas pendentes"*.' };
                }

                const clientSales = vendas.filter(v => v.cliente && normalizeText(v.cliente).includes(target));
                return formatters.salesList(clientSales, `Vendas do cliente "${target}"`);
            }

            case 'SALES_CREATE': {
                let clientName = entities.nomeCliente;
                let valor = entities.valor;
                let marca = entities.marca || 'Natura';
                let parcelas = entities.parcelas || '1x';

                if (!clientName) {
                    return {
                        type: 'text',
                        text: '⚠️ Para cadastrar uma venda, informe o cliente e o valor.\n\n💡 **Exemplo:**\n*"Nova venda para Maria, produto Natura, valor 150,00, parcelas 2x"*\n*"Venda para Carla valor R$ 80,00"*'
                    };
                }

                if (!valor) {
                    return {
                        type: 'text',
                        text: `⚠️ Qual o valor da venda para **${clientName}**?\nExemplo: *"Venda para ${clientName} valor 120,00"*`
                    };
                }

                // Busca se cliente já existe ou associa nome
                const existingClient = clientes.find(c => normalizeText(c.nome) === normalizeText(clientName));
                if (existingClient) clientName = existingClient.nome;

                // Margens padrão por marca
                const defaultPcts = { 'Natura': 65, 'Avon': 30, 'Boticário': 80, 'Eudora': 30, 'Outros': 50 };
                const pct = defaultPcts[marca] || 50;
                const totalFormatted = formatCurrency(valor);
                const custoCalculado = formatCurrency(valor * (pct / 100));

                const numParcelas = parseInt(parcelas.replace('x', '')) || 1;

                if (numParcelas > 1) {
                    // Cria múltiplas parcelas
                    const valorParcelaBase = Math.floor((valor / numParcelas) * 100) / 100;
                    const valorPrimeira = (valor - (valorParcelaBase * (numParcelas - 1))).toFixed(2);
                    const custoParcelaBase = Math.floor(((valor * (pct / 100)) / numParcelas) * 100) / 100;
                    const custoPrimeira = ((valor * (pct / 100)) - (custoParcelaBase * (numParcelas - 1))).toFixed(2);

                    const batch = writeBatch(db);

                    for (let i = 1; i <= numParcelas; i++) {
                        const isFirst = i === 1;
                        const vParcela = isFirst ? parseFloat(valorPrimeira) : valorParcelaBase;
                        const cParcela = isFirst ? parseFloat(custoPrimeira) : custoParcelaBase;
                        const dataVenc = addMonthsToDate(todayISO, i - 1);

                        const saleRef = doc(collection(db, 'vendas'));
                        const payloadVenda = {
                            tipo: 'Venda',
                            cliente: clientName,
                            produtoDesc: `${marca} (Parcela ${i}/${numParcelas})`,
                            marca: marca,
                            total: formatCurrency(vParcela),
                            custo: formatCurrency(cParcela),
                            formaPagamento: 'Parcelamento',
                            parcelas: parcelas,
                            data: todayISO,
                            dataPagamento: dataVenc,
                            dataEntrega: todayISO,
                            status: 'Pendente',
                            timestamp: Date.now() + i
                        };
                        batch.set(saleRef, payloadVenda);

                        // Registro Financeiro
                        const finRef = doc(collection(db, 'financeiro'));
                        batch.set(finRef, {
                            ref: `Venda ${saleRef.id.slice(0, 4)} - ${clientName}`,
                            marca: marca,
                            tipo: 'Receita',
                            valor: formatCurrency(vParcela),
                            vencimento: dataVenc ? dataVenc.split('-').reverse().join('/') : '',
                            status: 'Pendente',
                            timestamp: Date.now() + i
                        });
                    }

                    await batch.commit();

                    return {
                        type: 'success',
                        title: '✅ Venda Parcelada Lançada!',
                        text: `👤 **Cliente:** ${clientName}\n🏷️ **Marca:** ${marca}\n💰 **Total:** ${totalFormatted} (${parcelas})\n📦 **Parcelas criadas:** ${numParcelas}x de ~${formatCurrency(valor / numParcelas)}\n⏳ **1º Vencimento:** ${formatDateForDisplay(todayISO)}`
                    };
                } else {
                    // Venda à vista / 1 parcela
                    const saleRef = await addDoc(collection(db, 'vendas'), {
                        tipo: 'Venda',
                        cliente: clientName,
                        produtoDesc: marca,
                        marca: marca,
                        total: totalFormatted,
                        custo: custoCalculado,
                        formaPagamento: 'Pix',
                        parcelas: '1x',
                        data: todayISO,
                        dataPagamento: todayISO,
                        dataEntrega: todayISO,
                        status: 'Pendente',
                        timestamp: Date.now()
                    });

                    // Lançamento em Financeiro
                    await addDoc(collection(db, 'financeiro'), {
                        ref: `Venda ${saleRef.id.slice(0, 4)} - ${clientName}`,
                        marca: marca,
                        tipo: 'Receita',
                        valor: totalFormatted,
                        vencimento: todayISO.split('-').reverse().join('/'),
                        status: 'Pendente',
                        timestamp: Date.now()
                    });

                    return {
                        type: 'success',
                        title: '✅ Venda Registrada!',
                        text: `👤 **Cliente:** ${clientName}\n🏷️ **Marca:** ${marca}\n💰 **Valor:** ${totalFormatted}\n📉 **Custo Estimado (${pct}%):** ${custoCalculado}\n✨ **Lucro:** ${formatCurrency(valor - parseCurrency(custoCalculado))}\n⏳ **Status:** Pendente`
                    };
                }
            }

            case 'SALES_MARK_PAID': {
                const target = normalizeText(entities.nomeCliente || userMessage.replace(/marcar venda como paga|marcar como paga|dar baixa na venda|quitar venda|pagou venda|recebi de|recebi da/gi, ''));

                const pendingSales = vendas.filter(v => v.status !== 'Pago' && v.tipo !== 'PGO');
                let targetSale = null;

                if (target) {
                    targetSale = pendingSales.find(v => v.cliente && normalizeText(v.cliente).includes(target));
                } else if (pendingSales.length === 1) {
                    targetSale = pendingSales[0];
                }

                if (!targetSale) {
                    return {
                        type: 'text',
                        text: `❓ De qual cliente você deseja quitar a venda pendente?\n\n💡 Digite: *"Marcar venda da [Nome] como paga"* ou *"Vendas pendentes"* para consultar.`
                    };
                }

                // Atualiza a venda
                await setDoc(doc(db, 'vendas', targetSale.id), {
                    status: 'Pago',
                    dataPago: todayISO
                }, { merge: true });

                // Atualiza lançamento em financeiro correspondente
                const refPrefix = targetSale.id.slice(0, 4);
                const finMatches = financeiro.filter(f => f.ref && f.ref.includes(refPrefix) && f.tipo === 'Receita');
                for (const fin of finMatches) {
                    await setDoc(doc(db, 'financeiro', fin.id), { status: 'Pago' }, { merge: true });
                }

                return {
                    type: 'success',
                    title: '🎉 Venda Marcada como Paga!',
                    text: `👤 **Cliente:** ${targetSale.cliente}\n🏷️ **Produto/Marca:** ${targetSale.produtoDesc || targetSale.marca}\n💰 **Valor:** ${targetSale.total}\n📅 **Data de Pagamento:** ${formatDateForDisplay(todayISO)}`
                };
            }

            case 'SALES_DELETE': {
                const target = normalizeText(entities.nomeCliente || userMessage.replace(/excluir venda|deletar venda|remover venda|apagar venda/gi, ''));
                if (!target) {
                    return { type: 'text', text: '❓ Qual venda você deseja excluir? Diga o nome do cliente ou o ID da venda.' };
                }

                const sale = vendas.find(v => (v.cliente && normalizeText(v.cliente).includes(target)) || v.id.includes(target));
                if (!sale) {
                    return { type: 'text', text: `🔍 Nenhuma venda encontrada para **"${target}"**.` };
                }

                return {
                    type: 'confirm',
                    actionId: 'delete_sale',
                    targetId: sale.id,
                    targetName: `${sale.cliente} (${sale.total})`,
                    title: '⚠️ Confirmação de Exclusão de Venda',
                    text: `Tem certeza que deseja apagar a venda de **${sale.total}** do cliente **${sale.cliente}**?\nO lançamento financeiro vinculado também será excluído.`
                };
            }

            // ─────────────────────────────────────────────
            // FINANCEIRO
            // ─────────────────────────────────────────────
            case 'FINANCIAL_SUMMARY':
            case 'FINANCIAL_RECEIVABLES':
            case 'FINANCIAL_PAYABLES': {
                const realSales = vendas.filter(v => v.tipo !== 'PGO');
                let totalV = 0;
                let totalC = 0;
                let aReceber = 0;
                let aPagar = 0;
                let overdueCount = 0;
                let overdueTotal = 0;

                realSales.forEach(s => {
                    const vTotal = parseCurrency(s.total);
                    const vCusto = parseCurrency(s.custo);
                    totalV += vTotal;
                    totalC += vCusto;

                    if (s.status !== 'Pago') {
                        aReceber += vTotal;
                        if (s.dataPagamento && s.dataPagamento < todayISO) {
                            overdueCount++;
                            overdueTotal += vTotal;
                        }
                    }
                });

                financeiro.forEach(f => {
                    if (f.tipo === 'Despesa' && f.status !== 'Pago') {
                        aPagar += parseCurrency(f.valor);
                    }
                });

                const summary = {
                    totalVendas: totalV,
                    totalCusto: totalC,
                    saldoPrevisto: totalV - totalC,
                    aReceber,
                    aPagar,
                    overdueCount,
                    overdueTotal
                };

                return formatters.financialSummary(summary);
            }

            // ─────────────────────────────────────────────
            // RELATÓRIOS & DRE
            // ─────────────────────────────────────────────
            case 'REPORT_SUMMARY': {
                const realSales = vendas.filter(v => v.tipo !== 'PGO');
                const receitaBruta = realSales.reduce((acc, s) => acc + parseCurrency(s.total), 0);
                const cmv = realSales.reduce((acc, s) => acc + parseCurrency(s.custo), 0);
                const lucroBruto = receitaBruta - cmv;
                const margemBruta = receitaBruta > 0 ? ((lucroBruto / receitaBruta) * 100).toFixed(1) : 0;

                const faturamentoRealizado = realSales.filter(s => s.status === 'Pago').reduce((acc, s) => acc + parseCurrency(s.total), 0) +
                    saldos.reduce((acc, s) => acc + parseCurrency(s.valor), 0);

                const contasAReceber = realSales.filter(s => s.status !== 'Pago').reduce((acc, s) => acc + parseCurrency(s.total), 0);
                const qtdVendas = realSales.length;
                const ticketMedio = qtdVendas > 0 ? (receitaBruta / qtdVendas) : 0;
                const inadimplencia = receitaBruta > 0 ? ((contasAReceber / receitaBruta) * 100).toFixed(1) : 0;

                const dre = {
                    periodo: 'Geral / 2026',
                    receitaBruta,
                    cmv,
                    lucroBruto,
                    margemBruta,
                    faturamentoRealizado,
                    contasAReceber,
                    qtdVendas,
                    ticketMedio,
                    inadimplencia
                };

                return formatters.reportSummary(dre);
            }

            // ─────────────────────────────────────────────
            // PRODUTOS & CICLOS
            // ─────────────────────────────────────────────
            case 'PRODUCT_LIST':
            case 'PRODUCT_ACTIVE': {
                if (intent === 'PRODUCT_ACTIVE') {
                    const active = produtos.filter(p => !p.dataFim || p.dataFim >= todayISO);
                    return formatters.productList(active);
                }
                return formatters.productList(produtos);
            }

            case 'PRODUCT_CREATE': {
                let name = null;
                const matchName = userMessage.match(/(?:ciclo|produto)\s+([A-Za-z0-9\s/_-]+?)(?:,|\.|\s+marca|$)/i);
                if (matchName) name = matchName[1].trim();

                const marca = entities.marca || 'Natura';

                if (!name) {
                    return {
                        type: 'text',
                        text: '⚠️ Para cadastrar um ciclo, informe o nome e a marca. Exemplo:\n*"Criar ciclo Ciclo 06/2026, marca Natura, inicio 2026-03-01, fim 2026-03-25"*'
                    };
                }

                const newCycle = {
                    nome: name,
                    marca: marca,
                    preco: '',
                    custo: '',
                    porcentagem: marca === 'Boticário' ? '80' : '50',
                    estoque: 0,
                    dataInicio: todayISO,
                    dataFim: addMonthsToDate(todayISO, 1),
                    timestamp: Date.now()
                };

                await addDoc(collection(db, 'produtos'), newCycle);

                return {
                    type: 'success',
                    title: '✅ Ciclo cadastrado!',
                    text: `📦 **Ciclo:** ${name}\n🏷️ **Marca:** ${marca}\n📅 **Vigência:** ${formatDateForDisplay(newCycle.dataInicio)} até ${formatDateForDisplay(newCycle.dataFim)}`
                };
            }

            // ─────────────────────────────────────────────
            // FALLBACK AMIGÁVEL
            // ─────────────────────────────────────────────
            default:
                return {
                    type: 'text',
                    text: `🤔 Não compreendi totalmente o que você precisa.\n\n💡 **Tente dizer algo como:**\n- *"Listar clientes"* ou *"Buscar cliente Maria"*\n- *"Vendas pendentes"* ou *"Vendas de hoje"*\n- *"Cadastrar cliente Ana, whats (11) 98888-7777"*\n- *"Saldo financeiro"* ou *"Quanto tenho a receber?"*\n- *"Ajuda"* para ver todos os comandos.`
                };
        }
    } catch (err) {
        console.error('Erro ao processar mensagem no ChatEngine:', err);
        return {
            type: 'error',
            title: '❌ Ocorreu um erro ao processar sua solicitação',
            text: err.message || 'Verifique sua conexão e tente novamente.'
        };
    }
};

// Executor de ações confirmadas pelo usuário
export const executeConfirmedAction = async (actionId, targetId, contextData) => {
    const { financeiro = [], vendas = [] } = contextData;
    try {
        if (actionId === 'delete_client') {
            await deleteDoc(doc(db, 'clientes', targetId));
            return {
                type: 'success',
                title: '🗑️ Cliente excluído!',
                text: 'O cadastro do cliente foi removido do sistema com sucesso.'
            };
        }

        if (actionId === 'delete_sale') {
            await deleteDoc(doc(db, 'vendas', targetId));

            // Exclusão em cascata no financeiro
            const refPrefix = targetId.slice(0, 4);
            const finMatches = financeiro.filter(f => f.ref && f.ref.includes(refPrefix));
            const batch = writeBatch(db);
            finMatches.forEach(f => {
                batch.delete(doc(db, 'financeiro', f.id));
            });
            if (finMatches.length > 0) {
                await batch.commit();
            }

            return {
                type: 'success',
                title: '🗑️ Venda excluída!',
                text: 'A venda e os lançamentos financeiros vinculados foram removidos.'
            };
        }

        return { type: 'error', text: 'Ação não reconhecida.' };
    } catch (err) {
        console.error('Erro ao executar ação confirmada:', err);
        return {
            type: 'error',
            title: '❌ Falha ao executar ação',
            text: err.message
        };
    }
};
