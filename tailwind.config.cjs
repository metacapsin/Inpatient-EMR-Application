/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        container: {
            center: true,
        },
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#97704f',
                    50: '#faf7f5',
                    100: '#f0e9e4',
                    200: '#e0d4c9',
                    300: '#c9b5a3',
                    400: '#b0967d',
                    500: '#97704f',
                    600: '#856345',
                    700: '#73563b',
                    800: '#614931',
                    900: '#4f3c28',
                    light: '#f0e9e4',
                    'dark-light': 'rgba(151,112,79,.15)',
                },
                secondary: {
                    DEFAULT: '#b0967d',
                    light: '#f0e9e4',
                    'dark-light': 'rgba(151,112,79,.15)',
                },
                success: {
                    DEFAULT: '#856345',
                    light: '#f0e9e4',
                    'dark-light': 'rgba(151,112,79,.15)',
                },
                danger: {
                    DEFAULT: '#73563b',
                    light: '#f0e9e4',
                    'dark-light': 'rgba(151,112,79,.2)',
                },
                warning: {
                    DEFAULT: '#97704f',
                    light: '#f0e9e4',
                    'dark-light': 'rgba(151,112,79,.15)',
                },
                info: {
                    DEFAULT: '#97704f',
                    light: '#f0e9e4',
                    'dark-light': 'rgba(151,112,79,.15)',
                },
                dark: {
                    DEFAULT: '#3b3f5c',
                    light: '#eaeaec',
                    'dark-light': 'rgba(59,63,92,.15)',
                },
                black: {
                    DEFAULT: '#0e1726',
                    light: '#e3e4eb',
                    'dark-light': 'rgba(14,23,38,.15)',
                },
                white: {
                    DEFAULT: '#ffffff',
                    light: '#e0e6ed',
                    dark: '#888ea8',
                },
            },
            fontFamily: {
                nunito: ['Nunito', 'sans-serif'],
            },
            spacing: {
                4.5: '18px',
            },
            boxShadow: {
                '3xl': '0 2px 2px rgb(224 230 237 / 46%), 1px 6px 7px rgb(224 230 237 / 46%)',
                'primary': '0 4px 14px 0 rgba(151, 112, 79, 0.25)',
                'primary-lg': '0 8px 24px -4px rgba(151, 112, 79, 0.2), 0 4px 8px -2px rgba(151, 112, 79, 0.1)',
                'equal': '0 0 15px rgba(151, 112, 79, 0.08)',
                'equal-lg': '0 0 24px rgba(151, 112, 79, 0.12)',
            },
            keyframes: {
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in-down': {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
                'fade-in-down': 'fade-in-down 0.4s ease-out forwards',
            },
            typography: ({ theme }) => ({
                DEFAULT: {
                    css: {
                        '--tw-prose-invert-headings': theme('colors.white.dark'),
                        '--tw-prose-invert-links': theme('colors.white.dark'),
                        h1: { fontSize: '40px', marginBottom: '0.5rem', marginTop: 0 },
                        h2: { fontSize: '32px', marginBottom: '0.5rem', marginTop: 0 },
                        h3: { fontSize: '28px', marginBottom: '0.5rem', marginTop: 0 },
                        h4: { fontSize: '24px', marginBottom: '0.5rem', marginTop: 0 },
                        h5: { fontSize: '20px', marginBottom: '0.5rem', marginTop: 0 },
                        h6: { fontSize: '16px', marginBottom: '0.5rem', marginTop: 0 },
                        p: { marginBottom: '0.5rem' },
                        li: { margin: 0 },
                        img: { margin: 0 },
                    },
                },
            }),
        },
    },
    plugins: [
        require('@tailwindcss/forms')({
            strategy: 'class',
        }),
        require('@tailwindcss/typography'),
    ],
};
