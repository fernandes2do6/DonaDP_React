import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Plus, MagnifyingGlass, PencilSimple, Trash, Gear, Check, X, ShoppingBag, CaretDown, CaretUp } from 'phosphor-react';
import Modal from '../components/Modal';
import ProductForm from '../components/ProductForm';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { formatCurrency, parseCurrency } from '../utils/formatters';
import GlassCard from '../components/GlassCard';

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
    Natura: { bg: 'bg-brand-purple/20', border: 'border-brand-purple/40', text: 'text-brand-purple', dot: 'bg-brand-purple' },
    Avon: { bg: 'bg-brand-green/20', border: 'border-brand-green/40', text: 'text-brand-green', dot: 'bg-brand-green' },
    'Boticário': { bg: 'bg-brand-pink/20', border: 'border-brand-pink/40', text: 'text-brand-pink', dot: 'bg-brand-pink' },
    Eudora: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', dot: 'bg-amber-400' },
    Outros: { bg: 'bg-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-400', dot: 'bg-gray-400' },
};

const allBrands = ['Natura', 'Avon', 'Boticário', 'Eudora', 'Outros'];

const Products = () => {
    const { produtos, vendas, loading } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [brandPercentages, setBrandPercentages] = useState(loadBrandPcts);
    const [editingBrandPct, setEditingBrandPct] = useState(null);
    const [tempPct, setTempPct] = useState('');
    const [activeTab, setActiveTab] = useState('Todos');
    const [expandedBrands, setExpandedBrands] = useState({});

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("Apagar este ciclo/produto?")) {
            await deleteDoc(doc(db, "produtos", id));
        }
    };

    const openNew = () => { setEditingProduct(null); setIsModalOpen(true); };
    const openEdit = (prod, e) => { e?.stopPropagation(); setEditingProduct(prod); setIsModalOpen(true); };

    const startEditPct = (brand) => { setTempPct(brandPercentages[brand]?.toString() || '30'); setEditingBrandPct(brand); };
    const savePct = (brand) => {
        const parsed = parseFloat(tempPct);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            const updated = { ...brandPercentages, [brand]: parsed };
            setBrandPercentages(updated);
            localStorage.setItem('brandCostPct', JSON.stringify(updated));
        }
        setEditingBrandPct(null);
    };

    const toggleBrand = (brand) => {
        setExpandedBrands(prev => ({ ...prev, [brand]: !prev[brand] }));
    };

    if (loading) return <div className="text-center text-brand-purple mt-10 animate-pulse">Carregando...</div>;

    // === VENDAS POR MARCA ===
    // Group all sales by brand (this is the core data for "Marcas / Ciclos")
    const vendasPorMarca = allBrands.reduce((acc, brand) => {
        const vendasDaMarca = vendas.filter(v => (v.marca || 'Outros') === brand);
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
            <div className="sticky top-0 z-40 bg-dark-bg/95 backdrop-blur-sm pt-2 pb-2">
                <h2 className="text-lg font-bold text-white mb-3">Marcas / Ciclos</h2>

                {/* Brand Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={() => setActiveTab('Todos')}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${activeTab === 'Todos' ? 'bg-white/10 border-white text-white' : 'bg-dark-surface border-dark-border text-dark-muted'}`}
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
                                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${isActive ? `${colors.bg} ${colors.border} ${colors.text}` : hasData ? 'bg-dark-surface border-dark-border text-dark-muted' : 'bg-dark-surface border-dark-border text-dark-muted opacity-40'}`}
                            >
                                {brand}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Natura Hero Video Background */}
            {(activeTab === 'Natura') && (
                <div className="relative rounded-2xl overflow-hidden mb-2" style={{ height: '180px' }}>
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                        src="/natura_animated.mp4"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 z-10">
                        <h3 className="text-2xl font-extrabold text-white drop-shadow-lg">Natura</h3>
                        <p className="text-xs text-white/70">Sua marca de destaque</p>
                    </div>
                </div>
            )}

            {/* Brand Sections */}
            {brandsToShow.map(brand => {
                const colors = BRAND_COLORS[brand] || BRAND_COLORS['Outros'];
                const vendasMarca = vendasPorMarca[brand] || [];
                const ciclosMarca = ciclosPorMarca[brand] || [];
                const totalVendido = vendasMarca.reduce((acc, v) => acc + parseCurrency(v.total), 0);
                const isExpanded = expandedBrands[brand] !== false; // default open

                return (
                    <div key={brand} className="space-y-2">
                        {/* Brand Header */}
                        <button
                            onClick={() => toggleBrand(brand)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border ${colors.border} ${colors.bg} transition-all`}
                        >
                            <div className="flex items-center gap-3">
                                {brand === 'Natura' ? (
                                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-brand-purple/60 flex-shrink-0">
                                        <video autoPlay loop muted playsInline className="w-full h-full object-cover" src="/natura_animated.mp4" />
                                    </div>
                                ) : (
                                    <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
                                )}
                                <div className="text-left">
                                    <div className={`font-bold ${colors.text}`}>{brand}</div>
                                    <div className="text-xs text-dark-muted">
                                        {vendasMarca.length} venda(s) • {ciclosMarca.length} ciclo(s)
                                        {totalVendido > 0 && ` • Total: ${formatCurrency(totalVendido)}`}
                                    </div>
                                </div>
                            </div>
                            <div className={`${colors.text}`}>
                                {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="ml-2 space-y-2">
                                {/* Custo config */}
                                <div className="flex items-center gap-2 px-3 py-2 text-xs text-dark-muted bg-dark-surface/50 rounded-lg border border-white/5">
                                    <Gear size={12} />
                                    <span>Custo padrão:</span>
                                    {editingBrandPct === brand ? (
                                        <div className="flex items-center gap-1">
                                            <input type="number" value={tempPct} onChange={(e) => setTempPct(e.target.value)}
                                                className="w-12 bg-dark-bg border border-dark-border rounded px-1 py-0.5 text-center text-white focus:outline-none text-xs" autoFocus />
                                            <span>%</span>
                                            <button onClick={() => savePct(brand)} className="text-brand-green"><Check size={14} /></button>
                                            <button onClick={() => setEditingBrandPct(null)} className="text-brand-pink"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => startEditPct(brand)} className="hover:text-white underline decoration-dashed">
                                            {brandPercentages[brand]}%
                                        </button>
                                    )}
                                </div>

                                {/* Ciclos (Produtos) */}
                                {ciclosMarca.length > 0 && (
                                    <div>
                                        <div className="text-xs text-dark-muted px-1 mb-1 font-medium uppercase tracking-wider">Ciclos Cadastrados</div>
                                        {ciclosMarca.map(prod => (
                                            <GlassCard
                                                key={prod.id}
                                                onClick={() => openEdit(prod)}
                                                className="!p-3 border border-white/5 flex justify-between items-center cursor-pointer hover:border-white/10 transition-all mb-2"
                                            >
                                                <div>
                                                    <div className="font-medium text-sm text-dark-text">{prod.nome}</div>
                                                    <div className="text-[10px] text-dark-muted">{formatCurrency(prod.preco)} • Custo: {formatCurrency(prod.custo)}</div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={(e) => openEdit(prod, e)} className="p-1.5 rounded-full bg-dark-surface text-brand-purple">
                                                        <PencilSimple size={14} />
                                                    </button>
                                                    <button onClick={(e) => handleDelete(prod.id, e)} className="p-1.5 rounded-full bg-dark-surface text-brand-pink">
                                                        <Trash size={14} />
                                                    </button>
                                                </div>
                                            </GlassCard>
                                        ))}
                                    </div>
                                )}

                                {vendasMarca.length > 0 && (
                                    <div>
                                        <div className="text-xs text-dark-muted px-1 mb-1 font-medium uppercase tracking-wider flex items-center gap-1">
                                            <ShoppingBag size={10} /> Vendas Lançadas ({vendasMarca.length})
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                                            {vendasMarca.map(venda => (
                                                <div key={venda.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-dark-surface/50 border border-white/5">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-dark-text truncate">{venda.cliente}</div>
                                                        <div className="text-[10px] text-dark-muted truncate">{venda.produtoDesc || venda.data}</div>
                                                    </div>
                                                    <div className="text-sm font-bold text-white ml-2 flex-shrink-0">{formatCurrency(venda.total)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {vendasMarca.length === 0 && ciclosMarca.length === 0 && (
                                    <div className="text-center py-4 text-dark-muted text-sm">Nenhum dado para {brand}</div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {brandsToShow.length === 0 && (
                <div className="text-center py-10 text-dark-muted">Nenhum dado encontrado.</div>
            )}

            {/* FAB */}
            <button
                onClick={openNew}
                className="fixed bottom-24 right-4 w-14 h-14 bg-brand-purple text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-purple/40 hover:scale-105 active:scale-95 transition-all z-40"
            >
                <Plus size={24} weight="bold" />
            </button>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? "Editar Ciclo" : "Novo Ciclo"}>
                <ProductForm productToEdit={editingProduct} onClose={() => setIsModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default Products;
