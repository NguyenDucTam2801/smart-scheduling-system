import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'
import { Form } from 'lucide-react';

export default async function Page({ params }: { params: { lang: string } }) {
    const { lang } = await params;

    if (!hasLocale(lang)) notFound();
    return (
        <div className='w-full h-screen dark:bg-black'>
            <div className='w-full h-full flex justify-center items-center'>

            </div>
        </div>
    )
}