const GlassCard = ({ children, className = '', onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`glass-card p-5 ${className} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
        >
            {children}
        </div>
    );
};

export default GlassCard;
