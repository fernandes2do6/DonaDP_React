import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { parseCurrency, formatCurrency, formatDateForDisplay } from '../utils/formatters';
import { Plus, MagnifyingGlass, Trash, PencilSimple, WhatsappLogo, Funnel, X, CheckCircle, FileArrowUp, FileArrowDown, ListChecks, CaretDown, CaretUp } from 'phosphor-react';
import Modal from '../components/Modal';
import SalesForm from '../components/SalesForm';
import { exportToCSV, processImport } from '../utils/exportImport';
import { doc, deleteDoc, writeBatch, collection, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import GlassCard from '../components/GlassCard';
import ClientDetail from '../components/ClientDetail';

const Sales = () => {
    const { vendas, financeiro, loading, clientes } = useData(); // Extract clientes
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState(null);
    const [selectedSales, setSelectedSales] = useState(new Set());
    const [expandedPgoId, setExpandedPgoId] = useState(null);
    const [viewingClient, setViewingClient] = useState(null);

    const [activeModule, setActiveModule] = useState('menu'); // 'menu' | 'vendas' | 'pgos'

    // Force gateway menu if navigated from BottomNav or invalid state
    const location = useLocation();
    useEffect(() => {
        if (location.state?.resetMenu) {
            setActiveModule('menu');
        }
    }, [location.state?.resetMenu]);

    // Filter State
    const [filterType, setFilterType] = useState('all'); // all, Venda, PGO, PAGO, PENDENTE
    const [periodo, setPeriodo] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });

    // Handle Module Switch
    const navigateToModule = (moduleType) => {
        setActiveModule(moduleType);
        if (moduleType === 'vendas') {
            setFilterType('all');
        } else if (moduleType === 'pgos') {
            setFilterType('PGO');
        }
    };

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
        }

        const type = v.tipo || 'Venda';
        
        // Em Vendas, escodemos PGOs completamente se 'all'
        if (activeModule === 'vendas') {
            if (filterType === 'all') return matchesSearch && type !== 'PGO';
            if (filterType === 'Venda') return matchesSearch && type !== 'PGO';
            if (filterType === 'PAGO') return matchesSearch && type !== 'PGO' && v.status === 'Pago';
            if (filterType === 'PENDENTE') return matchesSearch && type !== 'PGO' && v.status !== 'Pago';
        }
        
        // Em Pagamentos, forçamos sempre PGO
        if (activeModule === 'pgos') {
            return matchesSearch && type === 'PGO';
        }

        // Dropthrough standard (pra garantir)
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
    const totalLucro = activeModule === 'pgos' ? 0 : totalVendas - totalCusto;

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

    const handleTogglePaymentStatus = async (sale, e) => {
        e.stopPropagation();
        const newStatus = sale.status === 'Pago' ? 'Pendente' : 'Pago';
        const updates = { status: newStatus };
        
        if (newStatus === 'Pago') {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            updates.dataPago = `${yyyy}-${mm}-${dd}`;
        } else {
            updates.dataPago = '';
        }

        try {
            await updateDoc(doc(db, 'vendas', sale.id), updates);
            
            const prefix = sale.id.slice(0, 4);
            const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];
            const linked = safeFinanceiro.filter(f => f && f.ref && typeof f.ref === 'string' && f.ref.includes(prefix));
            
            for (const f of linked) {
                try {
                    await updateDoc(doc(db, 'financeiro', f.id), { status: newStatus });
                } catch (err) {
                    console.error("Erro ao atualizar status do financeiro:", err);
                }
            }
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro ao atualizar status da venda.");
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('Tem certeza que deseja apagar esta venda?')) {
            try {
                await cascadeDeleteFinanceiro(id);
            } catch (error) {
                console.error("Error in cascade: ", error);
            }

            try {
                await deleteDoc(doc(db, 'vendas', id));
            } catch (error) {
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
        if (window.confirm(`Tem certeza que deseja apagar ${selectedSales.size} registros e seus financeiros vinculados?`)) {
            try {
                const batch = writeBatch(db);
                const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];

                selectedSales.forEach(vendaId => {
                    batch.delete(doc(db, 'vendas', vendaId));
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
                alert(`${selectedSales.size} registros removidos com sucesso!`);
            } catch (error) {
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
            const totalCost = salesList.reduce((acc, s) => acc + (s.custo ? parseCurrency(s.custo) : 0), 0);

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
                batch.update(saleRef, { pgoId: pgoRef.id }); 
            });

            await batch.commit();
            alert('Pagamento Criado com Sucesso!');
            setSelectedSales(new Set());
            navigateToModule('pgos');
        } catch (error) {
            alert("Erro: " + error.message);
        }
    };


    if (loading) return <div className="text-center text-brand-purple mt-10">Carregando...</div>;

    // --- GATEWAY MENU VIEW ---
    if (activeModule === 'menu') {
        return (
            <div className="pb-24 space-y-6 pt-6">
                <div className="text-center space-y-2 mb-8 mt-4">
                    <h1 className="text-2xl font-bold text-white">Gestão Financeira</h1>
                    <p className="text-dark-muted text-sm">Selecione o módulo que deseja acessar</p>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 max-w-sm mx-auto">
                    <button
                        onClick={() => navigateToModule('vendas')}
                        className="group flex flex-col items-center justify-center p-8 rounded-3xl bg-dark-surface border border-brand-purple/20 hover:border-brand-purple transition-all hover:bg-brand-purple/5 shadow-lg relative overflow-hidden active:scale-95"
                    >
                        <div className="absolute inset-0 bg-brand-purple/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 rounded-2xl bg-brand-purple/20 flex items-center justify-center mb-4 text-brand-purple group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V72H40V56ZM40,200V88H216V200ZM176,128a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,128Zm-40,32a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h40A8,8,0,0,1,136,160Z"></path></svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Vendas</h2>
                        <p className="text-xs text-dark-muted text-center leading-relaxed">Gerencie todas as suas vendas realizadas, status e parcelamentos de clientes.</p>
                    </button>

                    <button
                        onClick={() => navigateToModule('pgos')}
                        className="group flex flex-col items-center justify-center p-8 rounded-3xl bg-dark-surface border border-brand-green/20 hover:border-brand-green transition-all hover:bg-brand-green/5 shadow-lg relative overflow-hidden active:scale-95"
                    >
                        <div className="absolute inset-0 bg-brand-green/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 rounded-2xl bg-brand-green/20 flex items-center justify-center mb-4 text-brand-green group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256"><path d="M216,56H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56Zm0,144H40V72H216V200ZM176,120a24,24,0,1,1-24-24A24,24,0,0,1,176,120Zm-16,0a8,8,0,1,0-8,8A8,8,0,0,0,160,120Zm-58.42,1.83a8,8,0,0,1,3.25,10.84C89,161.44,72,176,40,176a8,8,0,0,1,0-16c23.08,0,36.56-11,50.83-36.67A8,8,0,0,1,101.58,121.83Zm89.37,36.31c19.68-15.65,25.05-38.15,25.05-40.14a8,8,0,1,0-15.63-3.32c0,.13-3.79,16.51-19.37,28.88a8,8,0,1,0,10,14.58Z"></path></svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Pagamentos</h2>
                        <p className="text-xs text-dark-muted text-center leading-relaxed">Centralize e acompanhe repasses aos fornecedores, cartões e Pix agrupados.</p>
                    </button>
                </div>
            </div>
        );
    }

    // --- MODULE VIEW (VENDAS OR PGOS) ---
    return (
        <div className="pb-24 space-y-4">
            {/* Context/Period Header */}
            <div className="sticky top-0 z-40 bg-dark-bg/95 backdrop-blur-sm pt-2 pb-2">
                <div className="flex items-center gap-2 mb-4">
                    <button 
                        onClick={() => setActiveModule('menu')}
                        className="py-1.5 px-3 rounded-xl bg-dark-surface hover:bg-white/10 text-brand-purple flex items-center gap-2 font-semibold text-sm transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>
                        Voltar
                    </button>
                    <h2 className="text-white font-bold text-lg flex-1 text-right">
                        {activeModule === 'vendas' ? 'Vendas' : 'Pagamentos'}
                    </h2>
                </div>
                
                <div className="flex justify-between items-center mb-3">
                    <select
                        value={periodo}
                        onChange={(e) => setPeriodo(e.target.value)}
                        className="bg-dark-surface border border-dark-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                    >
                        <option value="all">Todo o Período</option>
                        {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="text-xs text-dark-muted">{filteredVendas.length} {activeModule === 'vendas' ? 'venda(s)' : 'pagamento(s)'}</span>
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
                    {['all', 'Venda', 'PGO', 'PAGO', 'PENDENTE']
                        .filter(type => {
                            if (activeModule === 'vendas' && type === 'PGO') return false;
                            if (activeModule === 'pgos' && (type === 'Venda' || type === 'PAGO' || type === 'PENDENTE')) return false;
                            return true;
                        })
                        .map(type => (
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
                                    <h3 
                                        className={`font-semibold text-dark-text inline-block ${sale.tipo !== 'PGO' ? 'cursor-pointer hover:text-brand-purple hover:underline transition-all' : ''}`}
                                        onClick={(e) => {
                                            if (sale.tipo !== 'PGO') {
                                                e.stopPropagation();
                                                const clientObj = clientes?.find(c => c.nome === sale.cliente);
                                                if (clientObj) {
                                                    setViewingClient(clientObj);
                                                } else {
                                                    setViewingClient({ nome: sale.cliente });
                                                }
                                            }
                                        }}
                                        title={sale.tipo !== 'PGO' ? "Ver detalhes do cliente" : ""}
                                    >
                                        {sale.cliente}
                                    </h3>
                                    <div className="text-[10px] text-dark-muted uppercase tracking-wider mt-0.5">
                                        {formatDateForDisplay(sale.data)} {sale.tipo !== 'PGO' && sale.marca ? `• ${sale.marca}` : ''}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {sale.tipo !== 'PGO' && (
                                        <button
                                            onClick={(e) => handleTogglePaymentStatus(sale, e)}
                                            title={`Marcar como ${sale.status === 'Pago' ? 'Pendente' : 'Pago'}`}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${sale.status === 'Pago' ? 'border-brand-green text-brand-green bg-brand-green/10 hover:bg-brand-green/20' : 'border-brand-pink text-brand-pink bg-brand-pink/10 hover:bg-brand-pink/20'}`}>
                                            {sale.status === 'Pago' ? 'PAGO' : 'PENDENTE'}
                                        </button>
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
                                    {sale.tipo === 'PGO' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedPgoId(prev => prev === sale.id ? null : sale.id);
                                            }}
                                            className="p-2 rounded-full bg-dark-surface hover:bg-white/10 text-dark-muted hover:text-white transition-colors flex items-center justify-center shadow-lg shadow-black/20"
                                            title={expandedPgoId === sale.id ? "Recolher itens" : "Expandir itens"}
                                        >
                                            {expandedPgoId === sale.id ? <CaretUp size={18} /> : <CaretDown size={18} />}
                                        </button>
                                    )}
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

                            {/* Expanded Linked Sales */}
                            {sale.tipo === 'PGO' && expandedPgoId === sale.id && (
                                <div className="mt-4 pt-3 border-t border-dark-border" onClick={e => e.stopPropagation()}>
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-xs font-bold text-dark-muted uppercase tracking-wider">
                                            Vendas Vinculadas
                                        </h4>
                                        <span className="bg-dark-surface px-2 py-0.5 rounded-full text-[10px] text-dark-muted">
                                            {vendas.filter(v => v.pgoId === sale.id).length} itens
                                        </span>
                                    </div>
                                    {(() => {
                                        const linkedSales = vendas.filter(v => v.pgoId === sale.id);
                                        if (linkedSales.length === 0) return <p className="text-xs text-brand-pink/70 bg-brand-pink/10 p-2 rounded-lg italic">Nenhuma venda explícita encontrada para este pagamento.</p>;
                                        return (
                                            <ul className="space-y-2">
                                                {linkedSales.map(ls => (
                                                    <li key={ls.id} className="flex justify-between items-center bg-dark-bg/40 p-2.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                                        <div className="flex-1 min-w-0 mr-2">
                                                            <p className="text-xs font-semibold text-white truncate">{ls.cliente}</p>
                                                            <p className="text-[10px] text-dark-muted truncate mt-0.5">
                                                                {ls.data && `${formatDateForDisplay(ls.data)} • `}
                                                                {ls.marca || 'Diversos'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <p className="text-xs font-bold text-brand-green">
                                                                {ls.custo ? formatCurrency(parseCurrency(ls.custo)) : formatCurrency(parseCurrency(ls.total))}
                                                            </p>
                                                            <p className="text-[9px] text-dark-muted mt-0.5">Custo/Repasse</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        );
                                    })()}
                                </div>
                            )}
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
            
            {/* Client Detail Overlay */}
            {viewingClient && (
                <ClientDetail client={viewingClient} onClose={() => setViewingClient(null)} />
            )}
        </div>
    );
};

export default Sales;
