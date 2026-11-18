export async function logout(authMode?: string) {
  const response = await fetch(authMode === "simple" ? "/api/auth/simple-logout" : "/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) return;
  const { url } = (await response.json()) as { url?: string };
  window.location.href = url ?? "/login";
}
