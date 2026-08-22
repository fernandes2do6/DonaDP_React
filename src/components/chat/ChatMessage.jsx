import React from 'react';
import { Robot, User, CheckCircle, WarningCircle, Sparkle, Tag, ShoppingBag, Users } from 'phosphor-react';
import ConfirmAction from './ConfirmAction';

// Formatador simples de markdown inline (*italico*, **negrito**, `codigo`)
const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');

    return lines.map((line, lIdx) => {
        // Divide por tokens markdown
        const parts = line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

        return (
            <React.Fragment key={lIdx}>
                {parts.map((part, pIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={pIdx} className="font-semibold text-light-text">{part.slice(2, -2)}</strong>;
                    }
                    if (part.startsWith('*') && part.endsWith('*')) {
                        return <em key={pIdx} className="text-light-muted">{part.slice(1, -1)}</em>;
                    }
                    if (part.startsWith('`') && part.endsWith('`')) {
                        return (
                            <code key={pIdx} className="bg-brand-brown/10 text-brand-orange px-1 py-0.5 rounded text-[11px] font-mono">
                                {part.slice(1, -1)}
                            </code>
                        );
                    }
                    return part;
                })}
                {lIdx < lines.length - 1 && <br />}
            </React.Fragment>
        );
    });
};

const ChatMessage = ({ message, onConfirmAction, onActionClick }) => {
    const isUser = message.sender === 'user';

    return (
        <div className={`flex gap-2.5 my-2.5 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}>
            {/* Avatar Assistente */}
            {!isUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-orange to-brand-yellow flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                    <Sparkle size={16} weight="fill" />
                </div>
            )}

            <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                isUser
                    ? 'bg-gradient-to-r from-brand-orange to-amber-600 text-white rounded-tr-none'
                    : 'bg-light-surface/90 border border-light-border text-light-text rounded-tl-none backdrop-blur-sm'
            }`}>
                {/* 1. Mensagem de Texto Padrão */}
                {message.type === 'text' && (
                    <div className="whitespace-pre-wrap">
                        {renderFormattedText(message.text)}
                    </div>
                )}

                {/* 2. Sucesso */}
                {message.type === 'success' && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs uppercase tracking-wide">
                            <CheckCircle size={16} weight="bold" />
                            {message.title || 'Sucesso'}
                        </div>
                        <div className="whitespace-pre-wrap text-light-text">
                            {renderFormattedText(message.text)}
                        </div>
                    </div>
                )}

                {/* 3. Erro */}
                {message.type === 'error' && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-red-500 font-bold text-xs uppercase tracking-wide">
                            <WarningCircle size={16} weight="bold" />
                            {message.title || 'Aviso'}
                        </div>
                        <div className="whitespace-pre-wrap text-light-text">
                            {renderFormattedText(message.text)}
                        </div>
                    </div>
                )}

                {/* 4. Card / DRE / Resumo Financeiro */}
                {message.type === 'card' && (
                    <div className="space-y-2">
                        {message.title && (
                            <div className="font-bold text-brand-orange border-b border-light-border/60 pb-1 text-xs sm:text-sm">
                                {message.title}
                            </div>
                        )}
                        <div className="whitespace-pre-wrap text-light-text font-mono sm:font-sans text-[11px] sm:text-xs leading-relaxed">
                            {renderFormattedText(message.text)}
                        </div>
                    </div>
                )}

                {/* 5. Lista de Clientes */}
                {message.type === 'client_list' && (
                    <div className="space-y-2">
                        <p className="font-semibold text-light-text">{renderFormattedText(message.text)}</p>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                            {message.items.map((c) => (
                                <div
                                    key={c.id}
                                    onClick={() => onActionClick && onActionClick(`Buscar cliente ${c.nome}`)}
                                    className="p-2 rounded-xl bg-light-bg/70 hover:bg-brand-orange/10 border border-light-border/60 flex items-center justify-between cursor-pointer transition-all active:scale-98"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-brand-orange/20 text-brand-orange flex items-center justify-center font-bold text-[10px]">
                                            {c.nome.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-xs text-light-text">{c.nome}</div>
                                            <div className="text-[10px] text-light-muted">{c.whatsapp}</div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-brand-orange font-semibold">Ver ➔</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 6. Lista de Vendas */}
                {message.type === 'sales_list' && (
                    <div className="space-y-2">
                        <p className="font-semibold text-light-text">{renderFormattedText(message.text)}</p>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                            {message.items.map((s) => (
                                <div
                                    key={s.id}
                                    onClick={() => onActionClick && onActionClick(`Vendas do ${s.cliente}`)}
                                    className="p-2 rounded-xl bg-light-bg/70 hover:bg-brand-orange/10 border border-light-border/60 flex items-center justify-between cursor-pointer transition-all active:scale-98"
                                >
                                    <div className="min-w-0 pr-2">
                                        <div className="font-medium text-xs text-light-text truncate">{s.cliente}</div>
                                        <div className="text-[10px] text-light-muted flex items-center gap-1.5">
                                            <span>{s.produto}</span>
                                            {s.data && <span>• {s.data}</span>}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-bold text-xs text-brand-orange">{s.total}</div>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                            s.status === 'Pago'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {s.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {message.hasMore > 0 && (
                            <p className="text-[10px] text-light-muted italic text-center">
                                ... e mais {message.hasMore} registro(s)
                            </p>
                        )}
                    </div>
                )}

                {/* 7. Lista de Ciclos / Produtos */}
                {message.type === 'product_list' && (
                    <div className="space-y-2">
                        <p className="font-semibold text-light-text">{renderFormattedText(message.text)}</p>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                            {message.items.map((p) => (
                                <div key={p.id} className="p-2 rounded-xl bg-light-bg/70 border border-light-border/60 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-xs text-light-text">{p.nome}</div>
                                        <div className="text-[10px] text-light-muted">{p.marca} {p.porcentagem ? `• Margem: ${p.porcentagem}` : ''}</div>
                                    </div>
                                    {p.fim && (
                                        <div className="text-[10px] text-light-muted text-right">
                                            Fim: {p.fim}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {message.hasMore > 0 && (
                            <p className="text-[10px] text-light-muted italic text-center">
                                ... e mais {message.hasMore} ciclo(s)
                            </p>
                        )}
                    </div>
                )}

                {/* 8. Widget de Confirmação */}
                {message.type === 'confirm' && (
                    <ConfirmAction
                        actionId={message.actionId}
                        targetId={message.targetId}
                        targetName={message.targetName}
                        title={message.title}
                        text={message.text}
                        onConfirm={onConfirmAction}
                        onCancel={() => onActionClick && onActionClick('Cancelado pelo usuário')}
                    />
                )}

                {/* Horário */}
                <div className={`text-[9px] mt-1.5 text-right ${isUser ? 'text-white/70' : 'text-light-muted'}`}>
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
            </div>

            {/* Avatar Usuário */}
            {isUser && (
                <div className="w-8 h-8 rounded-full bg-light-surface border border-light-border flex items-center justify-center text-brand-orange shrink-0 shadow-sm mt-0.5">
                    <User size={16} weight="bold" />
                </div>
            )}
        </div>
    );
};

export default ChatMessage;
