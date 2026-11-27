import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "pig_session";

/**
 * Лек слой за навигационна защита.
 *
 * Тук се проверява САМО наличието на сесийна бисквитка — истинската проверка на
 * подписа, срока и правата се извършва на сървъра в `app/dashboard/layout.tsx`
 * чрез `getCurrentUser()` / `requirePermission()`. Така middleware остава
 * съвместим с edge runtime и не може да бъде единствената защита.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/dashboard") && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/print")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/print/:path*"],
};
