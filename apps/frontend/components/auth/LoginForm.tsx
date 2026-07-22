'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth.schema';
import { useLogin } from '@/hooks/auth/useLogin';
import { Controller } from 'react-hook-form';

interface LoginFormDictionaryErrors {
    EmailRequired: string;
    EmailInvalid: string;
    PasswordRequired: string;
    PasswordMin: string;
    InvalidCredentials: string;
    Generic: string;
}

interface LoginFormDictionary {
    Email: string;
    EmailPlaceholder: string;
    Password: string;
    PasswordPlaceholder: string;
    Submit: string;
    Loading: string;
    Errors: LoginFormDictionaryErrors;
}

interface LoginFormProps {
    lang: string;
    dict: LoginFormDictionary;
}

export function LoginForm({ lang, dict }: LoginFormProps) {
    const [showPassword, setShowPassword] = useState<boolean>(false);

    const schema = loginSchema((key: string) => {
        // map zod error keys back to dict
        const map: Record<string, string> = {
            'Login.Errors.EmailRequired': dict.Errors.EmailRequired,
            'Login.Errors.EmailInvalid': dict.Errors.EmailInvalid,
            'Login.Errors.PasswordRequired': dict.Errors.PasswordRequired,
            'Login.Errors.PasswordMin': dict.Errors.PasswordMin,
        };
        return map[key] ?? key;
    });

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: '', password: '' },
    });

    const { login, isLoading } = useLogin({
        lang,
        errorMessages: {
            invalidCredentials: dict.Errors.InvalidCredentials,
            generic: dict.Errors.Generic,
        },
    });

    return (
        <form
            onSubmit={form.handleSubmit(login)}
            className="space-y-4"
            noValidate
        >
            <FieldGroup>
                {/* Email */}
                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={field.name}>{dict.Email}</FieldLabel>
                            <Input
                                {...field}
                                id={field.name}
                                type="email"
                                placeholder={dict.EmailPlaceholder}
                                autoComplete="email"
                                disabled={isLoading}
                                aria-invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                {/* Password */}
                <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={field.name}>{dict.Password}</FieldLabel>
                            <div className="relative">
                                <Input
                                    {...field}
                                    id={field.name}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={dict.PasswordPlaceholder}
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                    aria-invalid={fieldState.invalid}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((p) => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                                    ) : (
                                        <Eye className="h-4 w-4" aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
            </FieldGroup>

            {/* Submit */}
            <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        {dict.Loading}
                    </>
                ) : (
                    dict.Submit
                )}
            </Button>
        </form>
    );
}