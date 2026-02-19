import { defineMiddleware } from "astro:middleware";
import { auth } from "./lib/auth";
import { db } from "./lib/db";
import { users } from "./lib/schema";
import { eq } from "drizzle-orm";

const isSimpleAuth = import.meta.env.AUTH_MODE === "simple";

export const onRequest = defineMiddleware(async (context, next) => {
  if (isSimpleAuth && new URL(context.request.url).pathname === "/register") {
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
    }
  }

  return next();
});
