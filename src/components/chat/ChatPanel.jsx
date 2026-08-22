import React, { useState, useEffect, useRef } from 'react';
import { X, PaperPlaneRight, Sparkle, Trash, ArrowsClockwise } from 'phosphor-react';
import { useData } from '../../contexts/DataContext';
import { processChatMessage, executeConfirmedAction } from '../../services/chat/chatEngine';
import { formatters } from '../../services/chat/responseFormatter';
import ChatMessage from './ChatMessage';

const QUICK_SUGGESTIONS = [
    { label: '👥 Clientes', prompt: 'Listar clientes' },
    { label: '⏳ Vendas Pendentes', prompt: 'Vendas pendentes' },
    { label: '💰 Saldo Financeiro', prompt: 'Saldo financeiro' },
    { label: '🚨 Cobranças Atrasadas', prompt: 'Cobranças atrasadas' },
    { label: '📊 DRE do Mês', prompt: 'Relatório do mês' },
    { label: '📦 Ciclos Ativos', prompt: 'Ciclos ativos' },
    { label: '❓ Ajuda', prompt: 'Ajuda' }
];

const ChatPanel = ({ isOpen, onClose }) => {
    const contextData = useData();
    const [messages, setMessages] = useState(() => [
        {
            id: 'welcome',
            sender: 'bot',
            ...formatters.welcomeMessage(),
            timestamp: Date.now()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto scroll para o final das mensagens
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, messages]);

    const handleSendMessage = async (textToSend) => {
        const text = (textToSend || inputValue).trim();
        if (!text || isTyping) return;

        const userMsg = {
            id: `user_${Date.now()}`,
            sender: 'user',
            type: 'text',
            text: text,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        if (!textToSend) setInputValue('');
        setIsTyping(true);

        try {
            // Processa via ChatEngine
            const botResponse = await processChatMessage(text, contextData);
            const botMsg = {
                id: `bot_${Date.now()}`,
                sender: 'bot',
                ...botResponse,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            console.error('Erro ao enviar mensagem:', err);
            setMessages(prev => [
                ...prev,
                {
                    id: `bot_err_${Date.now()}`,
                    sender: 'bot',
                    type: 'error',
                    title: 'Ops! Ocorreu um erro',
                    text: 'Não consegui processar essa mensagem. Tente novamente.',
                    timestamp: Date.now()
                }
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleConfirmAction = async (actionId, targetId) => {
        setIsTyping(true);
        try {
            const result = await executeConfirmedAction(actionId, targetId, contextData);
            setMessages(prev => [
                ...prev,
                {
                    id: `bot_action_${Date.now()}`,
                    sender: 'bot',
                    ...result,
                    timestamp: Date.now()
                }
            ]);
        } catch (err) {
            console.error('Erro na ação confirmada:', err);
        } finally {
            setIsTyping(false);
        }
    };

    const handleClearChat = () => {
        setMessages([
            {
                id: 'welcome_reset',
                sender: 'bot',
                ...formatters.welcomeMessage(),
                timestamp: Date.now()
            }
        ]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop escuro para fechar ao clicar fora */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Painel lateral deslizante */}
            <div className="relative w-full max-w-md h-full bg-light-surface border-l border-light-border shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
                {/* Header do Chat */}
                <header className="h-16 px-4 border-b border-light-border/80 flex items-center justify-between bg-light-bg/80 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-orange to-brand-yellow flex items-center justify-center text-white shadow-md shadow-brand-orange/20">
                            <Sparkle size={20} weight="fill" />
                        </div>
                        <div>
                            <h2 className="font-bold text-sm text-light-text flex items-center gap-1.5">
                                Assistente Dona D&P
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                            </h2>
                            <p className="text-[10px] text-light-muted">Controle tudo por conversa</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleClearChat}
                            title="Limpar histórico"
                            className="p-2 text-light-muted hover:text-brand-orange hover:bg-light-bg rounded-lg transition-colors cursor-pointer"
                        >
                            <Trash size={18} />
                        </button>
                        <button
                            onClick={onClose}
                            title="Fechar chat"
                            className="p-2 text-light-muted hover:text-dark-text hover:bg-light-bg rounded-lg transition-colors cursor-pointer"
                        >
                            <X size={20} weight="bold" />
                        </button>
                    </div>
                </header>

                {/* Sugestões Rápidas (Chips) */}
                <div className="px-3 py-2 bg-light-bg/50 border-b border-light-border/50 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                    {QUICK_SUGGESTIONS.map((sug, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSendMessage(sug.prompt)}
                            className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-light-surface border border-light-border hover:border-brand-orange/50 hover:bg-brand-orange/5 text-light-text whitespace-nowrap transition-all active:scale-95 cursor-pointer shadow-2xs"
                        >
                            {sug.label}
                        </button>
                    ))}
                </div>

                {/* Lista de Mensagens */}
                <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar space-y-1">
                    {messages.map((msg) => (
                        <ChatMessage
                            key={msg.id}
                            message={msg}
                            onConfirmAction={handleConfirmAction}
                            onActionClick={handleSendMessage}
                        />
                    ))}

                    {/* Indicador de Digitação */}
                    {isTyping && (
                        <div className="flex items-center gap-2 text-light-muted text-xs py-2 px-1">
                            <div className="w-6 h-6 rounded-full bg-brand-orange/20 flex items-center justify-center text-brand-orange animate-spin">
                                <ArrowsClockwise size={14} />
                            </div>
                            <span>Processando sua solicitação...</span>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Campo de Entrada de Mensagem */}
                <div className="p-3 bg-light-surface border-t border-light-border shrink-0">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSendMessage();
                        }}
                        className="flex items-center gap-2"
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Digite um comando ou dúvida... (ex: listar clientes)"
                            className="flex-1 bg-light-bg border border-light-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-light-text placeholder:text-light-muted/70 focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/30 transition-all"
                            disabled={isTyping}
                        />
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || isTyping}
                            className="w-10 h-10 rounded-xl bg-gradient-to-r from-brand-orange to-brand-yellow text-white flex items-center justify-center shadow-md shadow-brand-orange/20 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all cursor-pointer shrink-0"
                            title="Enviar mensagem"
                        >
                            <PaperPlaneRight size={18} weight="fill" />
                        </button>
                    </form>
                    <p className="text-[10px] text-light-muted/80 text-center mt-1.5">
                        Dica: Você pode digitar livremente para criar vendas, buscar clientes ou consultar saldos.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
