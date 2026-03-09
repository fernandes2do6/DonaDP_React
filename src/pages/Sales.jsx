import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { parseCurrency, formatCurrency, formatDateForDisplay } from '../utils/formatters';
import { Plus, MagnifyingGlass, Trash, PencilSimple, WhatsappLogo, Funnel, X, CheckCircle, FileArrowUp, FileArrowDown, ListChecks } from 'phosphor-react';
import Modal from '../components/Modal';
import SalesForm from '../components/SalesForm';
import { exportToCSV, processImport } from '../utils/exportImport';
import { doc, deleteDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import GlassCard from '../components/GlassCard';

const Sales = () => {
    const { vendas, financeiro, loading } = useData(); // pgos, clients not strictly needed for list view unless PGO linking logic
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState(null);
    const [selectedSales, setSelectedSales] = useState(new Set());

    // Filter State
    const [filterType, setFilterType] = useState('all'); // all, Venda, PGO
    const [periodo, setPeriodo] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });

    // Date parsing helper (DD/MM/YYYY or YYYY-MM-DD)
    const parseDateHelper = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return null;
        let parts = dateStr.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        parts = dateStr.split('-');
        if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
        return null;
    };

    // Available months from actual sales data
    const availableMonths = Array.from(new Set(
        vendas.map(v => {
            const d = parseDateHelper(v.data);
            if (!d) return null;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }).filter(Boolean)
    )).sort().reverse();

    const filteredVendas = vendas.filter(v => {
        const cText = (v.cliente || '').toString().toLowerCase();
        const dText = (v.produtoDesc || '').toString().toLowerCase();
        const sText = searchTerm.toLowerCase();

        const matchesSearch = cText.includes(sText) || dText.includes(sText);

        // Period filter: vendas sem data sempre aparecem
        if (periodo !== 'all') {
            const d = parseDateHelper(v.data);
            if (d) {
                const [y, m] = periodo.split('-');
                if (d.getFullYear() !== parseInt(y) || d.getMonth() !== parseInt(m) - 1) return false;
            }
            // se d é null (sem data), mostra em qualquer período
        }

        const type = v.tipo || 'Venda';
        if (filterType === 'all') return matchesSearch;
        if (filterType === 'PAGO') return matchesSearch && type !== 'PGO' && v.status === 'Pago';
        if (filterType === 'PENDENTE') return matchesSearch && type !== 'PGO' && v.status !== 'Pago';
        return matchesSearch && type === filterType;
    });

    if (filterType === 'PAGO' || filterType === 'PENDENTE') {
        filteredVendas.sort((a, b) => {
            const nameA = (a.cliente || '').toString().toLowerCase();
            const nameB = (b.cliente || '').toString().toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    // Total das vendas filtradas
    const totalVendas = filteredVendas.reduce((acc, v) => {
        if (v.tipo === 'PGO') {
            const linkedSales = vendas.filter(s => s.pgoId === v.id);
            const aggCost = linkedSales.reduce((a, s) => a + parseCurrency(s.custo), 0);
            return acc + (aggCost > 0 ? aggCost : parseCurrency(v.total));
        }
        return acc + parseCurrency(v.total);
    }, 0);
    const totalCusto = filteredVendas.reduce((acc, v) => acc + parseCurrency(v.custo), 0);
    const totalLucro = filterType === 'PGO' ? 0 : totalVendas - totalCusto;

    // --- ACTIONS ---
    const openNewSale = () => { setEditingSale(null); setIsModalOpen(true); };
    const openEditSale = (sale) => { setEditingSale(sale); setIsModalOpen(true); };

    // Delete Logic (Cascade)
    const cascadeDeleteFinanceiro = async (vendaId) => {
        if (!vendaId || typeof vendaId !== 'string') return;
        const prefix = vendaId.slice(0, 4);
        const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];
        const linked = safeFinanceiro.filter(f => f && f.ref && typeof f.ref === 'string' && f.ref.includes(prefix));
        
        for (const f of linked) {
            try {
                await deleteDoc(doc(db, 'financeiro', f.id));
            } catch (err) {
                console.error("Erro ao apagar financeiro vinculado:", err);
            }
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        console.log("Attempting to delete sale with ID:", id);
        if (window.confirm('Tem certeza que deseja apagar esta venda?')) {
            try {
                // Tenta apagar o financeiro, mas não bloqueia se der erro parcial
                await cascadeDeleteFinanceiro(id);
            } catch (error) {
                console.error("Error in cascade: ", error);
            }

            try {
                await deleteDoc(doc(db, 'vendas', id));
            } catch (error) {
                console.error("Sale delete error:", error);
                alert('Erro na exclusão da venda: ' + error.message);
            }
        }
    };

    // Selection Logic
    const toggleSaleSelection = (saleId) => {
        const newSelected = new Set(selectedSales);
        if (newSelected.has(saleId)) newSelected.delete(saleId);
        else newSelected.add(saleId);
        setSelectedSales(newSelected);
    };

    const allSelected = filteredVendas.length > 0 && filteredVendas.every(v => selectedSales.has(v.id));
    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedSales(new Set());
        } else {
            setSelectedSales(new Set(filteredVendas.map(v => v.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedSales.size === 0) return;
        if (window.confirm(`Tem certeza que deseja apagar ${selectedSales.size} vendas e todos os seus registros financeiros vinculados?`)) {
            try {
                const batch = writeBatch(db);
                const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];

                selectedSales.forEach(vendaId => {
                    // 1. Delete the sale
                    batch.delete(doc(db, 'vendas', vendaId));

                    // 2. Delete linked finance records (cascade)
                    if (vendaId && typeof vendaId === 'string') {
                        const prefix = vendaId.slice(0, 4);
                        const linked = safeFinanceiro.filter(f => f && f.ref && typeof f.ref === 'string' && f.ref.includes(prefix));
                        linked.forEach(f => {
                            batch.delete(doc(db, 'financeiro', f.id));
                        });
                    }
                });

                await batch.commit();
                setSelectedSales(new Set());
                alert(`${selectedSales.size} vendas removidas com sucesso!`);
            } catch (error) {
                console.error("Batch delete error:", error);
                alert('Erro na exclusão em massa: ' + error.message);
            }
        }
    };

    const handleCreatePGO = async () => {
        const salesList = vendas.filter(v => selectedSales.has(v.id));
        const name = prompt(`Criar Pagamento com ${salesList.length} itens. Nome do Pagamento:`);
        if (!name) return;

        try {
            const batch = writeBatch(db);
            const totalVal = salesList.reduce((acc, s) => acc + parseCurrency(s.total), 0);
            const totalCost = salesList.reduce((acc, s) => acc + (s.custo ? parseCurrency(s.custo) : 0), 0); // Simplified cost logic

            const pgoRef = doc(collection(db, "vendas"));
            batch.set(pgoRef, {
                tipo: 'PGO',
                cliente: name,
                produtoDesc: `Agrupamento de ${salesList.length} itens`,
                marca: 'Diversos',
                total: formatCurrency(totalVal),
                custo: formatCurrency(totalCost),
                data: new Date().toISOString().split('T')[0],
                timestamp: Date.now()
            });

            salesList.forEach(sale => {
                const saleRef = doc(db, "vendas", sale.id);
                batch.update(saleRef, { pgoId: pgoRef.id }); // Do not change tipo to PGO for children!
            });

            await batch.commit();
            alert('Pagamento Criado com Sucesso!');
            setSelectedSales(new Set());
            setFilterType('PGO');
        } catch (error) {
            alert("Erro: " + error.message);
        }
    };


    if (loading) return <div className="text-center text-brand-purple mt-10">Carregando...</div>;

    return (
        <div className="pb-24 space-y-4">
            {/* Period Selector */}
            <div className="sticky top-0 z-40 bg-dark-bg/95 backdrop-blur-sm pt-2 pb-2">
                <div className="flex justify-between items-center mb-3">
                    <select
                        value={periodo}
                        onChange={(e) => setPeriodo(e.target.value)}
                        className="bg-dark-surface border border-dark-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                    >
                        <option value="all">Todo o Período</option>
                        {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="text-xs text-dark-muted">{filteredVendas.length} venda(s)</span>
                </div>

                {/* Summary Cards */}
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x mb-3">
                    <GlassCard className="min-w-[130px] flex-shrink-0 snap-start bg-gradient-to-br from-brand-green/20 to-brand-green/5 border-brand-green/20">
                        <p className="text-[10px] text-dark-muted mb-1">Total Vendas</p>
                        <p className="text-lg font-bold text-brand-green">{formatCurrency(totalVendas)}</p>
                    </GlassCard>
                    <GlassCard className="min-w-[130px] flex-shrink-0 snap-start bg-gradient-to-br from-brand-pink/20 to-brand-pink/5 border-brand-pink/20">
                        <p className="text-[10px] text-dark-muted mb-1">Total Custo</p>
                        <p className="text-lg font-bold text-brand-pink">{formatCurrency(totalCusto)}</p>
                    </GlassCard>
                    <GlassCard className="min-w-[130px] flex-shrink-0 snap-start bg-gradient-to-br from-brand-purple/20 to-brand-purple/5 border-brand-purple/20">
                        <p className="text-[10px] text-dark-muted mb-1">Lucro</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(totalLucro)}</p>
                    </GlassCard>
                </div>

                {/* Search + Actions */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar venda..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field pl-10 py-2 text-sm"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        {selectedSales.size > 0 ? (
                            <>
                                <button
                                    onClick={handleSelectAll}
                                    title={allSelected ? 'Desmarcar Todas' : 'Selecionar Todas'}
                                    className={`p-2 rounded-xl transition-all active:scale-90 border ${allSelected
                                        ? 'bg-brand-purple text-white border-brand-purple shadow-lg shadow-brand-purple/20'
                                        : 'bg-dark-surface text-brand-purple border-brand-purple/40 hover:bg-brand-purple/10'
                                        }`}
                                >
                                    <ListChecks size={20} weight="bold" />
                                </button>
                                <button onClick={handleDeleteSelected} className="p-2 rounded-xl bg-brand-pink text-white shadow-lg shadow-brand-pink/20 transition-all active:scale-90">
                                    <Trash size={20} weight="bold" />
                                </button>
                                <button onClick={handleCreatePGO} className="p-2 rounded-xl bg-brand-purple text-white shadow-lg shadow-brand-purple/20 transition-all active:scale-90">
                                    <CheckCircle size={20} weight="bold" />
                                </button>
                            </>
                        ) : (
                            <>
                                <label
                                    className="p-2 rounded-xl bg-dark-surface text-brand-purple cursor-pointer hover:bg-brand-purple/10 border border-transparent hover:border-brand-purple/20 transition-all flex items-center gap-2"
                                    title="Importar Vendas (CSV)"
                                >
                                    <FileArrowUp size={20} weight="bold" />
                                    <span className="text-[10px] font-bold uppercase hidden sm:block">Importar</span>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        className="hidden"
                                        onChange={(e) => processImport(e.target.files[0], 'vendas')}
                                    />
                                </label>
                                <button
                                    onClick={() => exportToCSV(vendas, 'vendas_patricia.csv', 'vendas')}
                                    className="p-2 rounded-xl bg-dark-surface text-brand-green hover:bg-brand-green/10 border border-transparent hover:border-brand-green/20 transition-all flex items-center gap-2"
                                    title="Exportar Vendas (CSV)"
                                >
                                    <FileArrowDown size={20} weight="bold" />
                                    <span className="text-[10px] font-bold uppercase hidden sm:block">Exportar</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {['all', 'Venda', 'PGO', 'PAGO', 'PENDENTE'].map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${filterType === type
                                ? 'bg-brand-purple/20 border-brand-purple text-brand-purple shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                                : 'bg-dark-surface border-dark-border text-dark-muted'
                                }`}
                        >
                            {type === 'all' ? 'Todas' : type === 'PGO' ? 'Pagamentos' : type === 'Venda' ? 'Vendas' : type === 'PAGO' ? 'Pago' : 'Pendente'}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {filteredVendas.map(sale => {
                    const isSelected = selectedSales.has(sale.id);
                    return (
                        <GlassCard
                            key={sale.id}
                            onClick={() => toggleSaleSelection(sale.id)}
                            className={`relative !p-4 border transition-all duration-300 transform ${isSelected
                                ? 'border-brand-purple bg-brand-purple/40 shadow-[0_20px_40px_rgba(139,92,246,0.5)] -translate-y-2 scale-[1.02] z-10 ring-2 ring-brand-purple/60'
                                : 'border-white/5 hover:border-white/10 opacity-70 scale-95 grayscale-[0.3]'}`}
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-semibold text-dark-text">{sale.cliente}</h3>
                                    <div className="text-[10px] text-dark-muted uppercase tracking-wider">
                                        {formatDateForDisplay(sale.data)} {sale.tipo !== 'PGO' && sale.marca ? `• ${sale.marca}` : ''}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {sale.tipo !== 'PGO' && (
                                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sale.status === 'Pago' ? 'border-brand-green text-brand-green bg-brand-green/10' : 'border-brand-pink text-brand-pink bg-brand-pink/10'}`}>
                                            {sale.status === 'Pago' ? 'PAGO' : 'PENDENTE'}
                                        </div>
                                    )}
                                    <div className={`text-xs px-2 py-0.5 rounded-md border ${sale.tipo === 'PGO' ? 'border-brand-pink text-brand-pink' : 'border-brand-green text-brand-green'}`}>
                                        {sale.tipo === 'PGO' ? 'Pagamento' : (sale.tipo || 'Venda')}
                                    </div>
                                </div>
                            </div>

                            {/* Details */}
                            {sale.tipo !== 'PGO' && (
                                <div className="text-sm text-dark-muted mb-3 line-clamp-1">
                                    {sale.produtoDesc || 'Produtos diversos...'}
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex justify-between items-center">
                                <span className="text-xl font-bold text-white">
                                    {sale.tipo === 'PGO'
                                        ? (() => {
                                            const linkedSales = vendas.filter(v => v.pgoId === sale.id);
                                            const aggCost = linkedSales.reduce((acc, v) => acc + parseCurrency(v.custo), 0);
                                            return aggCost > 0 ? formatCurrency(aggCost) : formatCurrency(sale.total);
                                        })()
                                        : formatCurrency(sale.total)}
                                </span>

                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => openEditSale(sale)}
                                        className="p-2 rounded-full bg-dark-surface hover:bg-white/10 text-brand-purple transition-colors">
                                        <PencilSimple size={18} />
                                    </button>
                                    <button
                                        onClick={() => window.open(`https://wa.me/?text=Olá ${sale.cliente}, referente a sua compra...`, '_blank')}
                                        className="p-2 rounded-full bg-dark-surface hover:bg-white/10 text-brand-green transition-colors">
                                        <WhatsappLogo size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(sale.id, e)}
                                        className="p-2 rounded-full bg-dark-surface hover:bg-white/10 text-brand-pink transition-colors">
                                        <Trash size={18} />
                                    </button>
                                </div>
                            </div>
                        </GlassCard>
                    );
                })}
                {filteredVendas.length === 0 && (
                    <div className="text-center py-10 text-dark-muted">
                        Nenhuma venda encontrada.
                    </div>
                )}
            </div>

            {/* FAB */}
            <button
                onClick={openNewSale}
                className="fixed bottom-24 right-4 w-14 h-14 bg-brand-purple text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-purple/40 hover:scale-105 active:scale-95 transition-all z-40"
            >
                <Plus size={24} weight="bold" />
            </button>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSale ? "Editar Venda" : "Nova Venda"}>
                <SalesForm
                    saleToEdit={editingSale}
                    onClose={() => setIsModalOpen(false)}
                />
            </Modal>
        </div>
    );
};

export default Sales;
