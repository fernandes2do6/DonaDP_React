import { Check, X, Warning } from 'phosphor-react';
import React, { useState } from 'react';

const ConfirmAction = ({ actionId, targetId, targetName, title, text, onConfirm, onCancel }) => {
    const [status, setStatus] = useState('idle'); // 'idle' | 'executing' | 'done' | 'cancelled'

    const handleConfirm = async () => {
        setStatus('executing');
        try {
            await onConfirm(actionId, targetId);
            setStatus('done');
        } catch (err) {
            console.error('Erro na confirmação:', err);
            setStatus('idle');
        }
    };

    const handleCancel = () => {
        setStatus('cancelled');
        if (onCancel) onCancel();
    };

    if (status === 'cancelled') {
        return (
            <div className="text-xs text-light-muted italic py-1">
                🚫 Operação cancelada.
            </div>
        );
    }

    if (status === 'done') {
        return (
            <div className="text-xs text-emerald-600 font-medium py-1">
                ✓ Ação concluída.
            </div>
        );
    }

    return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 mt-2 text-sm text-dark-text shadow-sm">
            <div className="flex items-center gap-2 text-red-600 font-semibold mb-1.5 text-xs tracking-wide uppercase">
                <Warning size={16} weight="bold" />
                {title || 'Confirmação Necessária'}
            </div>

            <p className="text-xs text-light-text mb-3 leading-relaxed whitespace-pre-wrap">
                {text}
            </p>

            <div className="flex gap-2">
                <button
                    onClick={handleConfirm}
                    disabled={status === 'executing'}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                    <Check size={14} weight="bold" />
                    {status === 'executing' ? 'Excluindo...' : 'Sim, excluir'}
                </button>
                <button
                    onClick={handleCancel}
                    disabled={status === 'executing'}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-light-surface hover:bg-light-bg border border-light-border active:scale-95 text-light-text font-medium text-xs rounded-lg transition-all cursor-pointer"
                >
                    <X size={14} weight="bold" />
                    Cancelar
                </button>
            </div>
        </div>
    );
};

export default ConfirmAction;
