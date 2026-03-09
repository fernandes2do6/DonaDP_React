import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const brandColors = {
    'Natura': '#8B5CF6',
    'Avon': '#10B981',
    'Boticário': '#EC4899',
    'Eudora': '#F59E0B'
};

const BrandPieChart = ({ data, onBrandClick, selectedBrands = [] }) => {
    const counts = { 'Natura': 0, 'Avon': 0, 'Boticário': 0, 'Eudora': 0 };
    data.forEach(item => {
        const brand = item.marca || 'Outros';
        if (counts[brand] !== undefined) counts[brand]++;
    });

    const chartData = {
        labels: Object.keys(counts),
        datasets: [{
            data: Object.values(counts),
            backgroundColor: Object.keys(counts).map(b => brandColors[b]),
            borderWidth: 0,
            hoverOffset: 20,
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        layout: { padding: 10 }
    };

    const hasSelection = selectedBrands.length > 0;

    return (
        <div className="flex items-center gap-4">
            <div className="w-40 h-40 flex-shrink-0">
                <Pie data={chartData} options={options} />
            </div>
            <div className="flex flex-col gap-2">
                {Object.keys(counts).map(brand => {
                    const isSelected = selectedBrands.includes(brand);
                    return (
                        <button
                            key={brand}
                            onClick={() => onBrandClick && onBrandClick(brand)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${isSelected
                                    ? 'bg-white/10 ring-1 ring-white/20 scale-105'
                                    : hasSelection
                                        ? 'opacity-40 hover:opacity-70'
                                        : 'hover:bg-white/5'
                                }`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: brandColors[brand] }} />
                            <span className="text-dark-text">{brand}</span>
                            <span className="text-dark-muted ml-auto">({counts[brand]})</span>
                        </button>
                    );
                })}
                {hasSelection && (
                    <button
                        onClick={() => onBrandClick && onBrandClick(null)}
                        className="text-[10px] text-brand-purple hover:text-white transition-colors text-center mt-1"
                    >
                        Limpar filtro
                    </button>
                )}
            </div>
        </div>
    );
};

export default BrandPieChart;
