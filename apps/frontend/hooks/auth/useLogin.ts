'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { jwtDecode } from 'jwt-decode';
import { authApi } from '@/lib/api/auth.api';
import { tokenUtils } from '@/lib/utils/token';
import { useAuthStore } from '@/store/auth.store';
import type { LoginFormValues } from '@/lib/validations/auth.schema';

interface JwtPayload {
    sub: string;
    email: string;
    role: 'USER' | 'ADMIN' | 'SUPERADMIN';
}

interface UseLoginOptions {
    lang: string;
    errorMessages: {
        invalidCredentials: string;
        generic: string;
    };
}

export function useLogin({ lang, errorMessages }: UseLoginOptions) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const setUser = useAuthStore(s => s.setUser);

    const login = async (values: LoginFormValues) => {
        setIsLoading(true);
        try {
            const { accessToken } = await authApi.login(values);

            // save token
            tokenUtils.setAccess(accessToken);

            // decode and save user to store
            const decoded = jwtDecode<JwtPayload>(accessToken);
            setUser({ sub: decoded.sub, email: decoded.email, role: decoded.role });

            // redirect to dashboard
            router.push(`/${lang}/dashboard`);

        } catch (error: any) {
            const status = error?.response?.status;

            if (status === 401) {
                toast.error(errorMessages.invalidCredentials);
            } else {
                toast.error(errorMessages.generic);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return { login, isLoading };
}