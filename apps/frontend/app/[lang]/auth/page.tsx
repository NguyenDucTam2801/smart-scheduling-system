import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDictionary, hasLocale } from '../dictionaries';
import { LoginForm } from '@/components/auth/LoginForm';
import { CalendarDays } from 'lucide-react';

interface LoginPageProps {
  params: Promise<{ lang: string }>;
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : 'en';
  const dict = await getDictionary(locale);

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo / brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Smart Scheduling
          </h1>
        </div>

        {/* Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">
              {dict.Login.Title}
            </CardTitle>
            <CardDescription>
              {dict.Login.Subtitle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm lang={locale} dict={dict.Login} />
          </CardContent>
        </Card>

      </div>
    </main>
  );
}