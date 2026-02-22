import { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { parseCurrency, formatCurrency } from '../utils/formatters';
import { addDoc, collection, setDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const SalesForm = ({ saleToEdit, onClose }) => {
    const { clientes, produtos, financeiro, pgos } = useData();

    // ── DATE HELPERS ──────────────────────────────────────────────────────────
    const toInputDate = (d) => {
        if (!d) return new Date().toISOString().split('T')[0];
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
    const todayISO = new Date().toISOString().split('T')[0];

    // ── STATE ──────────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        tipo: 'Venda',
        cliente: '',
        produtoId: '',
        produtoDesc: '',
        marca: 'Natura',
        total: '',
        custo: '',
        formaPagamento: 'Pix',
        data: fromInputDate(todayISO),
        dataPagamento: todayISO,
        dataEntrega: todayISO,
        parcelas: '1x',
        pgoId: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (saleToEdit) {
            setFormData({
                ...saleToEdit,
                produtoId: saleToEdit.produtoId || '',
                parcelas: saleToEdit.parcelas || '1x',
                data: saleToEdit.data || fromInputDate(todayISO)
            });
        }
    }, [saleToEdit]);

    // Cost Calculation Logic
    const CUSTO_PERCENTUAL = 30;
    useEffect(() => {
        if (formData.total) {
            const totalVal = parseCurrency(formData.total);
            if (!isNaN(totalVal) && totalVal > 0) {
                let pctVal = CUSTO_PERCENTUAL;
                if (formData.produtoId) {
                    const prod = produtos.find(p => p.id === formData.produtoId);
                    if (prod && prod.porcentagem) pctVal = parseFloat(prod.porcentagem);
                }
                const costVal = totalVal * (pctVal / 100);
                const formattedCost = formatCurrency(costVal);
                setFormData(prev => prev.custo !== formattedCost ? { ...prev, custo: formattedCost } : prev);
            }
        }
    }, [formData.total, formData.produtoId, produtos]);

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

    const propagateToFinanceiro = async (vendaId, { total, custo, marca, dataPagamento, dataEntrega }) => {
        const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];
        const prefix = vendaId.slice(0, 4);
        const related = safeFinanceiro.filter(f => f.ref && f.ref.includes(prefix));

        for (const item of related) {
            let updates = {};
            if (item.tipo === 'Receita') {
                updates = { valor: total, marca, vencimento: dataPagamento };
            } else if (item.tipo === 'Despesa') {
                updates = { valor: custo, marca, vencimento: dataEntrega }; // Cost due when delivered/cycling
            }
            await updateDoc(doc(db, 'financeiro', item.id), updates);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (!formData.cliente) { alert("Selecione um cliente!"); setSubmitting(false); return; }

            const payload = { ...formData };
            let docId = saleToEdit?.id;

            if (saleToEdit) {
                await setDoc(doc(db, 'vendas', docId), payload, { merge: true });
                await propagateToFinanceiro(docId, payload);
                alert("Venda atualizada!");
            } else {
                const docRef = await addDoc(collection(db, 'vendas'), { ...payload, timestamp: Date.now() });
                docId = docRef.id;

                // Create Financeiro Record
                await addDoc(collection(db, 'financeiro'), {
                    tipo: 'Receita',
                    categoria: 'Venda de Produtos',
                    descricao: `Venda - ${formData.cliente}`,
                    ref: `Venda ${docRef.id.slice(0, 4)} - ${formData.cliente}`,
                    valor: formData.total,
                    vencimento: formData.dataPagamento,
                    status: 'Pendente',
                    marca: formData.marca,
                    timestamp: Date.now()
                });
                alert("Venda salva!");
            }
            onClose();
        } catch (error) {
            console.error(error);
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

            {/* Row 2: Product Select + Desc */}
            <div>
                <label className={labelClass}>Produto (Ciclo)</label>
                <select value={formData.produtoId} onChange={handleProductChange} className={inputClass}>
                    <option value="">Selecione...</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} - {formatCurrency(p.preco)}</option>)}
                </select>
            </div>
            <div>
                <label className={labelClass}>Descrição (Personalizada)</label>
                <input type="text" value={formData.produtoDesc} onChange={(e) => handleChange('produtoDesc', e.target.value)} className={inputClass} />
            </div>

            {/* Row 3: Brand + Price + Cost */}
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className={labelClass}>Marca</label>
                    <select value={formData.marca} onChange={(e) => handleChange('marca', e.target.value)} className={inputClass}>
                        <option value="Natura">Natura</option>
                        <option value="Avon">Avon</option>
                        <option value="Boticário">Boticário</option>
                        <option value="Eudora">Eudora</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Total (R$)</label>
                    <input type="text" value={formData.total} onChange={(e) => handleChange('total', e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Custo (R$)</label>
                    <input type="text" value={formData.custo} onChange={(e) => handleChange('custo', e.target.value)} className={inputClass} />
                </div>
            </div>

            {/* Row 4: Dates & Payment */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>Data Venda</label>
                    <input type="text" value={formData.data} readOnly className={`${inputClass} opacity-50 cursor-not-allowed`} />
                </div>
                <div>
                    <label className={labelClass}>Previsão Pgto</label>
                    <input type="date" value={formData.dataPagamento} onChange={(e) => handleChange('dataPagamento', e.target.value)} className={inputClass} />
                </div>
            </div>

            <div>
                <label className={labelClass}>Vincular a PGO (Opcional)</label>
                <select value={formData.pgoId} onChange={(e) => handleChange('pgoId', e.target.value)} className={inputClass}>
                    <option value="">Nenhum</option>
                    {pgos && pgos.filter(p => p.status === 'Aberto').map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
            </div>

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
