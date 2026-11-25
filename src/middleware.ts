import { defineMiddleware } from "astro:middleware";
import { auth, ssoEnabled } from "./lib/auth";
import { getUserFromApiToken } from "./lib/api-auth";
import { db } from "./lib/db";
import { isCrossSiteForm } from "./lib/origin";
import { users } from "./lib/schema";
import { eq } from "drizzle-orm";
import { resolveLocale } from "./lib/i18n";
import { runWithLocale } from "./lib/i18n-server";

const isSimpleAuth = import.meta.env.AUTH_MODE === "simple";
const BACKCHANNEL_LOGOUT = "/api/auth/backchannel-logout";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  if (pathname !== BACKCHANNEL_LOGOUT && isCrossSiteForm(context.request, context.url)) {
    return new Response(`Cross-site ${context.request.method} form submissions are forbidden`, { status: 403 });
  }

  if (isSimpleAuth && pathname === "/register") {
    return context.redirect("/login");
  }

  if (isSimpleAuth) {
    const userId = context.cookies.get("simple_session")?.value;
    if (userId) {
      const user = db.select().from(users).where(eq(users.id, userId)).get();
      if (user) {
        context.locals.user = {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      } else {
        context.locals.user = null;
      }
    } else {
      context.locals.user = null;
    }
  } else {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    });

    if (session?.user) {
      context.locals.user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      };
    } else {
      context.locals.user = null;
      const open = pathname === "/login" || pathname === "/ready" || pathname.startsWith("/api/auth/");
      if (ssoEnabled && !open && !(await getUserFromApiToken(context.request))) {
        const page = ["GET", "HEAD"].includes(context.request.method) && !pathname.startsWith("/api/");
        return page
          ? context.redirect(`/api/auth/sso?redirect=${encodeURIComponent(pathname + search)}`)
          : new Response(null, { status: 401 });
      }
    }
  }

  const userLocale = context.locals.user
    ? db.select({ locale: users.locale }).from(users).where(eq(users.id, context.locals.user.id)).get()?.locale
    : null;
  const locale = resolveLocale(userLocale)
    ?? resolveLocale(import.meta.env.PUBLIC_UI_LOCALE)
    ?? "en";

  return runWithLocale(locale, () => next());
});
