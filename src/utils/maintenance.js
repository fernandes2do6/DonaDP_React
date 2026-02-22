import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { parseCurrency } from './formatters';

export const exportBackupGeral = async () => {
    try {
        const collections = ['clientes', 'produtos', 'vendas', 'financeiro'];
        const backupData = {};

        for (const colName of collections) {
            const snap = await getDocs(collection(db, colName));
            backupData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log(`Backup: Fetched ${snap.size} from ${colName}`);
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "backup_dona_dp_" + new Date().toISOString().split('T')[0] + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        alert("Backup gerado com sucesso!");
    } catch (e) {
        console.error(e);
        alert("Erro ao gerar backup: " + e.message);
    }
};

export const repairFinanceiro = async () => {
    if (!window.confirm("Isso vai verificar todas as vendas e garantir que existem registros no financeiro. Continuar?")) return;

    try {
        const vendasSnap = await getDocs(collection(db, "vendas"));
        const financeiroSnap = await getDocs(collection(db, "financeiro"));

        const vendas = vendasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const financeiro = financeiroSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        let fixedCount = 0;
        const batch = writeBatch(db); // Note: batch limit is 500 ops. For large datasets, split.
        // For simplicity/safety in this migration, we'll do one by one or warn.
        // Actually let's use batch but carefully.

        for (const v of vendas) {
            // Check Receita
            const hasReceita = financeiro.some(f => f.ref && f.ref.includes(v.id.slice(0, 4)) && f.tipo === 'Receita');
            if (!hasReceita) {
                const newRef = doc(collection(db, "financeiro"));
                batch.set(newRef, {
                    ref: `Venda ${v.id.slice(0, 4)} - ${v.cliente}`,
                    marca: v.marca || 'Natura',
                    tipo: 'Receita',
                    valor: v.total,
                    vencimento: v.dataPagamento ? v.dataPagamento.split('-').reverse().join('/') : (v.data || ''),
                    status: 'Pendente',
                    timestamp: Date.now()
                });
                fixedCount++;
            }

            // Check Despesa (if cost exists)
            if (v.custo && parseCurrency(v.custo) > 0) {
                const hasDespesa = financeiro.some(f => f.ref && f.ref.includes(v.id.slice(0, 4)) && f.tipo === 'Despesa');
                if (!hasDespesa) {
                    const newRef = doc(collection(db, "financeiro"));
                    batch.set(newRef, {
                        ref: `Custo Venda ${v.id.slice(0, 4)}`,
                        marca: v.marca || 'Natura',
                        tipo: 'Despesa',
                        valor: v.custo,
                        vencimento: v.dataEntrega ? v.dataEntrega.split('-').reverse().join('/') : (v.data || ''),
                        status: 'Pendente',
                        timestamp: Date.now() + 1
                    });
                    fixedCount++;
                }
            }
        }

        if (fixedCount > 0) {
            await batch.commit();
            alert(`Correção finalizada! ${fixedCount} registros financeiros foram recriados.`);
            window.location.reload();
        } else {
            alert("Tudo parece estar correto!");
        }

    } catch (e) {
        console.error(e);
        alert("Erro na correção: " + e.message);
    }
};
