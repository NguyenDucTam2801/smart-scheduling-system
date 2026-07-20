import { Locale } from '@/app/[lang]/dictionaries'
import { z } from 'zod'

export const loginSchema = (locale: Locale = "en") => {
    const isEn = locale === "en"
    return z.object({
        email: z
            .string()
            .min(1, { message: isEn ? "Email is required" : "Email là bắt buộc" })
            .email({ message: isEn ? "Invalid email address" : "Địa chỉ email không hợp lệ" }),
        password: z
            .string()
            .min(1, { message: isEn ? "Password is required" : "Mật khẩu là bắt buộc" })
            .min(6, { message: isEn ? "Password must be at least 6 characters" : "Mật khẩu phải có ít nhất 6 ký tự" }),
    })
}

export const registerSchema = (locale: Locale = "en") => {
    const isEn = locale === "en"
    return z.object({
        email: z
            .string()
            .min(1, { message: isEn ? "Email is required" : "Email là bắt buộc" })
            .email({ message: isEn ? "Invalid email address" : "Địa chỉ email không hợp lệ" }),
        password: z
            .string()
            .min(1, { message: isEn ? "Password is required" : "Mật khẩu là bắt buộc" })
            .min(6, { message: isEn ? "Password must be at least 6 characters" : "Mật khẩu phải có ít nhất 6 ký tự" }),
        confirmPassword: z
            .string()
            .min(1, { message: isEn ? "Confirm password is required" : "Xác nhận mật khẩu là bắt buộc" })
            .min(6, { message: isEn ? "Confirm password must be at least 6 characters" : "Xác nhận mật khẩu phải có ít nhất 6 ký tự" }),
    }).refine((data) => data.password === data.confirmPassword, {
        message: isEn ? "Passwords do not match" : "Mật khẩu không khớp",
        path: ["confirmPassword"],
    })
}

export type LoginInput = z.infer<ReturnType<typeof loginSchema>>
export type RegisterInput = z.infer<ReturnType<typeof registerSchema>>