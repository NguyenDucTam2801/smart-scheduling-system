import { Locale } from "@/app/[lang]/dictionaries";
import { useLogin } from "@/hooks/auth/useLogin";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';

interface LoginFormProps {
    local?: Locale
}

export default function LoginForm({ local }: LoginFormProps) {
    const { form, isLoading, onSubmit } = useLogin(local || "en")

    return (
        <Form
    )

}