import { defineMiddleware } from "astro:middleware";
import { auth } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
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

  return next();
});
