import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, Plus, LogOut } from "lucide-react";

interface Props {
  user?: { id: string; name: string; email: string } | null;
  navLinks: { href: string; label: string }[];
}

export default function MobileNav({ user, navLinks }: Props) {
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 bg-card/95 backdrop-blur-2xl border-border/30">
        <SheetTitle className="text-xl font-serif text-primary tracking-tight">Prepped</SheetTitle>
        <nav className="flex flex-col gap-1 mt-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm uppercase tracking-[0.06em] py-2.5 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-200"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {user ? (
            <>
              <div className="my-3 h-px bg-gradient-to-r from-border/40 to-transparent" />
              <a
                href="/recipes/new"
                className="text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/60 transition-all duration-200 flex items-center gap-2.5 text-primary"
                onClick={() => setOpen(false)}
              >
                <Plus className="h-4 w-4" />
                New Recipe
              </a>
              <button
                onClick={handleLogout}
                className="text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/60 transition-all duration-200 flex items-center gap-2.5 text-left text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <div className="my-3 h-px bg-gradient-to-r from-border/40 to-transparent" />
              <a
                href="/login"
                className="text-sm py-2.5 px-3 rounded-lg hover:bg-secondary/60 transition-all duration-200 text-primary"
                onClick={() => setOpen(false)}
              >
                Login
              </a>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
