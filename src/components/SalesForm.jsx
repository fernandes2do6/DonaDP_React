import { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { parseCurrency, formatCurrency, getLocalISODate } from '../utils/formatters';
import { addDoc, collection, setDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const DEFAULT_BRAND_PCT = { Natura: 30, Avon: 30, 'Boticário': 80, Eudora: 30 };
const loadBrandPcts = () => {
    try {
        const stored = localStorage.getItem('brandCostPct');
        return stored ? { ...DEFAULT_BRAND_PCT, ...JSON.parse(stored) } : { ...DEFAULT_BRAND_PCT };
    } catch { return { ...DEFAULT_BRAND_PCT }; }
};

const SalesForm = ({ saleToEdit, onClose, defaultClient }) => {
    const { clientes, produtos, financeiro, vendas } = useData();

    // ── DATE HELPERS ──────────────────────────────────────────────────────────
    const toInputDate = (d) => {
        if (!d) return getLocalISODate();
        if (typeof d === 'string' && d.includes('-')) return d;
        const parts = d.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return d;
    };
    const fromInputDate = (d) => {
        if (!d) return '';
        if (d.includes('/')) return d;
        const parts = d.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return d;
    };

    // ── STATE ──────────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        tipo: 'Venda',
        cliente: defaultClient || '',
        produtoId: '',
        produtoDesc: '',
        marca: 'Natura',
        total: '',
        custo: '',
        formaPagamento: 'Pix',
        data: fromInputDate(getLocalISODate()),
        dataPagamento: getLocalISODate(),
        dataEntrega: getLocalISODate(),
        parcelas: '2x',
        pgoId: '',
        status: 'Pendente',
        dataPago: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [currentPct, setCurrentPct] = useState(0);

    useEffect(() => {
        if (saleToEdit) {
            setFormData({
                ...saleToEdit,
                produtoId: saleToEdit.produtoId || '',
                parcelas: saleToEdit.parcelas || '2x',
                data: saleToEdit.data || fromInputDate(getLocalISODate()),
                status: saleToEdit.status || 'Pendente',
                dataPago: saleToEdit.dataPago || ''
            });
        }
    }, [saleToEdit]);

    // Cost Calculation Logic
    useEffect(() => {
        const brandPcts = loadBrandPcts();
        let pctVal = brandPcts[formData.marca] || 30; // Default to the brand's standard or 30

        if (formData.produtoId) {
            const prod = produtos.find(p => p.id === formData.produtoId);
            if (prod && prod.porcentagem) pctVal = parseFloat(prod.porcentagem);
        }
        setCurrentPct(pctVal);

        if (formData.total) {
            const totalVal = parseCurrency(formData.total);
            if (!isNaN(totalVal) && totalVal > 0) {
                const costVal = totalVal * (pctVal / 100);
                const formattedCost = formatCurrency(costVal);
                setFormData(prev => prev.custo !== formattedCost ? { ...prev, custo: formattedCost } : prev);
            } else {
                setFormData(prev => ({ ...prev, custo: '' }));
            }
        } else {
            setFormData(prev => ({ ...prev, custo: '' }));
        }
    }, [formData.total, formData.marca, formData.produtoId, produtos]);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleProductChange = (e) => {
        const prodId = e.target.value;
        const prod = produtos.find(p => p.id === prodId);
        if (prod) {
            setFormData(prev => ({
                ...prev,
                produtoId: prodId,
                produtoDesc: prod.nome,
                marca: prod.marca,
                total: prod.preco,
                custo: prod.porcentagem ? prev.custo : (prod.custo || '')
            }));
        } else {
            setFormData(prev => ({ ...prev, produtoId: '', produtoDesc: '' }));
        }
    };

    const propagateToFinanceiro = async (vendaId, { total, custo, marca, dataPagamento, dataEntrega, status }) => {
        const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];
        const prefix = vendaId.slice(0, 4);
        const related = safeFinanceiro.filter(f => f.ref && f.ref.includes(prefix));

        for (const item of related) {
            let updates = {};
            if (item.tipo === 'Receita') {
                updates = { valor: total, marca, vencimento: dataPagamento, status: status || 'Pendente' };
            } else if (item.tipo === 'Despesa') {
                updates = { valor: custo, marca, vencimento: dataEntrega, status: status || 'Pendente' }; // Cost due when delivered/cycling
            }
            await updateDoc(doc(db, 'financeiro', item.id), updates);
        }
    };

    // --- Helper to add months ---
    const addMonthsToDate = (dateString, monthsToAdd) => {
        if (!dateString) return '';
        const date = new Date(dateString + 'T12:00:00'); // set mid-day to avoid timezone shifting
        date.setMonth(date.getMonth() + monthsToAdd);
        return date.toISOString().split('T')[0];
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (!formData.cliente) { alert(formData.tipo === 'PGO' ? "Digite um nome para o Pagamento (no campo Cliente)" : "Selecione um cliente!"); setSubmitting(false); return; }

            const payload = { ...formData };

            // Cleanup PGO fields that are irrelevant
            if (payload.tipo === 'PGO') {
                payload.custo = '';
                payload.dataEntrega = '';
                payload.produtoId = '';
                payload.marca = '';
                payload.formaPagamento = '';
                payload.parcelas = '';
                if (!payload.produtoDesc) {
                    payload.produtoDesc = 'Agrupamento / Pagamento';
                }
            }

            let numParcelas = 1;
            // Permits partitioning when a sale is set to 'Parcelamento', handling both new and editing cases.
            if (payload.tipo !== 'PGO' && payload.formaPagamento === 'Parcelamento' && typeof payload.parcelas === 'string') {
                numParcelas = parseInt(payload.parcelas.replace('x', ''), 10) || 1;
            }

            const isParcelamento = numParcelas > 1;
            const operations = []; // promises

            let totalBase = parseCurrency(payload.total);
            let custoBase = payload.custo ? parseCurrency(payload.custo) : 0;

            const instTotal = Math.floor((totalBase / numParcelas) * 100) / 100;
            const instCusto = Math.floor((custoBase / numParcelas) * 100) / 100;

            // Remainder for the first installment to ensure exact sum
            let firstTotal = instTotal + (totalBase - (instTotal * numParcelas));
            let firstCusto = instCusto + (custoBase - (instCusto * numParcelas));

            for (let i = 0; i < numParcelas; i++) {
                const currentTotal = i === 0 ? formatCurrency(firstTotal) : formatCurrency(instTotal);
                const currentCusto = i === 0 ? formatCurrency(firstCusto) : formatCurrency(instCusto);
                const currentPaymentDate = i === 0 ? payload.dataPagamento : addMonthsToDate(payload.dataPagamento, i);

                let currentDesc = payload.produtoDesc || '';
                if (isParcelamento) {
                    currentDesc = `${currentDesc} (Parcela ${i + 1}/${numParcelas})`.trim();
                }

                const instPayload = {
                    ...payload,
                    total: currentTotal,
                    custo: currentCusto,
                    dataPagamento: currentPaymentDate,
                    produtoDesc: currentDesc,
                    formaPagamento: 'Pix',
                    parcelas: '1x',
                    // If creating new installments on an edit, status might be reset for future ones (optional logic)
                    status: i > 0 && saleToEdit ? 'Pendente' : payload.status,
                    dataPago: i > 0 && saleToEdit ? '' : payload.dataPago,
                };

                // Remove embedded document ID to prevent collision bugs when mapped back from Firestore
                if (instPayload.id) delete instPayload.id;

                // If editing and it's the first loop -> Update the existing record
                if (saleToEdit && i === 0) {
                    const docId = saleToEdit.id;
                    operations.push(setDoc(doc(db, 'vendas', docId), instPayload, { merge: true })
                        .then(() => {
                            if (instPayload.tipo !== 'PGO') {
                                return propagateToFinanceiro(docId, instPayload);
                            }
                        }));
                } else {
                    // Create new Venda record
                    operations.push(addDoc(collection(db, 'vendas'), { ...instPayload, timestamp: Date.now() })
                        .then(async (docRef) => {
                            if (instPayload.tipo !== 'PGO') {
                                await addDoc(collection(db, 'financeiro'), {
                                    tipo: 'Receita',
                                    categoria: 'Venda de Produtos',
                                    descricao: `Venda - ${instPayload.cliente}`,
                                    ref: `Venda ${docRef.id.slice(0, 4)} - ${instPayload.cliente}`,
                                    valor: currentTotal,
                                    vencimento: currentPaymentDate,
                                    status: instPayload.status || 'Pendente',
                                    marca: instPayload.marca,
                                    timestamp: Date.now()
                                });
                            }
                        }));
                }
            }

            // Wait for all saves/updates
            console.log("Awaiting all Firestore operations:", operations.length);
            await Promise.all(operations);
            console.log("All operations succeeded.");
            alert(payload.tipo === 'PGO' ? "Pagamento salvo!" : `Venda salva${isParcelamento ? ` em ${numParcelas} parcelas` : ''}!`);
            onClose();
        } catch (error) {
            console.error("Error during handleSubmit saving:", error);
            alert("Erro: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass = "w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-purple transition-colors text-sm";
    const labelClass = "block text-xs text-dark-muted mb-1 font-medium";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Type + Client */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>Tipo</label>
                    <select
                        value={formData.tipo}
                        onChange={(e) => handleChange('tipo', e.target.value)}
                        className={inputClass}
                    >
                        <option value="Venda">Venda</option>
                        <option value="PGO">PGO</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Cliente</label>
                    <input list="clientesList" value={formData.cliente} onChange={(e) => handleChange('cliente', e.target.value)} className={inputClass} placeholder="Nome..." />
                    <datalist id="clientesList">
                        {clientes.map(c => <option key={c.id} value={c.nome} />)}
                    </datalist>
                </div>
            </div>

            {/* Row 2: Brand */}
            {formData.tipo !== 'PGO' && (
                <div>
                    <label className={labelClass}>Marca</label>
                    <select value={formData.marca} onChange={(e) => { handleChange('marca', e.target.value); handleChange('produtoId', ''); }} className={inputClass}>
                        <option value="Natura">Natura</option>
                        <option value="Avon">Avon</option>
                        <option value="Boticário">Boticário</option>
                        <option value="Eudora">Eudora</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>
            )}

            {/* Row 3: Product (filtered by brand) */}
            {formData.tipo !== 'PGO' && (
                <div>
                    <label className={labelClass}>Produto (Ciclo)</label>
                    <select value={formData.produtoId} onChange={handleProductChange} className={inputClass}>
                        <option value="">Selecione...</option>
                        {produtos.filter(p => p.marca === formData.marca).map(p => {
                            const inicio = p.dataInicio ? new Date(p.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
                            const fim = p.dataFim ? new Date(p.dataFim + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
                            const periodo = inicio && fim ? ` • ${inicio} - ${fim}` : '';
                            return <option key={p.id} value={p.id}>Ciclo {p.nome}{periodo}</option>;
                        })}
                    </select>
                </div>
            )}

            {/* Row 4: Price + Cost + Profit */}
            <div className={`grid gap-3 ${formData.tipo === 'PGO' ? 'grid-cols-1' : 'grid-cols-3'}`}>
                <div>
                    <label className={labelClass}>{formData.tipo === 'PGO' ? 'Valor (R$)' : 'Total (R$)'}</label>
                    <input type="text" value={formData.total} onChange={(e) => handleChange('total', e.target.value)} className={inputClass} />
                </div>
                {formData.tipo !== 'PGO' && (
                    <>
                        <div>
                            <label className={labelClass}>
                                Custo (R$) {currentPct > 0 && <span className="text-brand-purple font-bold">({currentPct}%)</span>}
                            </label>
                            <input
                                type="text"
                                value={formData.custo}
                                readOnly
                                className={`${inputClass} bg-dark-surface/50 text-dark-muted cursor-not-allowed`}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>
                                Lucro Líquido
                            </label>
                            <input
                                type="text"
                                value={formData.total && formData.custo ? formatCurrency(parseCurrency(formData.total) - parseCurrency(formData.custo)) : formData.total ? formData.total : ''}
                                readOnly
                                className={`${inputClass} bg-dark-surface/50 ${formData.total && formData.custo && (parseCurrency(formData.total) - parseCurrency(formData.custo)) < 0 ? 'text-brand-pink' : 'text-brand-green'} cursor-not-allowed font-semibold`}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Row 5: Payment Method */}
            {formData.tipo !== 'PGO' && (
                <div className={`grid gap-3 ${formData.formaPagamento === 'Parcelamento' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                        <label className={labelClass}>Forma de Pagamento</label>
                        <select
                            value={formData.formaPagamento}
                            onChange={(e) => {
                                handleChange('formaPagamento', e.target.value);
                                if (e.target.value !== 'Parcelamento') {
                                    handleChange('parcelas', '1x');
                                } else {
                                    handleChange('parcelas', '2x');
                                }
                            }}
                            className={inputClass}
                        >
                            <option value="Pix">Pix</option>
                            <option value="Parcelamento">Parcelamento</option>
                        </select>
                    </div>
                    {formData.formaPagamento === 'Parcelamento' && (
                        <div>
                            <label className={labelClass}>Parcelas</label>
                            <select
                                value={formData.parcelas}
                                onChange={(e) => handleChange('parcelas', e.target.value)}
                                className={inputClass}
                            >
                                <option value="2x">2x</option>
                                <option value="3x">3x</option>
                                <option value="4x">4x</option>
                                <option value="5x">5x</option>
                                <option value="6x">6x</option>
                                <option value="10x">10x</option>
                                <option value="12x">12x</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* Row 6: Dates */}
            <div className={`grid gap-3 ${formData.tipo === 'PGO' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div>
                    <label className={labelClass}>Data {formData.tipo === 'PGO' ? 'do Pagamento' : 'Venda'}</label>
                    <input type="date" value={toInputDate(formData.data)} onChange={(e) => handleChange('data', fromInputDate(e.target.value))} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Previsão Pgto</label>
                    <input type="date" value={formData.dataPagamento} onChange={(e) => handleChange('dataPagamento', e.target.value)} className={inputClass} />
                </div>
                {formData.tipo !== 'PGO' && (
                    <div>
                        <label className={labelClass}>Previsão Entrega</label>
                        <input type="date" value={formData.dataEntrega || ''} onChange={(e) => handleChange('dataEntrega', e.target.value)} className={inputClass} />
                    </div>
                )}
            </div>

            {/* Row 6.5: Payment Status */}
            {formData.tipo !== 'PGO' && (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>Status do Pagamento</label>
                        <select
                            value={formData.status || 'Pendente'}
                            onChange={(e) => {
                                handleChange('status', e.target.value);
                                if (e.target.value === 'Pago' && !formData.dataPago) {
                                    handleChange('dataPago', getLocalISODate());
                                } else if (e.target.value === 'Pendente') {
                                    handleChange('dataPago', '');
                                }
                            }}
                            className={inputClass}
                        >
                            <option value="Pendente">Pendente</option>
                            <option value="Pago">Pago</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Data do Pagamento (Real)</label>
                        <input
                            type="date"
                            value={formData.dataPago || ''}
                            onChange={(e) => handleChange('dataPago', e.target.value)}
                            className={`${inputClass} ${formData.status !== 'Pago' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={formData.status !== 'Pago'}
                        />
                    </div>
                </div>
            )}

            {formData.tipo !== 'PGO' && (
                <div>
                    <label className={labelClass}>Vincular a PGO (Opcional)</label>
                    <select value={formData.pgoId} onChange={(e) => handleChange('pgoId', e.target.value)} className={inputClass}>
                        <option value="">Nenhum</option>
                        {/* Include ONLY Vendas marked as PGO type (these are the ones visible and deletable in the UI) */}
                        {vendas && vendas.filter(v => v.tipo === 'PGO').map(v => <option key={v.id} value={v.id}>{v.cliente} {v.marca ? `(${v.marca})` : ''}</option>)}
                    </select>
                </div>
            )}

            <div className="pt-4 flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-dark-border text-dark-text hover:bg-dark-surface transition-colors" disabled={submitting}>Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-brand-purple text-white font-semibold hover:bg-brand-purple/90 transition-colors shadow-lg shadow-brand-purple/20" disabled={submitting}>
                    {submitting ? 'Salvando...' : 'Salvar Venda'}
                </button>
            </div>
        </form>
    );
};

export default SalesForm;
