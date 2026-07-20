import { create } from 'zustand';

export type UserRole = 'USER' | 'ADMIN' | 'SUPERADMIN';

interface AuthUser {
    sub: string;
    email: string;
    role: UserRole;
}

interface AuthState {
    user: AuthUser | null;
    isAuth: boolean;
    setUser: (user: AuthUser) => void;
    clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuth: false,

    setUser: (user) => set({ user, isAuth: true }),
    clear: () => set({ user: null, isAuth: false }),
}));