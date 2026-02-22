/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                dark: {
                    bg: '#0F172A',
                    surface: '#1E293B',
                    text: '#F8FAFC',
                    muted: '#94A3B8',
                    border: '#334155'
                },
                brand: {
                    purple: '#8B5CF6',
                    green: '#10B981',
                    pink: '#EC4899'
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
