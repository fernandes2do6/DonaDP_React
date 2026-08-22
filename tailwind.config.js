/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                light: {
                    bg: '#FAF9F6',
                    surface: '#FFFFFF',
                    text: '#43302B',
                    muted: '#8C7A6B',
                    border: '#E5E0D8'
                },
                brand: {
                    orange: '#EA580C',
                    yellow: '#EAB308',
                    brown: '#78350F',
                    green: '#10B981'
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
