import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { formatCurrency, parseCurrency, getLocalISODate } from '../utils/formatters';
import { CloudArrowUp, ArrowDown, ArrowUp } from 'phosphor-react';
import { doc, updateDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import GlassCard from '../components/GlassCard';

const Finance = () => {
    const { financeiro, vendas, loading } = useData();

    // Filters
    const [tipoFilter, setTipoFilter] = useState('all');   // all | Receita | Despesa
    const [statusFilter] = useState('all');
    const [periodo, setPeriodo] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });

    // Valid Periods logic
    const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];
    const parseDateHelper = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return null;
        let parts = dateStr.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        parts = dateStr.split('-');
        if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
        return null;
    };

    const availableMonths = Array.from(new Set([
        ...safeFinanceiro.map(f => {
            const d = parseDateHelper(f.vencimento);
            if (!d) return null;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }).filter(Boolean),
        '2026-03', '2026-02', '2026-01' // Ensure these exist
    ])).sort().reverse();

    // Filtering Logic
    const filteredItems = safeFinanceiro.filter(f => {
        // 1. Period
        if (periodo !== 'all') {
            const d = parseDateHelper(f.vencimento);
            if (!d) return false;
            const [y, m] = periodo.split('-');
            if (d.getFullYear() !== parseInt(y) || d.getMonth() !== parseInt(m) - 1) return false;
        }
        // 2. Type
        if (tipoFilter !== 'all' && f.tipo !== tipoFilter) return false;
        // 3. Status
        if (statusFilter !== 'all' && f.status !== statusFilter) return false;

        return true;
    }).sort((a, b) => {
        const da = parseDateHelper(a.vencimento);
        const db = parseDateHelper(b.vencimento);
        return (db || 0) - (da || 0); // Descending date
    });

    // Totals
    const totalReceitas = filteredItems
        .filter(f => f.tipo === 'Receita')
        .reduce((acc, curr) => acc + parseCurrency(curr.valor), 0);

    const totalDespesas = filteredItems
        .filter(f => f.tipo === 'Despesa')
        .reduce((acc, curr) => acc + parseCurrency(curr.valor), 0);

    const saldo = totalReceitas - totalDespesas;


    // Actions
    const handleToggleStatus = async (item) => {
        const newStatus = item.status === 'Pago' ? 'Pendente' : 'Pago';
        try {
            await updateDoc(doc(db, 'financeiro', item.id), { status: newStatus });
        } catch (e) { alert('Erro: ' + e.message); }
    };

    const handleSync = async () => {
        if (!window.confirm("Sincronizar financeiro com vendas? Isso criará registros faltantes.")) return;
        try {
            const batch = writeBatch(db);
            let count = 0;

            vendas.forEach(v => {
                const prefix = v.id.slice(0, 4);
                const exists = financeiro.some(f => f.ref && f.ref.includes(prefix));
                if (!exists) {
                    // Prioridade: dataPagamento → converter data (DD/MM/YYYY) → hoje
                    let vencimento = v.dataPagamento;
                    if (!vencimento && v.data) {
                        const parts = v.data.split('/');
                        if (parts.length === 3) {
                            vencimento = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        }
                    }
                    vencimento = vencimento || getLocalISODate();

                    const ref = doc(collection(db, "financeiro"));
                    batch.set(ref, {
                        tipo: 'Receita',
                        categoria: 'Venda de Produtos',
                        descricao: `Venda - ${v.cliente}`,
                        ref: `Venda ${prefix} - ${v.cliente}`,
                        valor: v.total,
                        vencimento: vencimento,
                        status: 'Pendente',
                        marca: v.marca || 'Natura'
                    });
                    count++;
                }
            });
            if (count > 0) await batch.commit();
            alert(`Sincronizado! ${count} registros criados.`);
        } catch (e) {
            alert("Erro sync: " + e.message);
        }
    };

    if (loading) return <div className="text-center text-brand-orange mt-10 animate-pulse">Carregando...</div>;

    return (
        <div className="pb-24 space-y-4">
            {/* Header / Filter */}
            <div className="sticky top-0 z-40 bg-light-bg/95 backdrop-blur-sm pt-2 pb-2 flex justify-between items-center">
                <select
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="bg-light-surface border border-brand-brown/30 rounded-lg px-3 py-1.5 text-sm text-light-text focus:outline-none"
                >
                    <option value="all">Todo o Período</option>
                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                <div className="flex gap-2">
                    <button onClick={handleSync} className="p-2 rounded-xl bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20">
                        <CloudArrowUp size={20} weight="bold" />
                    </button>
                </div>
            </div>

            {/* Summary Cards (Horizontal Scroll) */}
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x">
                <GlassCard className="min-w-[140px] shrink-0 snap-start bg-linear-to-br from-brand-orange/20 to-brand-orange/5 border-brand-orange/20">
                    <p className="text-[10px] text-light-muted mb-1">Saldo</p>
                    <p className="text-lg font-bold text-light-text">{formatCurrency(saldo)}</p>
                </GlassCard>
                <GlassCard className="min-w-[140px] shrink-0 snap-start">
                    <div className="flex items-center gap-1 mb-1">
                        <ArrowUp size={12} className="text-brand-green" weight="bold" />
                        <p className="text-[10px] text-light-muted">Receitas</p>
                    </div>
                    <p className="text-lg font-bold text-brand-green">{formatCurrency(totalReceitas)}</p>
                </GlassCard>
                <GlassCard className="min-w-[140px] shrink-0 snap-start">
                    <div className="flex items-center gap-1 mb-1">
                        <ArrowDown size={12} className="text-brand-yellow" weight="bold" />
                        <p className="text-[10px] text-light-muted">Despesas</p>
                    </div>
                    <p className="text-lg font-bold text-brand-yellow">{formatCurrency(totalDespesas)}</p>
                </GlassCard>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 justify-center">
                {['all', 'Receita', 'Despesa'].map(type => (
                    <button
                        key={type}
                        onClick={() => setTipoFilter(type)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${tipoFilter === type
                            ? (type === 'Despesa' ? 'bg-brand-yellow/20 border-brand-yellow text-brand-yellow' : 'bg-brand-green/20 border-brand-green text-brand-green')
                            : 'bg-light-surface border-brand-brown/30 text-light-muted'
                            }`}
                    >
                        {type === 'all' ? 'Todos' : type}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="space-y-3">
                {filteredItems.map(item => (
                    <GlassCard
                        key={item.id}
                        className={`relative p-3! border flex justify-between items-center ${item.status === 'Pago' ? 'opacity-60 grayscale-[0.5]' : ''
                            } border-white/5 active:scale-[0.99] transition-transform`}
                        onClick={() => handleToggleStatus(item)}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${item.tipo === 'Receita' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-yellow/10 text-brand-yellow'}`}>
                                {item.tipo === 'Receita' ? <ArrowUp size={16} weight="bold" /> : <ArrowDown size={16} weight="bold" />}
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-dark-text max-w-[150px] truncate">{item.descricao || item.ref}</h3>
                                <div className="text-[10px] text-light-muted flex gap-2">
                                    <span>{formatCurrency(item.valor)}</span>
                                    <span>•</span>
                                    <span>{item.vencimento}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className={`text-xs font-bold ${item.tipo === 'Receita' ? 'text-brand-green' : 'text-brand-yellow'}`}>
                                {item.tipo === 'Receita' ? '+' : '-'}{formatCurrency(item.valor)}
                            </div>
                        </div>
                    </GlassCard>
                ))}
                {filteredItems.length === 0 && (
                    <div className="text-center py-10 text-light-muted">
                        Nenhum registro no período.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Finance;
