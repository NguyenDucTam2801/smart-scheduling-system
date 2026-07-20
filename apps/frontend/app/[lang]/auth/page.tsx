
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/app/[lang]/dictionaries'

export default async function Page({ params }: { params: { lang: string } }) {
  const { lang } = await params;

  if (!hasLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <div>
      <h1>{dict.products.cart}</h1>
    </div>
  );
}