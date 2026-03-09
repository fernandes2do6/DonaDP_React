import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { parseCurrency, formatCurrency, getLocalISODate } from '../utils/formatters';
import { CloudArrowUp, TrendUp, TrendDown, Wallet, CoinVertical, WhatsappLogo } from 'phosphor-react';
import BrandPieChart from '../components/BrandPieChart';
import GlassCard from '../components/GlassCard';

const PaymentCard = ({ payment, indicatorColor = "bg-brand-purple" }) => {
    return (
        <GlassCard className="!p-3 border-white/5 flex items-center justify-between group hover:border-brand-purple/20 transition-all">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-10 h-10 rounded-full ${indicatorColor}/10 flex items-center justify-center text-white font-bold border border-white/10 flex-shrink-0`}>
                    {payment.cliente?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{payment.cliente || 'Sem cliente'}</p>
                    <p className="text-[10px] text-dark-muted truncate">{payment.produtoDesc || 'Produto diverso'}</p>
                    <p className="text-[10px] text-dark-muted">
                        Vencimento: {payment.dataPagamento ? payment.dataPagamento.split('-').reverse().join('/') : '—'}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                    <p className="text-sm font-bold text-white">{formatCurrency(payment.total)}</p>
                    <div className="flex items-center justify-end gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${indicatorColor} animate-pulse`} />
                        <p className="text-[10px] text-dark-muted uppercase font-medium">Pendente</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        if (payment.whatsapp) {
                            const phone = payment.whatsapp.replace(/\D/g, '');
                            const msg = encodeURIComponent(`Olá ${payment.cliente}! 😊\nGostaria de lembrar sobre o pagamento pendente de *${formatCurrency(payment.total)}* referente a: ${payment.produtoDesc || 'sua compra'}.\nAguardo retorno, obrigada! 💜`);
                            window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
                        } else {
                            alert(`O cliente "${payment.cliente}" não possui WhatsApp cadastrado.\nCadastre na aba Clientes.`);
                        }
                    }}
                    className={`p-2.5 rounded-xl active:scale-90 transition-all border ${payment.whatsapp
                        ? 'bg-brand-green/10 text-brand-green hover:bg-brand-green/20 border-brand-green/20'
                        : 'bg-dark-surface text-dark-muted border-dark-border hover:text-brand-green hover:border-brand-green/20'
                        }`}
                    title={payment.whatsapp ? 'Cobrar via WhatsApp' : 'Sem WhatsApp cadastrado'}
                >
                    <WhatsappLogo size={20} weight="fill" />
                </button>
            </div>
        </GlassCard>
    );
};

const DeliveryCard = ({ delivery }) => {
    return (
        <GlassCard className="!p-3 border-white/5 flex items-center justify-between group hover:border-brand-purple/20 transition-all">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green font-bold border border-brand-green/20 flex-shrink-0">
                    {delivery.cliente?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{delivery.cliente || 'Sem cliente'}</p>
                    <p className="text-[10px] text-dark-muted truncate">{delivery.produtoDesc || 'Produto diverso'}</p>
                    <p className="text-[10px] text-dark-muted">
                        Entrega: {delivery.dataEntrega ? delivery.dataEntrega.split('-').reverse().join('/') : '—'}
                    </p>
                </div>
            </div>
            <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-white">{formatCurrency(delivery.total)}</p>
                <p className="text-[10px] text-brand-green font-medium uppercase tracking-wider">Prevista para hoje</p>
            </div>
        </GlassCard>
    );
};

const Dashboard = () => {
    const { vendas, clientes, loading } = useData();
    const [selectedBrands, setSelectedBrands] = useState([]);

    const handleBrandClick = (brand) => {
        if (!brand) { setSelectedBrands([]); return; }
        setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);
    };

    if (loading) return <div className="flex justify-center items-center h-full text-brand-purple animate-pulse">Carregando dados...</div>;

    const todayISO = getLocalISODate();

    // --- CALCULATIONS (vendas-only, filtered by brand) ---
    const filteredVendas = selectedBrands.length > 0 ? vendas.filter(v => selectedBrands.includes(v.marca)) : vendas;

    const totalVendas = filteredVendas.reduce((acc, curr) => acc + parseCurrency(curr.total), 0);

    const totalCusto = filteredVendas.reduce((acc, curr) => {
        const cost = parseCurrency(curr.custo);
        return acc + (cost > 0 ? cost : 0);
    }, 0);

    // A Receber = soma de vendas não pagas
    const unpaid = filteredVendas.filter(v => v.status !== 'Pago' && v.tipo !== 'PGO');
    const aReceber = unpaid.reduce((acc, v) => acc + parseCurrency(v.total), 0);

    // A Pagar = custo total
    const aPagar = totalCusto;

    const saldoPrevisto = totalVendas - totalCusto;

    const brandLabel = selectedBrands.length > 0 ? ` (${selectedBrands.join(', ')})` : '';

    const mapPaymentInfo = (v) => {
        const client = (clientes || []).find(c => c.nome && v.cliente && c.nome.toLowerCase() === v.cliente.toLowerCase());
        return {
            ...v,
            whatsapp: client ? (client.whatsapp || client.telefone) : null
        };
    };

    const dueToday = unpaid.filter(v => v.dataPagamento === todayISO).map(mapPaymentInfo);
    const overdue = unpaid.filter(v => v.dataPagamento < todayISO).map(mapPaymentInfo);
    const deliveriesToday = filteredVendas.filter(v => v.dataEntrega === todayISO).map(mapPaymentInfo);

    const todayDate = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="pb-8 space-y-6">
            {/* Header */}
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-dark-muted text-sm font-medium uppercase tracking-wider mb-1">Visão Geral</h2>
                    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-pink">
                        Dona D&P
                    </h1>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-dark-muted capitalize">{todayDate}</div>
                    <div className="flex items-center justify-end gap-1 text-xs text-brand-green mt-1">
                        <CloudArrowUp weight="bold" />
                        <span>Sincronizado</span>
                    </div>
                </div>
            </header>

            {/* Bento Grid */}
            <div className="grid grid-cols-2 gap-4">

                {/* Main Balance Card (Full Width) */}
                <GlassCard className="col-span-2 bg-gradient-to-br from-brand-purple/20 to-brand-purple/5 border-brand-purple/20">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-brand-purple/20 rounded-lg text-brand-purple">
                            <Wallet size={24} weight="duotone" />
                        </div>
                        <span className="text-xs font-medium text-brand-purple bg-brand-purple/10 px-2 py-1 rounded-full">
                            Saldo Previsto
                        </span>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">
                        {formatCurrency(saldoPrevisto)}
                    </div>
                    <div className="text-sm text-dark-muted">
                        Balanço Geral{brandLabel}
                    </div>
                </GlassCard>

                {/* A Receber */}
                <GlassCard className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendUp size={48} weight="fill" className="text-brand-green" />
                    </div>
                    <p className="text-xs text-dark-muted mb-1">A Receber{brandLabel}</p>
                    <p className="text-lg font-bold text-brand-green">{formatCurrency(aReceber)}</p>
                </GlassCard>

                {/* A Pagar */}
                <GlassCard className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendDown size={48} weight="fill" className="text-brand-pink" />
                    </div>
                    <p className="text-xs text-dark-muted mb-1">A Pagar{brandLabel}</p>
                    <p className="text-lg font-bold text-brand-pink">{formatCurrency(aPagar)}</p>
                </GlassCard>

                {/* Chart (Full Width) */}
                <GlassCard className="col-span-2">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <CoinVertical className="text-brand-purple" size={18} />
                        Vendas por Marca
                    </h3>
                    <BrandPieChart data={vendas} onBrandClick={handleBrandClick} selectedBrands={selectedBrands} />
                </GlassCard>

                {/* Payments Columns */}
                <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vencem Hoje */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center justify-between pl-1">
                            <div className="flex items-center gap-2 text-brand-purple">
                                <TrendUp size={18} />
                                Vencem Hoje
                            </div>
                            <span className="text-[10px] bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded-full">
                                {dueToday.length} item(ns)
                            </span>
                        </h3>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {dueToday.map(payment => (
                                <PaymentCard key={payment.id} payment={payment} />
                            ))}
                            {dueToday.length === 0 && (
                                <div className="text-center py-8 text-dark-muted text-sm border-2 border-dashed border-dark-border rounded-2xl bg-dark-surface/30">
                                    <p className="text-xs opacity-60">Nenhum pagamento para hoje.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Atrasados (Pendentes) */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center justify-between pl-1">
                            <div className="flex items-center gap-2 text-brand-pink">
                                <TrendDown size={18} />
                                Vendas com Pagamentos Pendentes
                            </div>
                            <span className="text-[10px] bg-brand-pink/10 text-brand-pink px-2 py-0.5 rounded-full">
                                {overdue.length} item(ns)
                            </span>
                        </h3>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {overdue.map(payment => (
                                <PaymentCard key={payment.id} payment={payment} indicatorColor="bg-brand-pink" />
                            ))}
                            {overdue.length === 0 && (
                                <div className="text-center py-8 text-dark-muted text-sm border-2 border-dashed border-dark-border rounded-2xl bg-dark-surface/30">
                                    <p className="text-xs opacity-60">Nenhum pagamento atrasado.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Deliveries Today */}
            <div>
                <h3 className="text-sm font-semibold flex items-center justify-between pl-1 mb-3">
                    <div className="flex items-center gap-2 text-brand-green">
                        <CloudArrowUp size={18} />
                        Entregas de Hoje
                    </div>
                </h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {deliveriesToday.map(d => (
                        <DeliveryCard key={d.id} delivery={d} />
                    ))}
                    {deliveriesToday.length === 0 && (
                        <div className="text-center py-8 text-dark-muted text-sm border-2 border-dashed border-dark-border rounded-2xl bg-dark-surface/30">
                            <p className="text-xs opacity-60">Nenhuma entrega prevista para hoje.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
