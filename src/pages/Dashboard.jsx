import { useData } from '../contexts/DataContext';
import { parseCurrency, formatCurrency } from '../utils/formatters';
import { CloudArrowUp, TrendUp, TrendDown, Wallet, CoinVertical, WhatsappLogo } from 'phosphor-react';
import BrandPieChart from '../components/BrandPieChart';
import GlassCard from '../components/GlassCard';

const Dashboard = () => {
    const { vendas, clientes, loading } = useData();

    if (loading) return <div className="flex justify-center items-center h-full text-brand-purple animate-pulse">Carregando dados...</div>;

    // --- CALCULATIONS (vendas-only) ---
    const totalVendas = vendas.reduce((acc, curr) => acc + parseCurrency(curr.total), 0);

    const totalCusto = vendas.reduce((acc, curr) => {
        const cost = parseCurrency(curr.custo);
        return acc + (cost > 0 ? cost : 0);
    }, 0);

    // A Receber = soma de vendas não pagas
    const vendasPendentes = vendas.filter(v => v.status !== 'Pago');
    const aReceber = vendasPendentes.reduce((acc, v) => acc + parseCurrency(v.total), 0);

    // A Pagar = custo total
    const aPagar = totalCusto;

    const saldoPrevisto = totalVendas - totalCusto;

    // Pending Payments: vendas não pagas, com info do cliente e WhatsApp
    const pendingPayments = vendasPendentes
        .sort((a, b) => parseCurrency(b.total) - parseCurrency(a.total))
        .slice(0, 10)
        .map(v => {
            const client = (clientes || []).find(c => c.nome && v.cliente && c.nome.toLowerCase() === v.cliente.toLowerCase());
            return {
                ...v,
                whatsapp: client ? (client.whatsapp || client.telefone) : null
            };
        });

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
                        Balanço Geral
                    </div>
                </GlassCard>

                {/* A Receber */}
                <GlassCard className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendUp size={48} weight="fill" className="text-brand-green" />
                    </div>
                    <p className="text-xs text-dark-muted mb-1">A Receber</p>
                    <p className="text-lg font-bold text-brand-green">{formatCurrency(aReceber)}</p>
                </GlassCard>

                {/* A Pagar */}
                <GlassCard className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendDown size={48} weight="fill" className="text-brand-pink" />
                    </div>
                    <p className="text-xs text-dark-muted mb-1">A Pagar</p>
                    <p className="text-lg font-bold text-brand-pink">{formatCurrency(aPagar)}</p>
                </GlassCard>

                {/* Chart (Full Width) */}
                <GlassCard className="col-span-2">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <CoinVertical className="text-brand-purple" size={18} />
                        Vendas por Marca
                    </h3>
                    <BrandPieChart data={vendas} />
                </GlassCard>

                {/* Pending Payments Section */}
                <div className="col-span-2 space-y-4">
                    <h3 className="text-sm font-semibold flex items-center justify-between pl-1">
                        <div className="flex items-center gap-2">
                            <CoinVertical className="text-brand-pink" size={18} />
                            Pagamentos Pendentes
                        </div>
                        <span className="text-[10px] bg-brand-pink/10 text-brand-pink px-2 py-0.5 rounded-full">
                            Cobrança Ativa
                        </span>
                    </h3>
                    <div className="space-y-3">
                        {pendingPayments.map(payment => (
                            <GlassCard key={payment.id} className="!p-3 border-white/5 flex items-center justify-between group hover:border-brand-purple/20 transition-all">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded-full bg-brand-pink/10 flex items-center justify-center text-brand-pink font-bold border border-brand-pink/20 flex-shrink-0">
                                        {payment.cliente?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{payment.cliente || 'Sem cliente'}</p>
                                        <p className="text-[10px] text-dark-muted truncate">{payment.produtoDesc || 'Produto diverso'}</p>
                                        <p className="text-[10px] text-dark-muted">{payment.data || payment.dataPagamento || ''}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white">{formatCurrency(payment.total)}</p>
                                        <div className="flex items-center justify-end gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-pink animate-pulse" />
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
                        ))}
                        {pendingPayments.length === 0 && (
                            <div className="text-center py-8 text-dark-muted text-sm border-2 border-dashed border-dark-border rounded-2xl bg-dark-surface/30">
                                <p className="mb-1">🎉 Bom trabalho!</p>
                                <p className="text-xs opacity-60">Nenhum pagamento pendente no momento.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Recent Activity / Actions */}
            <div>
                <h3 className="text-sm font-muted text-dark-muted mb-3 uppercase tracking-widest pl-1">Ações Rápidas</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button className="p-4 bg-dark-surface rounded-xl border border-dark-border flex flex-col items-center justify-center gap-2 hover:bg-dark-surface/80 active:scale-95 transition-all group">
                        <div className="p-2 rounded-full bg-brand-purple/20 text-brand-purple group-hover:scale-110 transition-transform">
                            <TrendUp size={20} weight="bold" />
                        </div>
                        <span className="text-xs font-medium">Nova Venda</span>
                    </button>
                    <button className="p-4 bg-dark-surface rounded-xl border border-dark-border flex flex-col items-center justify-center gap-2 hover:bg-dark-surface/80 active:scale-95 transition-all group">
                        <div className="p-2 rounded-full bg-brand-green/20 text-brand-green group-hover:scale-110 transition-transform">
                            <CloudArrowUp size={20} weight="bold" />
                        </div>
                        <span className="text-xs font-medium">Sincronizar</span>
                    </button>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
