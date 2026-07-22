import Cookies from 'js-cookie';

const ACCESS_TOKEN_KEY = 'accessToken';

export const tokenUtils = {
    getAccess: () => Cookies.get(ACCESS_TOKEN_KEY),

    setAccess: (token: string) =>
        Cookies.set(ACCESS_TOKEN_KEY, token, {
            expires: 1 / 24,    // 1 hour
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
        }),

    clearAll: () => {
        Cookies.remove(ACCESS_TOKEN_KEY);
    },
};