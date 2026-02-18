import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut } from "lucide-react";

interface Props {
  user?: { id: string; name: string; email: string } | null;
}

export default function UserMenu({ user }: Props) {
  if (!user) {
    return (
      <a
        href="/login"
        className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/40 px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border/60 transition-all duration-200"
      >
        Login
      </a>
    );
  }

  async function handleLogout() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-[13px]">{user.name || user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-xl border-border/30 min-w-[160px]">
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
