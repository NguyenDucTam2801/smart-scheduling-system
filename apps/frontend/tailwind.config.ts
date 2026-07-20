// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
    // theme: {
    //     extend: {
    //         colors: {
    //             primary: "#FF5733",
    //         },
    //     },
    // },
    plugins: [],
    darkMode: "class", // or 'media' or 'class'
};

export default config;