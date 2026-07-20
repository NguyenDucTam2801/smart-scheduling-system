import { apiClient } from './client';

export interface LoginPayload {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
}

export const authApi = {
    login: async (payload: LoginPayload): Promise<LoginResponse> => {
        const res = await apiClient.post<LoginResponse>('/auth/login', payload);
        return res.data;
    },
};