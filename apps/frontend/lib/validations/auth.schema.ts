import { Locale } from '@/app/[lang]/dictionaries'
import { z } from 'zod'

export const loginSchema = (t: (key: string) => string) =>
    z.object({
        email: z
            .string()
            .min(1, t('Login.Errors.EmailRequired'))
            .email(t('Login.Errors.EmailInvalid')),
        password: z
            .string()
            .min(1, t('Login.Errors.PasswordRequired'))
            .min(6, t('Login.Errors.PasswordMin')),
    });

export const registerSchema = (t: (key: string) => string) =>
    z.object({
        email: z
            .string()
            .min(1, t('Register.Errors.EmailRequired'))
            .email(t('Register.Errors.EmailInvalid')),
        password: z
            .string()
            .min(1, t('Register.Errors.PasswordRequired'))
            .min(6, t('Register.Errors.PasswordMin')),
        confirmPassword: z
            .string()
            .min(1, t('Register.Errors.ConfirmPasswordRequired'))
            .min(6, t('Register.Errors.ConfirmPasswordMin')),
    }).refine((data) => data.password === data.confirmPassword, {
        message: t('Register.Errors.PasswordsDoNotMatch'),
        path: ["confirmPassword"],
    })

export type LoginFormValues = z.infer<ReturnType<typeof loginSchema>>
export type RegisterFormValues = z.infer<ReturnType<typeof registerSchema>>