import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { parseCurrency } from './formatters';
import Papa from 'papaparse';

// --- EXPORT CONFIG ---

const EXPORT_COLUMNS = {
    clientes: [
        { header: 'Nome do Cliente', key: 'nome' },
        { header: 'WhatsApp', key: 'whatsapp' },
        { header: 'Endereço', key: 'endereco' }
    ],
    vendas: [
        { header: 'Cliente', key: 'cliente' },
        { header: 'Produto', key: 'produtoDesc' },
        { header: 'Valor', key: 'total' },
        { header: 'Custo', key: 'custo' },
        { header: 'Data', key: 'data' },
        { header: 'Previsão Pgto', key: 'dataPagamento' },
        { header: 'Forma de Pagamento', key: 'formaPagamento' },
        { header: 'Marca', key: 'marca' },
        { header: 'Tipo', key: 'tipo' }
    ]
};

// --- EXPORT ---

export const exportToCSV = (data, filename, type) => {
    if (!data || !data.length) {
        alert("Nada para exportar!");
        return;
    }

    let headers = [];
    let keys = [];

    if (type && EXPORT_COLUMNS[type]) {
        // Use strict columns
        headers = EXPORT_COLUMNS[type].map(c => c.header);
        keys = EXPORT_COLUMNS[type].map(c => c.key);
    } else {
        // Fallback: Get headers from first object keys
        const allKeys = new Set();
        data.forEach(item => Object.keys(item).forEach(k => allKeys.add(k)));
        keys = Array.from(allKeys);
        headers = keys;
    }

    // Create CSV Content
    const csvRows = [];
    csvRows.push(headers.join(',')); // Header row

    for (const row of data) {
        const values = keys.map(key => {
            let val = row[key];
            if (val === null || val === undefined) val = "";

            // Format specific fields if needed
            if (key === 'total' || key === 'custo') {
                // Keep raw number or formatted? keeping as is usually is safer for Excel if dot/comma matching
                // But user might want "R$". Let's clean it to be safe string.
            }

            val = val.toString().replace(/"/g, '""');
            if (val.search(/("|,|\n)/g) >= 0) {
                val = `"${val}"`;
            }
            return val;
        });
        csvRows.push(values.join(','));
    }

    const csvContent = "\uFEFF" + csvRows.join('\n'); // Add BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename || "export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- IMPORT HELPER ---

const cleanKey = (key) => {
    // Aggressive cleaning to match database keys
    return String(key).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, ""); // remove spaces and non-alphanumeric
};

// --- IMPORT ---

export const processImport = (file, type) => {
    if (!file) return;

    // Use PapaParse with AUTO detection (best for unknown CSVs)
    Papa.parse(file, {
        header: true,             // Expect headers
        skipEmptyLines: true,     // Skip proper empty lines
        chunkSize: 1024 * 1024,   // 1MB chunks (safety)
        complete: async (results) => {
            try {
                let rows = results.data;
                console.log("Linhas Brutas (PapaParse):", rows);

                if (!rows || rows.length === 0) {
                    alert("O arquivo parece vazio.");
                    return;
                }

                // 1. Identify Mapping based on the FIRST row's keys
                // We do this once to avoid re-calcing for every row
                const rawHeaders = Object.keys(rows[0]);
                console.log("Cabeçalhos detectados:", rawHeaders);

                const dbKeyMap = {};

                // Define aliases (Source CSV Headers -> Target DB Fields)
                // Separated by type to avoid conflicts (e.g. 'Cliente' header → 'nome' for clients, 'cliente' for sales)
                const clienteDefinitions = [
                    { target: 'nome', aliases: ['nome', 'nomedocliente', 'cliente', 'name', 'n'] },
                    { target: 'whatsapp', aliases: ['whatsapp', 'telefone', 'celular', 'tel', 'zap', 'contato', 'cel'] },
                    { target: 'endereco', aliases: ['endereco', 'rua', 'logradouro', 'address'] },
                ];

                const vendasDefinitions = [
                    { target: 'cliente', aliases: ['cliente', 'nomedocliente', 'nome', 'name'] },
                    { target: 'total', aliases: ['total', 'valor', 'preco', 'venda', 'price', 'amount'] },
                    { target: 'custo', aliases: ['custo', 'custofabrica', 'despesa', 'cost', 'valordecusto'] },
                    { target: 'data', aliases: ['data', 'dia', 'date', 'emissao', 'datavenda'] },
                    { target: 'dataPagamento', aliases: ['previsaopgto', 'datapagamento', 'vencimento', 'pagoem', 'previsao'] },
                    { target: 'produtoDesc', aliases: ['produto', 'produtodesc', 'desc', 'descricao', 'item'] },
                    { target: 'tipo', aliases: ['tipo', 'tipodevenda', 'type'] },
                    { target: 'marca', aliases: ['marca', 'fabricante', 'brand'] },
                    { target: 'formaPagamento', aliases: ['formapagamento', 'forma', 'payment', 'meiopagamento'] },
                ];

                const definitions = type === 'vendas' ? vendasDefinitions : clienteDefinitions;

                // Map Raw Headers -> Target Fields
                rawHeaders.forEach(rawH => {
                    const cleaned = cleanKey(rawH);
                    const def = definitions.find(d => d.aliases.includes(cleaned));
                    if (def) {
                        dbKeyMap[def.target] = rawH; // Store the ORIGINAL key to access data
                    }
                });

                console.log("Mapeamento Final:", dbKeyMap);

                // Check critical columns
                if (type === 'clientes' && !dbKeyMap['nome']) {
                    alert(`Não encontrei a coluna 'Nome' ou 'Cliente'. \nCabeçalhos encontrados: ${rawHeaders.join(', ')}`);
                    return;
                }
                if (type === 'vendas' && (!dbKeyMap['cliente'] || !dbKeyMap['total'])) {
                    alert(`Não encontrei colunas de 'Cliente' ou 'Valor'. \nCabeçalhos encontrados: ${rawHeaders.join(', ')}`);
                    return;
                }

                let successCount = 0;
                let failureCount = 0;

                // 2. Process Rows
                // Use a loop to process imports strictly
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];

                    try {
                        // Construct Object
                        const dbObj = {};

                        // Extract Name (Critical)
                        if (type === 'clientes') {
                            const nameKey = dbKeyMap['nome'];
                            const nameVal = row[nameKey];

                            if (!nameVal || typeof nameVal !== 'string' || nameVal.trim() === '') {
                                console.log(`Skipping row ${i}: Missing Name`, row);
                                failureCount++;
                                continue;
                            }
                            dbObj['nome'] = nameVal.trim();

                            // Optional fields
                            if (dbKeyMap['whatsapp']) dbObj['whatsapp'] = row[dbKeyMap['whatsapp']] || "";
                            if (dbKeyMap['endereco']) dbObj['endereco'] = row[dbKeyMap['endereco']] || "";

                        } else if (type === 'vendas') {
                            // Sales logic...
                            const clientKey = dbKeyMap['cliente'];
                            const totalKey = dbKeyMap['total'];
                            const nameVal = row[clientKey];
                            const totalVal = row[totalKey];

                            if (!nameVal || !totalVal) {
                                console.log(`Skipping sales row ${i}: Missing Client or Total`, row);
                                failureCount++;
                                continue;
                            }

                            dbObj['cliente'] = nameVal.trim();
                            dbObj['total'] = parseCurrency(totalVal);
                            dbObj['tipo'] = (dbKeyMap['tipo'] && row[dbKeyMap['tipo']]) || 'Venda';
                            dbObj['marca'] = (dbKeyMap['marca'] && row[dbKeyMap['marca']]) || 'Natura';
                            dbObj['produtoDesc'] = (dbKeyMap['produtoDesc'] && row[dbKeyMap['produtoDesc']]) || 'Produto diverso';
                            dbObj['formaPagamento'] = (dbKeyMap['formaPagamento'] && row[dbKeyMap['formaPagamento']]) || 'Pix';

                            // Custo
                            if (dbKeyMap['custo']) {
                                const custoRaw = row[dbKeyMap['custo']];
                                dbObj['custo'] = custoRaw ? parseCurrency(custoRaw) : '';
                            }

                            // Dates
                            if (dbKeyMap['data']) {
                                dbObj['data'] = row[dbKeyMap['data']];
                            } else {
                                dbObj['data'] = new Date().toLocaleDateString('pt-BR');
                            }

                            if (dbKeyMap['dataPagamento']) {
                                dbObj['dataPagamento'] = row[dbKeyMap['dataPagamento']];
                            } else {
                                // Default payment date: today (encoded for input compatibility usually YYYY-MM-DD in state, 
                                // but here we follow DB format which seems split between DD/MM/YYYY and ISO depending on field)
                                dbObj['dataPagamento'] = new Date().toISOString().split('T')[0];
                            }

                            // Timestamp is required for the vendas query (orderBy timestamp)
                            dbObj['timestamp'] = Date.now();
                        }

                        // Insert to Firebase
                        const salesRef = await addDoc(collection(db, type === 'vendas' ? "vendas" : "clientes"), dbObj);

                        // IF Vendas, generate Financeiro record
                        if (type === 'vendas') {
                            await addDoc(collection(db, 'financeiro'), {
                                tipo: 'Receita',
                                categoria: 'Venda de Produtos',
                                descricao: `Venda (Importada) - ${dbObj.cliente}`,
                                ref: `Venda ${salesRef.id.slice(0, 4)} - ${dbObj.cliente}`,
                                valor: dbObj.total,
                                vencimento: dbObj.dataPagamento,
                                status: 'Pendente',
                                marca: dbObj.marca,
                                timestamp: Date.now(),
                                imported: true
                            });
                        }
                        successCount++;

                    } catch (rowErr) {
                        console.error(`Error importing row ${i}:`, rowErr);
                        failureCount++;
                    }
                }

                alert(`Processamento finalizado!\nSucesso: ${successCount}\nFalhas/Ignorados: ${failureCount}`);
                if (successCount > 0) window.location.reload();

            } catch (err) {
                console.error("Critical Import Error:", err);
                alert("Erro grave na importação: " + err.message);
            }
        },
        error: (err) => {
            console.error("PapaParse Error:", err);
            alert("Erro ao ler CSV: " + err.message);
        }
    });
};
