import React, { useEffect, useState } from 'react';

const AutumnLeaves = () => {
    const [leaves, setLeaves] = useState([]);

    useEffect(() => {
        // Generate random leaves
        const newLeaves = Array.from({ length: 15 }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            animationDuration: `${10 + Math.random() * 15}s`,
            animationDelay: `${Math.random() * 10}s`,
            opacity: 0.3 + Math.random() * 0.5,
            size: `${20 + Math.random() * 20}px`,
            type: Math.random() > 0.5 ? '🍁' : '🍂',
            rotation: Math.random() * 360,
        }));
        setLeaves(newLeaves);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            <style>
                {`
                @keyframes fall {
                    0% {
                        transform: translateY(-10vh) rotate(0deg);
                    }
                    100% {
                        transform: translateY(110vh) rotate(360deg);
                    }
                }
                `}
            </style>
            {leaves.map((leaf) => (
                <div
                    key={leaf.id}
                    className="absolute top-0 text-brand-orange"
                    style={{
                        left: leaf.left,
                        fontSize: leaf.size,
                        opacity: leaf.opacity,
                        animation: `fall ${leaf.animationDuration} linear ${leaf.animationDelay} infinite`,
                        transform: `rotate(${leaf.rotation}deg)`,
                        filter: 'drop-shadow(0px 4px 6px rgba(120, 53, 15, 0.2))'
                    }}
                >
                    {leaf.type}
                </div>
            ))}
        </div>
    );
};

export default AutumnLeaves;
