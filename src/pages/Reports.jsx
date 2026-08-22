import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { formatCurrency, parseCurrency } from '../utils/formatters';
import { ChartBar, ArrowUp, ArrowDown, TrendUp, WarningCircle, Printer, CaretLeft } from 'phosphor-react';
import GlassCard from '../components/GlassCard';
import { useNavigate } from 'react-router-dom';

const Reports = () => {
    const { vendas, saldos, loading } = useData();
    const navigate = useNavigate();

    // Filters
    const [selectedMonths, setSelectedMonths] = useState([String(new Date().getMonth() + 1)]);
    const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));

    const parseDateHelper = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return null;
        let parts = dateStr.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        parts = dateStr.split('-');
        if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
        return null;
    };

    // Derived Data
    const dreData = useMemo(() => {
        if (!vendas || !saldos) return null;

        // 1. Filtrar Vendas do Período
        const vendasPeriodo = vendas.filter(v => {
            if (v.tipo === 'PGO') return false; // DRE foca apenas nas vendas reais
            const d = parseDateHelper(v.dataPagamento || v.data);
            if (!d) return false;
            if (!selectedMonths.includes('all') && !selectedMonths.includes((d.getMonth() + 1).toString())) return false;
            if (selectedYear !== 'all' && d.getFullYear().toString() !== selectedYear) return false;
            return true;
        });

        // 2. Filtrar Saldos (Recebimentos Avulsos) do Período
        const saldosPeriodo = saldos.filter(s => {
            const d = parseDateHelper(s.data);
            if (!d) return false;
            if (!selectedMonths.includes('all') && !selectedMonths.includes((d.getMonth() + 1).toString())) return false;
            if (selectedYear !== 'all' && d.getFullYear().toString() !== selectedYear) return false;
            return true;
        });

        // Cálculos DRE Gerencial
        let receitaBruta = 0;
        let cmv = 0;
        let recebidoVendasPagas = 0;
        let pendente = 0;

        vendasPeriodo.forEach(v => {
            const total = parseCurrency(v.total);
            const custo = parseCurrency(v.custo || '0');
            
            receitaBruta += total;
            cmv += custo;

            if (v.status === 'Pago') {
                recebidoVendasPagas += total;
            } else {
                pendente += total;
            }
        });

        const lucroBruto = receitaBruta - cmv;
        const totalSaldos = saldosPeriodo.reduce((acc, s) => acc + parseCurrency(s.valor), 0);
        const faturamentoRealizado = recebidoVendasPagas + totalSaldos;

        // KPIs
        const margemLucro = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
        const indiceInadimplencia = receitaBruta > 0 ? (pendente / receitaBruta) * 100 : 0;
        const ticketMedio = vendasPeriodo.length > 0 ? (receitaBruta / vendasPeriodo.length) : 0;

        return {
            receitaBruta,
            cmv,
            lucroBruto,
            pendente,
            faturamentoRealizado,
            margemLucro,
            indiceInadimplencia,
            ticketMedio,
            qtdVendas: vendasPeriodo.length
        };

    }, [vendas, saldos, selectedMonths, selectedYear]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="text-center text-brand-orange mt-10 animate-pulse">Carregando Relatórios...</div>;

    return (
        <div className="pb-24 space-y-4 pt-4 print:pt-0 print:pb-0">
            {/* Header (No print) */}
            <div className="sticky top-0 z-40 bg-light-bg/95 backdrop-blur-sm pt-2 pb-2 print:hidden">
                <div className="flex items-center gap-2 mb-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="py-1.5 px-3 rounded-xl bg-light-surface hover:bg-white/10 text-brand-orange flex items-center gap-2 font-semibold text-sm transition-all"
                    >
                        <CaretLeft size={16} weight="bold" />
                        Voltar
                    </button>
                    <h2 className="text-light-text font-bold text-lg flex-1 text-right">Relatório Gerencial</h2>
                </div>

                {/* Filtros */}
                <div className="flex gap-2 mb-3">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="flex-1 bg-light-surface border border-brand-brown/30 rounded-lg px-3 py-2 text-sm text-light-text focus:outline-none focus:border-brand-orange"
                    >
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="all">Todos os Anos</option>
                    </select>
                    <button 
                        onClick={handlePrint}
                        className="px-4 py-2 rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90 transition-colors flex items-center gap-2 font-bold text-sm"
                        title="Imprimir ou Salvar PDF"
                    >
                        <Printer size={20} />
                        Imprimir
                    </button>
                </div>

                {/* Filtro de Múltiplos Meses */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={() => setSelectedMonths(['all'])}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${selectedMonths.includes('all') ? 'bg-white/10 border-white text-light-text' : 'bg-light-surface border-brand-brown/30 text-light-muted'}`}
                    >
                        Ano Todo
                    </button>
                    {Array.from({length: 12}, (_, i) => String(i + 1)).map(m => {
                        const isSelected = selectedMonths.includes(m) && !selectedMonths.includes('all');
                        return (
                            <button
                                key={m}
                                onClick={() => {
                                    if (selectedMonths.includes('all')) {
                                        setSelectedMonths([m]);
                                    } else {
                                        if (isSelected) {
                                            const newSelection = selectedMonths.filter(x => x !== m);
                                            setSelectedMonths(newSelection.length === 0 ? ['all'] : newSelection);
                                        } else {
                                            setSelectedMonths([...selectedMonths, m].sort((a,b) => parseInt(a) - parseInt(b)));
                                        }
                                    }
                                }}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${isSelected ? 'bg-brand-orange/20 border-brand-orange/40 text-brand-orange' : 'bg-light-surface border-brand-brown/30 text-light-muted'}`}
                            >
                                Mês {m.padStart(2, '0')}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Print Title (Only shows in print) */}
            <div className="hidden print:block text-center mb-6">
                <h1 className="text-2xl font-bold text-black">DRE Gerencial de Vendas</h1>
                <p className="text-sm text-light-muted">Período: {!selectedMonths.includes('all') ? `Mês ${selectedMonths.map(m => m.padStart(2, '0')).join(', ')} / ` : ''}{selectedYear}</p>
            </div>

            {dreData ? (
                <div className="space-y-4 print:text-black print:space-y-6">
                    {/* KPIs Cards */}
                    <div className="grid grid-cols-2 gap-3 print:grid-cols-4">
                        <GlassCard className="p-3 bg-brand-orange/10 border-brand-orange/30 print:bg-transparent print:border-brand-brown/20">
                            <div className="flex items-center gap-1.5 mb-1 text-brand-orange print:text-light-muted">
                                <TrendUp size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Margem Bruta</span>
                            </div>
                            <p className="text-lg font-bold text-light-text print:text-black">{dreData.margemLucro.toFixed(1)}%</p>
                        </GlassCard>
                        
                        <GlassCard className="p-3 bg-brand-yellow/10 border-brand-yellow/30 print:bg-transparent print:border-brand-brown/20">
                            <div className="flex items-center gap-1.5 mb-1 text-brand-yellow print:text-light-muted">
                                <WarningCircle size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Inadimplência</span>
                            </div>
                            <p className="text-lg font-bold text-light-text print:text-black">{dreData.indiceInadimplencia.toFixed(1)}%</p>
                        </GlassCard>

                        <GlassCard className="p-3 bg-light-surface print:bg-transparent print:border-brand-brown/20">
                            <div className="flex items-center gap-1.5 mb-1 text-light-muted print:text-light-muted">
                                <ChartBar size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Ticket Médio</span>
                            </div>
                            <p className="text-lg font-bold text-light-text print:text-black">{formatCurrency(dreData.ticketMedio)}</p>
                        </GlassCard>

                        <GlassCard className="p-3 bg-light-surface print:bg-transparent print:border-brand-brown/20">
                            <div className="flex items-center gap-1.5 mb-1 text-light-muted print:text-light-muted">
                                <ChartBar size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Qtd Vendas</span>
                            </div>
                            <p className="text-lg font-bold text-light-text print:text-black">{dreData.qtdVendas}</p>
                        </GlassCard>
                    </div>

                    {/* DRE Table */}
                    <GlassCard className="p-0 overflow-hidden border border-brand-brown/30 print:border-brand-brown/20">
                        <div className="bg-light-surface/50 p-3 border-b border-brand-brown/30 print:bg-gray-100 print:border-brand-brown/20">
                            <h3 className="font-bold text-light-text uppercase text-sm tracking-wider flex items-center gap-2 print:text-black">
                                1. DRE (Regime de Competência)
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-light-text print:text-black">Receita Bruta de Vendas</span>
                                <span className="font-medium text-light-text print:text-black">{formatCurrency(dreData.receitaBruta)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-brand-yellow">
                                <span className="print:text-red-600">(-) Custo de Mercadorias (CMV)</span>
                                <span className="print:text-red-600">{formatCurrency(dreData.cmv)}</span>
                            </div>
                            <div className="h-px bg-white/10 w-full print:bg-gray-300 my-2"></div>
                            <div className="flex justify-between items-center font-bold text-brand-green text-base">
                                <span className="print:text-green-700">(=) Lucro Bruto</span>
                                <span className="print:text-green-700">{formatCurrency(dreData.lucroBruto)}</span>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Fluxo de Recebimento Table */}
                    <GlassCard className="p-0 overflow-hidden border border-brand-brown/30 print:border-brand-brown/20">
                        <div className="bg-light-surface/50 p-3 border-b border-brand-brown/30 print:bg-gray-100 print:border-brand-brown/20">
                            <h3 className="font-bold text-light-text uppercase text-sm tracking-wider flex items-center gap-2 print:text-black">
                                2. Análise de Inadimplência (Caixa)
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-light-muted print:text-light-muted">Faturamento Realizado (Recebido)</span>
                                <span className="font-medium text-brand-green print:text-green-700">{formatCurrency(dreData.faturamentoRealizado)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-light-muted print:text-light-muted">Contas a Receber (Pendente)</span>
                                <span className="font-medium text-brand-yellow print:text-red-600">{formatCurrency(dreData.pendente)}</span>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-white/5 print:border-brand-brown/20">
                                <div className="w-full bg-light-bg h-4 rounded-full overflow-hidden flex print:border print:border-brand-brown/20">
                                    <div 
                                        className="bg-brand-green h-full" 
                                        style={{ width: `${dreData.receitaBruta > 0 ? (dreData.receitaBruta - dreData.pendente) / dreData.receitaBruta * 100 : 0}%`}}
                                    ></div>
                                    <div 
                                        className="bg-brand-yellow h-full" 
                                        style={{ width: `${dreData.indiceInadimplencia}%`}}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[10px] text-light-muted mt-1 uppercase tracking-widest print:text-light-muted">
                                    <span>Recebido ({dreData.receitaBruta > 0 ? (100 - dreData.indiceInadimplencia).toFixed(1) : 0}%)</span>
                                    <span>Pendente ({dreData.indiceInadimplencia.toFixed(1)}%)</span>
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                </div>
            ) : null}
            
            <style>{`
                @media print {
                    body { background: white; color: black; }
                    .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                    .print\\:text-black { color: black !important; }
                    .print\\:bg-transparent { background: transparent !important; }
                    .print\\:border-brand-brown/20 { border-color: #d1d5db !important; }
                    .print\\:text-red-600 { color: #dc2626 !important; }
                    .print\\:text-green-700 { color: #15803d !important; }
                    .print\\:text-light-muted { color: #374151 !important; }
                    .print\\:text-light-muted { color: #4b5563 !important; }
                    .print\\:text-light-muted { color: #6b7280 !important; }
                    .print\\:border-brand-brown/20 { border-color: #9ca3af !important; }
                    .print\\:pt-0 { padding-top: 0 !important; }
                    .print\\:pb-0 { padding-bottom: 0 !important; }
                }
            `}</style>
        </div>
    );
};

export default Reports;
