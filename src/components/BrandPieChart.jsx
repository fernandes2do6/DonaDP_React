import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const BrandPieChart = ({ data }) => {
    const counts = {
        'Natura': 0,
        'Avon': 0,
        'Boticário': 0,
        'Eudora': 0
    };

    data.forEach(item => {
        const brand = item.marca || 'Outros';
        if (counts[brand] !== undefined) {
            counts[brand]++;
        }
    });

    // Brand Colors matched to Tailwind config
    const brandColors = {
        'Natura': '#8B5CF6', // brand-purple
        'Avon': '#10B981',   // brand-green
        'Boticário': '#EC4899', // brand-pink
        'Eudora': '#F59E0B'  // amber-500 (custom)
    };

    const chartData = {
        labels: Object.keys(counts),
        datasets: [
            {
                data: Object.values(counts),
                backgroundColor: Object.keys(counts).map(brand => brandColors[brand]),
                borderWidth: 0,
                hoverOffset: 20,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    color: '#F8FAFC', // dark-text
                    font: {
                        family: 'Inter',
                        size: 12
                    },
                    usePointStyle: true,
                    padding: 20
                }
            }
        },
        layout: {
            padding: 10
        }
    };

    return (
        <div className="w-full h-64">
            <Pie data={chartData} options={options} />
        </div>
    );
};

export default BrandPieChart;
