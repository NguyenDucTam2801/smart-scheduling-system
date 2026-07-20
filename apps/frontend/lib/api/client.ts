import axios from 'axios';

export const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ── Request interceptor — attach access token ──────────────────────
apiClient.interceptors.request.use((config) => {
    // read token from cookie
    if (typeof document !== 'undefined') {
        const token = document.cookie
            .split('; ')
            .find(row => row.startsWith('refreshToken='))
            ?.split('=')[1];

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// ── Response interceptor — handle errors globally ──────────────────
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        return Promise.reject(error);
    }
);