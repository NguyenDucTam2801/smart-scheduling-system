import { NextResponse } from "next/server";

let locales = ['en', 'vi']; // Make sure these match your dictionary keys exactly
let defaultLocale = 'en';

function getLocale(request) {
    // 1. Check for the Accept-Language header from the browser
    const acceptLanguage = request.headers.get('accept-language');

    if (acceptLanguage) {
        // Look for a match from your supported locales
        const matched = locales.find(locale => acceptLanguage.includes(locale));
        if (matched) return matched;
    }

    // 2. Fallback to your default locale if no match is found
    return defaultLocale;
}

export function proxy(request) {
    const { pathname } = request.nextUrl;

    // CRITICAL FIX 1: Ignore Next.js static assets, api routes, icons, etc.
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.includes('.') || // skips favicon.ico, images, manifest, etc.
        pathname === '/favicon.ico'
    ) {
        return;
    }

    // CRITICAL FIX 2: Check if the pathname already has a supported locale
    const pathnameHasLocale = locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathnameHasLocale) return;

    // CRITICAL FIX 3: Get a guaranteed string fallback
    const locale = getLocale(request) || defaultLocale;

    // Rewrite/Redirect target path cleanly
    request.nextUrl.pathname = `/${locale}${pathname}`;

    return NextResponse.redirect(request.nextUrl);
}

export const config = {
    // CRITICAL FIX 4: Stronger matcher to prevent loops on core assets
    matcher: [
        // Match all paths except internal Next.js files and static files
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    ],
};