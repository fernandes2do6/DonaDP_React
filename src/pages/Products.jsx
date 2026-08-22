import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Plus, MagnifyingGlass, PencilSimple, Trash, Gear, Check, X, ShoppingBag, CaretDown, CaretUp, CaretRight, CloudArrowDown, ArrowsLeftRight } from 'phosphor-react';
import Modal from '../components/Modal';
import ProductForm from '../components/ProductForm';
import { doc, deleteDoc, addDoc, collection, getDocs, query, where, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { formatCurrency, parseCurrency, getLocalISODate } from '../utils/formatters';
import GlassCard from '../components/GlassCard';
import CatalogViewerModal from '../components/CatalogViewerModal';

// Load brand percentage config from localStorage
const DEFAULT_BRAND_PCT = { Natura: 30, Avon: 30, 'Boticário': 80, Eudora: 30 };
const loadBrandPcts = () => {
    try {
        const stored = localStorage.getItem('brandCostPct');
        return stored ? { ...DEFAULT_BRAND_PCT, ...JSON.parse(stored) } : { ...DEFAULT_BRAND_PCT };
    } catch { return { ...DEFAULT_BRAND_PCT }; }
};

// Brand color map
const BRAND_COLORS = {
    Natura: { bg: 'bg-brand-orange/20', border: 'border-brand-orange/40', text: 'text-brand-orange', dot: 'bg-brand-orange' },
    Avon: { bg: 'bg-brand-yellow/20', border: 'border-brand-yellow/40', text: 'text-brand-yellow', dot: 'bg-brand-yellow' },
    'Boticário': { bg: 'bg-brand-brown/20', border: 'border-brand-brown/40', text: 'text-brand-brown', dot: 'bg-brand-brown' },
    Eudora: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-600', dot: 'bg-amber-500' },
    Outros: { bg: 'bg-brand-orange/10', border: 'border-brand-brown/20', text: 'text-light-muted', dot: 'bg-gray-400' },
};

const allBrands = ['Natura', 'Avon', 'Boticário', 'Eudora', 'Outros'];

const Products = () => {
    const { produtos, vendas, financeiro, loading } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [brandPercentages, setBrandPercentages] = useState(loadBrandPcts);
    const [editingBrandPct, setEditingBrandPct] = useState(null);
    const [tempPct, setTempPct] = useState('');
    const [activeTab, setActiveTab] = useState('Todos');
    const [expandedBrands, setExpandedBrands] = useState({});
    const [expandedCycles, setExpandedCycles] = useState({});

    // Catalog Viewer State
    const [viewerOpen, setViewerOpen] = useState(false);
    const [currentCatalogParams, setCurrentCatalogParams] = useState({ brand: '', catalog: null });

    // Transfer Sales State
    const [selectedSales, setSelectedSales] = useState([]);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferTarget, setTransferTarget] = useState({ marca: '', produtoId: '', produtoDesc: '' });

    // Sync Engine State
    const [syncProgress, setSyncProgress] = useState({ step: 0, text: '', brand: '' });

    // Helper to call backend for sync
    const handleSyncCatalog = async (brand) => {
        try {
            setSyncProgress({ step: 1, text: `Iniciando Sincronização...`, brand });
            const res = await fetch('/api/syncCatalog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marca: brand })
            });
            const data = await res.json();

            if (data.success) {
                setSyncProgress({ step: 2, text: `Processando Dados...`, brand });
                // Enforce Database creation for the new Cycle if missing
                try {
                    const q = query(
                        collection(db, "produtos"),
                        where("marca", "==", brand),
                        where("nome", "==", data.ciclo)
                    );
                    const snap = await getDocs(q);

                    if (snap.empty) {
                        await addDoc(collection(db, "produtos"), {
                            nome: data.ciclo,
                            marca: brand,
                            dataInicio: getLocalISODate(),
                            dataFim: data.dataFim || '',
                            pdfUrl: data.pdfUrl || '',
                            timestamp: Date.now()
                        });
                    } else {
                        // Update existing config
                        const docId = snap.docs[0].id;
                        await setDoc(doc(db, "produtos", docId), {
                            dataFim: data.dataFim || '',
                            pdfUrl: data.pdfUrl || ''
                        }, { merge: true });
                    }
                } catch (dbError) {
                    console.error("Erro salvando ciclo:", dbError);
                }

                // If the backend also returned extracted products as CSV, trigger a download.
                if (data.csvData) {
                    try {
                        const blob = new Blob([data.csvData], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.setAttribute('href', url);
                        link.setAttribute('download', `Produtos_${brand}_${data.ciclo.replace(/[^a-z0-9]/gi, '_')}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    } catch (e) {
                        console.error("Erro ao gerar download do CSV:", e);
                    }
                }

                setSyncProgress({ step: 3, text: `Sucesso! Ciclo: ${data.ciclo}. ${data.produtosExtraidos} produtos.`, brand });
                // Hide success message after 3 seconds
                setTimeout(() => setSyncProgress({ step: 0, text: '', brand: '' }), 3000);
            } else {
                setSyncProgress({ step: 3, text: `Falha: ${data.message || data.error}`, brand });
                setTimeout(() => setSyncProgress({ step: 0, text: '', brand: '' }), 4000);
            }
        } catch (err) {
            console.error("Erro no motor de sincronização:", err);
            setSyncProgress({ step: 3, text: 'Erro de conexão com o Agente de Sincronização.', brand });
            setTimeout(() => setSyncProgress({ step: 0, text: '', brand: '' }), 3000);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("Apagar este ciclo/produto?")) {
            await deleteDoc(doc(db, "produtos", id));
        }
    };

    const toggleSaleSelection = (saleId) => {
        setSelectedSales(prev =>
            prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]
        );
    };

    const toggleAllSalesInCycle = (salesInCycle) => {
        const cycleSaleIds = salesInCycle.map(v => v.id);
        const allSelected = cycleSaleIds.every(id => selectedSales.includes(id));

        if (allSelected) {
            // Deselect all
            setSelectedSales(prev => prev.filter(id => !cycleSaleIds.includes(id)));
        } else {
            // Select all (only adding those not already selected)
            setSelectedSales(prev => [...new Set([...prev, ...cycleSaleIds])]);
        }
    };

    const handleTransferSubmit = async (e) => {
        e.preventDefault();
        if (selectedSales.length === 0) return alert("Nenhuma venda selecionada!");
        if (!transferTarget.marca) return alert("Selecione uma marca de destino.");

        try {
            for (const saleId of selectedSales) {
                const payload = {
                    marca: transferTarget.marca,
                    produtoId: transferTarget.produtoId || '',
                    produtoDesc: transferTarget.produtoDesc || 'Produto diverso'
                };
                await setDoc(doc(db, 'vendas', saleId), payload, { merge: true });
            }
            setSelectedSales([]);
            setTransferModalOpen(false);
            setTransferTarget({ marca: '', produtoId: '', produtoDesc: '' });
            alert(`${selectedSales.length} venda(s) transferida(s) com sucesso!`);
        } catch (error) {
            console.error("Erro ao transferir vendas:", error);
            alert("Erro ao transferir vendas.");
        }
    };

    const openNew = () => { setEditingProduct(null); setIsModalOpen(true); };
    const openEdit = (prod, e) => { e?.stopPropagation(); setEditingProduct(prod); setIsModalOpen(true); };

    const startEditPct = (brand) => { setTempPct(brandPercentages[brand]?.toString() || '30'); setEditingBrandPct(brand); };
    const savePct = async (brand) => {
        const parsed = parseFloat(tempPct);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            const updated = { ...brandPercentages, [brand]: parsed };
            setBrandPercentages(updated);
            localStorage.setItem('brandCostPct', JSON.stringify(updated));

            // Lógica de atualização retroativa
            const shouldUpdateRetro = window.confirm(`Deseja atualizar todas as vendas já cadastradas da marca ${brand} para o novo custo de ${parsed}%?\n\n(Vendas de ciclos com margens personalizadas NÃO serão alteradas).`);
            
            if (shouldUpdateRetro) {
                setSyncProgress({ step: 1, text: `Atualizando vendas da ${brand}...`, brand });
                try {
                    const batch = writeBatch(db);
                    let updateCount = 0;
                    
                    const brandSales = vendas.filter(v => v.marca === brand && v.tipo !== 'PGO');
                    
                    for (const sale of brandSales) {
                        let hasCustomPct = false;
                        if (sale.produtoId) {
                            const prod = produtos.find(p => p.id === sale.produtoId);
                            if (prod && prod.porcentagem) {
                                hasCustomPct = true;
                            }
                        }
                        
                        if (hasCustomPct) continue; // Pula as que tem custo personalizado
                        if (!sale.total) continue;
                        
                        const totalVal = parseCurrency(sale.total);
                        if (isNaN(totalVal) || totalVal <= 0) continue;
                        
                        const newCostVal = totalVal * (parsed / 100);
                        const newCostStr = formatCurrency(newCostVal);
                        
                        if (sale.custo === newCostStr) continue;

                        batch.update(doc(db, 'vendas', sale.id), { custo: newCostStr });
                        updateCount++;
                        
                        const prefix = sale.id.slice(0, 4);
                        const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];
                        const relatedDespesas = safeFinanceiro.filter(f => f.ref && f.ref.includes(prefix) && f.tipo === 'Despesa');
                        
                        for (const despesa of relatedDespesas) {
                            batch.update(doc(db, 'financeiro', despesa.id), { valor: newCostStr });
                            updateCount++;
                        }
                    }
                    
                    if (updateCount > 0) {
                        await batch.commit();
                        setSyncProgress({ step: 3, text: `Sucesso! ${updateCount} atualizações.`, brand });
                    } else {
                        setSyncProgress({ step: 3, text: `Nenhuma venda precisou ser alterada.`, brand });
                    }
                } catch (error) {
                    console.error("Erro ao atualizar vendas retroativas:", error);
                    setSyncProgress({ step: 3, text: `Erro: ${error.message}`, brand });
                } finally {
                    setTimeout(() => setSyncProgress({ step: 0, text: '', brand: '' }), 4000);
                }
            }
        }
        setEditingBrandPct(null);
    };

    const toggleBrand = (brand) => {
        setExpandedBrands(prev => ({ ...prev, [brand]: !prev[brand] }));
    };

    if (loading) return <div className="text-center text-brand-orange mt-10 animate-pulse">Carregando...</div>;

    // === VENDAS POR MARCA ===
    // Group all sales by brand (this is the core data for "Marcas / Ciclos")
    const vendasPorMarca = allBrands.reduce((acc, brand) => {
        const vendasDaMarca = vendas.filter(v => v.tipo !== 'PGO' && (v.marca || 'Outros') === brand);
        if (vendasDaMarca.length > 0) acc[brand] = vendasDaMarca;
        return acc;
    }, {});

    // Cycles (produtos) by brand
    const ciclosPorMarca = (produtos || []).reduce((acc, p) => {
        const brand = p.marca || 'Outros';
        if (!acc[brand]) acc[brand] = [];
        acc[brand].push(p);
        return acc;
    }, {});

    // Which brands to show based on tab filter
    const brandsToShow = activeTab === 'Todos'
        ? allBrands.filter(b => vendasPorMarca[b] || ciclosPorMarca[b])
        : [activeTab];

    return (
        <div className="pb-24 space-y-4">
            {/* Header / Tabs */}
            <div className="sticky top-0 z-40 bg-light-bg/95 backdrop-blur-sm pt-2 pb-2">
                <h2 className="text-lg font-bold text-light-text mb-3">Marcas / Ciclos</h2>

                {/* Brand Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={() => setActiveTab('Todos')}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${activeTab === 'Todos' ? 'bg-white/10 border-white text-light-text' : 'bg-light-surface border-brand-brown/30 text-light-muted'}`}
                    >
                        Todas
                    </button>
                    {allBrands.map(brand => {
                        const colors = BRAND_COLORS[brand] || BRAND_COLORS['Outros'];
                        const isActive = activeTab === brand;
                        const hasData = !!(vendasPorMarca[brand] || ciclosPorMarca[brand]);
                        return (
                            <button
                                key={brand}
                                onClick={() => setActiveTab(brand)}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${isActive ? `${colors.bg} ${colors.border} ${colors.text}` : hasData ? 'bg-light-surface border-brand-brown/30 text-light-muted' : 'bg-light-surface border-brand-brown/30 text-light-muted opacity-40'}`}
                            >
                                {brand}
                            </button>
                        );
                    })}
                </div>
            </div>



            {/* Global Progress Bar (if syncing and not just natura hero) */}
            {syncProgress.step > 0 && syncProgress.text && (
                <div className="bg-light-surface border border-brand-orange/40 rounded-xl p-3 mb-2 animate-pulse">
                    <div className="text-xs text-brand-orange font-medium mb-1">{syncProgress.text}</div>
                    <div className="w-full bg-light-bg rounded-full h-1.5">
                        <div className="bg-brand-orange h-1.5 rounded-full transition-all duration-500" style={{ width: `${(syncProgress.step / 3) * 100}%` }}></div>
                    </div>
                </div>
            )}

            {/* Brand Sections */}
            {brandsToShow.map(brand => {
                const colors = BRAND_COLORS[brand] || BRAND_COLORS['Outros'];
                const vendasMarca = vendasPorMarca[brand] || [];
                const ciclosMarca = ciclosPorMarca[brand] || [];
                const totalVendido = vendasMarca.reduce((acc, v) => acc + parseCurrency(v.total), 0);
                const totalCustoMarca = vendasMarca.reduce((acc, v) => acc + (parseCurrency(v.custo) > 0 ? parseCurrency(v.custo) : 0), 0);
                const lucroMarca = totalVendido - totalCustoMarca;
                const isExpanded = expandedBrands[brand] === true; // default closed

                return (
                    <div key={brand} className="space-y-2">
                        {/* Brand Header */}
                        <button
                            onClick={() => toggleBrand(brand)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border ${colors.border} ${colors.bg} transition-all`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${colors.dot} flex-shrink-0`} />
                                <div className="text-left">
                                    <div className={`font-bold ${colors.text}`}>{brand}</div>
                                    <div className="text-xs text-light-muted">
                                        {vendasMarca.length} venda(s) • {ciclosMarca.length} ciclo(s)
                                        {totalVendido > 0 && ` • Total: ${formatCurrency(totalVendido)}`}
                                    </div>
                                    {totalVendido > 0 && (
                                        <div className="text-[10px] text-light-muted mt-0.5">
                                            Custo: <span className="text-brand-yellow">{formatCurrency(totalCustoMarca)}</span>
                                            {' • '}Lucro: <span className={lucroMarca >= 0 ? 'text-brand-green' : 'text-brand-yellow'}>{formatCurrency(lucroMarca)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 items-center">
                                {/* View Catalog PDF per Brand */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Busca o ciclo mais recente com um PDF salvo
                                        const arrayCiclos = ciclosMarca || [];
                                        const actives = arrayCiclos.filter(c => c.pdfUrl && c.pdfUrl.trim() !== '');
                                        const latestCatalog = actives.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];

                                        setCurrentCatalogParams({
                                            brand,
                                            catalog: latestCatalog || { ciclo: 'Nenhum Catálogo Valido Sincronizado', pdfUrl: '' }
                                        });
                                        setViewerOpen(true);
                                    }}
                                    className="p-1.5 rounded-full bg-light-surface hover:bg-brand-orange/20 text-brand-orange transition-all"
                                    title={`Abrir Catálogo / PDF da ${brand}`}
                                >
                                    <ShoppingBag size={18} />
                                </button>

                                {/* Sync CTA per brand */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleSyncCatalog(brand); }}
                                    disabled={syncProgress.brand === brand && syncProgress.step > 0}
                                    className={`p-1.5 rounded-full transition-all ${syncProgress.brand === brand && syncProgress.step > 0 ? 'bg-light-surface text-brand-orange animate-pulse' : 'bg-light-surface hover:bg-white/10 text-light-text'}`}
                                    title="Sincronizar Revistas e Produtos desta Marca"
                                >
                                    <CloudArrowDown size={18} weight={syncProgress.brand === brand && syncProgress.step > 0 ? "fill" : "regular"} />
                                </button>

                                <div className={`${colors.text}`}>
                                    {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                                </div>
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="ml-2 space-y-2">
                                {/* Custo config */}
                                <div className="flex items-center gap-2 px-3 py-2 text-xs text-light-muted bg-light-surface/50 rounded-lg border border-white/5">
                                    <Gear size={12} />
                                    <span>Custo padrão:</span>
                                    {editingBrandPct === brand ? (
                                        <div className="flex items-center gap-1">
                                            <input type="number" value={tempPct} onChange={(e) => setTempPct(e.target.value)}
                                                className="w-12 bg-light-bg border border-brand-brown/30 rounded px-1 py-0.5 text-center text-light-text focus:outline-none text-xs" autoFocus />
                                            <span>%</span>
                                            <button onClick={() => savePct(brand)} className="text-brand-green"><Check size={14} /></button>
                                            <button onClick={() => setEditingBrandPct(null)} className="text-brand-yellow"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => startEditPct(brand)} className="hover:text-light-text underline decoration-dashed">
                                            {brandPercentages[brand]}%
                                        </button>
                                    )}
                                </div>

                                {/* Ciclos (Produtos) com vendas aninhadas */}
                                {ciclosMarca.length > 0 && (
                                    <div>
                                        <div className="text-xs text-light-muted px-1 mb-1 font-medium uppercase tracking-wider">Ciclos Cadastrados</div>
                                        {ciclosMarca.map(prod => {
                                            const cycleKey = prod.id;
                                            const isCycleExpanded = expandedCycles[cycleKey] === true;
                                            const vendasDoCiclo = vendasMarca.filter(v =>
                                                v.produtoId === prod.id || (v.produtoDesc && v.produtoDesc.toLowerCase() === prod.nome.toLowerCase())
                                            );
                                            const totalCiclo = vendasDoCiclo.reduce((acc, v) => acc + parseCurrency(v.total), 0);
                                            const custoCiclo = vendasDoCiclo.reduce((acc, v) => acc + (parseCurrency(v.custo) > 0 ? parseCurrency(v.custo) : 0), 0);
                                            const lucroCiclo = totalCiclo - custoCiclo;

                                            const today = getLocalISODate();
                                            const isExpired = prod.dataFim && prod.dataFim < today;

                                            return (
                                                <div key={prod.id} className="mb-2">
                                                    <GlassCard
                                                        onClick={() => setExpandedCycles(prev => ({ ...prev, [cycleKey]: !prev[cycleKey] }))}
                                                        className={`!p-3 flex justify-between items-center cursor-pointer transition-all ${isExpired ? 'border border-brand-yellow/20 bg-light-surface/30 opacity-80' : 'border border-white/5 hover:border-brand-brown/20'}`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <CaretRight size={12} className={`text-light-muted transition-transform ${isCycleExpanded ? 'rotate-90' : ''}`} />
                                                            <div>
                                                                <div className="font-medium text-sm text-dark-text flex items-center gap-2">
                                                                    Ciclo {prod.nome}
                                                                    {isExpired && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-yellow/20 text-brand-yellow border border-brand-yellow/40 uppercase tracking-wider">Expirado</span>}
                                                                </div>
                                                                <div className="text-[10px] text-light-muted">
                                                                    {prod.dataInicio ? new Date(prod.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                                                    {' → '}
                                                                    {prod.dataFim ? new Date(prod.dataFim + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                                                    {' • '}{vendasDoCiclo.length} venda(s)
                                                                    {vendasDoCiclo.length > 0 && ` • Total: ${formatCurrency(totalCiclo)}`}
                                                                </div>
                                                                {vendasDoCiclo.length > 0 && (
                                                                    <div className="text-[10px] text-light-muted">
                                                                        Custo: <span className="text-brand-yellow">{formatCurrency(custoCiclo)}</span>
                                                                        {' • '}Lucro: <span className={lucroCiclo >= 0 ? 'text-brand-green' : 'text-brand-yellow'}>{formatCurrency(lucroCiclo)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                            <button onClick={(e) => openEdit(prod, e)} className="p-1.5 rounded-full bg-light-surface text-brand-orange">
                                                                <PencilSimple size={14} />
                                                            </button>
                                                            <button onClick={(e) => handleDelete(prod.id, e)} className="p-1.5 rounded-full bg-light-surface text-brand-yellow">
                                                                <Trash size={14} />
                                                            </button>
                                                        </div>
                                                    </GlassCard>
                                                    {isCycleExpanded && vendasDoCiclo.length > 0 && (
                                                        <div className="ml-4 mt-1 border-l-2 border-brand-orange/20 pl-3">
                                                            {/* Action Header for Selection */}
                                                            {selectedSales.some(id => vendasDoCiclo.some(v => v.id === id)) && (
                                                                <div className="flex items-center gap-2 mb-2 bg-brand-orange/10 p-2 rounded-lg border border-brand-orange/30">
                                                                    <span className="text-xs text-brand-orange font-medium">
                                                                        {vendasDoCiclo.filter(v => selectedSales.includes(v.id)).length} selecionada(s)
                                                                    </span>
                                                                    <div className="flex-1" />
                                                                    <button
                                                                        onClick={() => setTransferModalOpen(true)}
                                                                        className="flex items-center gap-1 text-[10px] bg-brand-orange text-white px-2 py-1 rounded hover:bg-brand-orange/80 transition-colors"
                                                                    >
                                                                        <ArrowsLeftRight size={12} /> Transferir
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <button
                                                                    onClick={() => toggleAllSalesInCycle(vendasDoCiclo)}
                                                                    className="text-[10px] text-light-muted underline hover:text-light-text"
                                                                >
                                                                    {vendasDoCiclo.every(v => selectedSales.includes(v.id)) ? 'Desmarcar Todas' : 'Selecionar Todas'}
                                                                </button>
                                                            </div>

                                                            {/* Scrollable list */}
                                                            <div className="max-h-60 overflow-y-auto no-scrollbar space-y-1 pr-1">
                                                                {vendasDoCiclo.map(venda => (
                                                                    <div
                                                                        key={venda.id}
                                                                        onClick={() => toggleSaleSelection(venda.id)}
                                                                        className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${selectedSales.includes(venda.id) ? 'bg-brand-orange/20 border-brand-orange/50' : 'bg-light-surface/50 border-white/5 hover:bg-light-surface'} `}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedSales.includes(venda.id)}
                                                                            onChange={() => { }} // handled by parent onClick
                                                                            className="accent-brand-orange w-4 h-4 rounded cursor-pointer"
                                                                        />
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="text-sm font-medium text-dark-text truncate">{venda.cliente || 'Sem cliente'}</div>
                                                                            <div className="text-[10px] text-light-muted truncate">{venda.data || '—'}</div>
                                                                        </div>
                                                                        <div className="text-sm font-bold text-light-text ml-2 flex-shrink-0">{formatCurrency(venda.total)}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {isCycleExpanded && vendasDoCiclo.length === 0 && (
                                                        <div className="ml-4 mt-1 border-l-2 border-brand-orange/20 pl-3 py-2 text-xs text-light-muted">Nenhuma venda neste ciclo.</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                                }

                                {/* Vendas sem ciclo */}
                                {(() => {
                                    const vendasSemCiclo = vendasMarca.filter(v => {
                                        const matchesCycle = ciclosMarca.some(prod =>
                                            v.produtoId === prod.id || (v.produtoDesc && v.produtoDesc.toLowerCase() === prod.nome.toLowerCase())
                                        );
                                        return !matchesCycle;
                                    });
                                    if (vendasSemCiclo.length === 0) return null;
                                    const semCicloKey = `${brand}_sem_ciclo`;
                                    const isSemCicloExpanded = expandedCycles[semCicloKey] === true;
                                    return (
                                        <div className="mb-2">
                                            <GlassCard
                                                onClick={() => setExpandedCycles(prev => ({ ...prev, [semCicloKey]: !prev[semCicloKey] }))}
                                                className="!p-3 border border-white/5 flex justify-between items-center cursor-pointer hover:border-brand-brown/20 transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <CaretRight size={12} className={`text-light-muted transition-transform ${isSemCicloExpanded ? 'rotate-90' : ''}`} />
                                                    <div>
                                                        <div className="font-medium text-sm text-dark-text">Sem Ciclo</div>
                                                        <div className="text-[10px] text-light-muted">{vendasSemCiclo.length} venda(s)</div>
                                                    </div>
                                                </div>
                                            </GlassCard>
                                            {isSemCicloExpanded && (
                                                <div className="ml-4 mt-1 border-l-2 border-brand-brown/30 pl-3">
                                                    {/* Action Header for Selection */}
                                                    {selectedSales.some(id => vendasSemCiclo.some(v => v.id === id)) && (
                                                        <div className="flex items-center gap-2 mb-2 bg-white/5 p-2 rounded-lg border border-brand-brown/20">
                                                            <span className="text-xs text-light-text font-medium">
                                                                {vendasSemCiclo.filter(v => selectedSales.includes(v.id)).length} selecionada(s)
                                                            </span>
                                                            <div className="flex-1" />
                                                            <button
                                                                onClick={() => setTransferModalOpen(true)}
                                                                className="flex items-center gap-1 text-[10px] bg-brand-orange text-white px-2 py-1 rounded hover:bg-brand-orange/80 transition-colors"
                                                            >
                                                                <ArrowsLeftRight size={12} /> Transferir
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <button
                                                            onClick={() => toggleAllSalesInCycle(vendasSemCiclo)}
                                                            className="text-[10px] text-light-muted underline hover:text-light-text"
                                                        >
                                                            {vendasSemCiclo.every(v => selectedSales.includes(v.id)) ? 'Desmarcar Todas' : 'Selecionar Todas'}
                                                        </button>
                                                    </div>

                                                    {/* Scrollable list */}
                                                    <div className="max-h-60 overflow-y-auto no-scrollbar space-y-1 pr-1">
                                                        {vendasSemCiclo.map(venda => (
                                                            <div
                                                                key={venda.id}
                                                                onClick={() => toggleSaleSelection(venda.id)}
                                                                className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${selectedSales.includes(venda.id) ? 'bg-brand-orange/20 border-brand-orange/50' : 'bg-light-surface/50 border-white/5 hover:bg-light-surface'} `}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedSales.includes(venda.id)}
                                                                    onChange={() => { }} // handled by parent onClick
                                                                    className="accent-brand-orange w-4 h-4 rounded cursor-pointer"
                                                                />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-sm font-medium text-dark-text truncate">{venda.cliente || 'Sem cliente'}</div>
                                                                    <div className="text-[10px] text-light-muted truncate">{venda.data || '—'}</div>
                                                                </div>
                                                                <div className="text-sm font-bold text-light-text ml-2 flex-shrink-0">{formatCurrency(venda.total)}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {vendasMarca.length === 0 && ciclosMarca.length === 0 && (
                                    <div className="text-center py-4 text-light-muted text-sm">Nenhum dado para {brand}</div>
                                )}
                            </div>
                        )
                        }
                    </div >
                );
            })}

            {
                brandsToShow.length === 0 && (
                    <div className="text-center py-10 text-light-muted">Nenhum dado encontrado.</div>
                )
            }

            {/* FAB */}
            <button
                onClick={openNew}
                className="fixed bottom-24 right-4 w-14 h-14 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-orange/40 hover:scale-105 active:scale-95 transition-all z-40"
            >
                <Plus size={24} weight="bold" />
            </button>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? "Editar Ciclo" : "Novo Ciclo"}>
                <ProductForm productToEdit={editingProduct} onClose={() => setIsModalOpen(false)} />
            </Modal>

            {/* Modal Catalog Viewer */}
            <CatalogViewerModal
                isOpen={viewerOpen}
                onClose={() => setViewerOpen(false)}
                brand={currentCatalogParams.brand}
                catalog={currentCatalogParams.catalog}
                onFallbackRequest={() => {
                    const url = prompt(`Digite a URL manual do PDF do catálogo da marca ${currentCatalogParams.brand}:`);
                    if (url) {
                        const catalogId = currentCatalogParams.catalog.id;
                        if (catalogId) {
                            updateDoc(doc(db, "produtos", catalogId), { pdfUrl: url }).catch(console.error);
                        }
                        setCurrentCatalogParams(prev => ({
                            ...prev,
                            catalog: { ...prev.catalog, pdfUrl: url }
                        }));
                    }
                }}
                onFileUpload={async (file) => {
                    if (!currentCatalogParams.catalog) return;
                    try {
                        setSyncProgress({ step: 1, text: `Fazendo upload de ${file.name}...`, brand: currentCatalogParams.brand });
                        const fileRef = ref(storage, `catalogs/${currentCatalogParams.brand}_${currentCatalogParams.catalog.nome}_${Date.now()}.pdf`);
                        await uploadBytes(fileRef, file);
                        setSyncProgress({ step: 2, text: `Finalizando...`, brand: currentCatalogParams.brand });
                        const downloadUrl = await getDownloadURL(fileRef);

                        const catalogId = currentCatalogParams.catalog.id;
                        if (catalogId) {
                            await updateDoc(doc(db, "produtos", catalogId), { pdfUrl: downloadUrl });
                        }

                        setCurrentCatalogParams(prev => ({
                            ...prev,
                            catalog: { ...prev.catalog, pdfUrl: downloadUrl }
                        }));
                        setSyncProgress({ step: 0, text: '', brand: '' });
                    } catch (error) {
                        console.error("Error uploading PDF:", error);
                        alert("Erro ao enviar o PDF. Tente novamente.");
                        setSyncProgress({ step: 0, text: '', brand: '' });
                    }
                }}
            />
            <Modal isOpen={transferModalOpen} onClose={() => setTransferModalOpen(false)} title="Transferir Vendas">
                <form onSubmit={handleTransferSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-light-muted mb-1 uppercase tracking-wider">Marca Destino</label>
                        <select
                            value={transferTarget.marca}
                            onChange={(e) => setTransferTarget({ marca: e.target.value, produtoId: '', produtoDesc: '' })}
                            className="w-full bg-light-bg border border-brand-brown/30 rounded-xl px-4 py-3 text-light-text focus:outline-none focus:border-brand-orange transition-colors"
                            required
                        >
                            <option value="">Selecione uma marca...</option>
                            {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    {transferTarget.marca && (
                        <div>
                            <label className="block text-xs font-semibold text-light-muted mb-1 uppercase tracking-wider">Ciclo Destino</label>
                            <select
                                value={transferTarget.produtoId}
                                onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const selectedProd = produtos.find(p => p.id === selectedId);
                                    setTransferTarget({
                                        ...transferTarget,
                                        produtoId: selectedId,
                                        produtoDesc: selectedProd ? selectedProd.nome : 'Produto diverso' // 'Produto diverso' if 'Sem Ciclo'
                                    });
                                }}
                                className="w-full bg-light-bg border border-brand-brown/30 rounded-xl px-4 py-3 text-light-text focus:outline-none focus:border-brand-orange transition-colors"
                            >
                                <option value="">Sem Ciclo</option>
                                {produtos.filter(p => p.marca === transferTarget.marca).map(p => (
                                    <option key={p.id} value={p.id}>Ciclo {p.nome}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setTransferModalOpen(false)} className="flex-1 py-3 rounded-xl border border-brand-brown/30 text-dark-text hover:bg-light-surface transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange/90 transition-colors shadow-lg shadow-brand-orange/20">Transferir</button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};

export default Products;
