import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Send, Loader2, Maximize2, Settings, MessageCircle, Sparkles } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  recipeId: number;
  title: string;
  placeholder: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function MessageList({ messages, isLoading }: {
  messages: ChatMessage[];
  isLoading: boolean;
}) {
  return (
    <>
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          style={{
            animationDelay: `${index * 50}ms`,
            animation: "chat-message-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          }}
        >
          {message.role === "assistant" && (
            <div className="mt-1.5 mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              message.role === "user"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-muted/70 border border-border/40 shadow-sm"
            }`}
          >
            <p className="whitespace-pre-wrap">{formatText(message.content)}</p>
          </div>
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="flex justify-start" style={{ animation: "chat-message-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
          <div className="mt-1.5 mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
          <div className="bg-muted/70 border border-border/40 rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" style={{ animation: "typing-dot 1.4s ease-in-out infinite" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" style={{ animation: "typing-dot 1.4s ease-in-out 0.2s infinite" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" style={{ animation: "typing-dot 1.4s ease-in-out 0.4s infinite" }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* Shared empty state used in both inline and expanded views */
function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center ${compact ? "py-6" : "py-16"}`}>
      <div className={`relative ${compact ? "mb-3" : "mb-4"}`}>
        {/* Soft glow behind the icon */}
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-150" />
        <div className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 ${compact ? "h-12 w-12" : "h-16 w-16"}`}>
          <MessageCircle className={`text-primary/40 ${compact ? "h-5 w-5" : "h-7 w-7"}`} />
        </div>
      </div>
      <p className={`text-center text-muted-foreground/60 max-w-[220px] leading-relaxed ${compact ? "text-xs" : "text-sm"}`}>
        {t("chat.emptyState")}
      </p>
    </div>
  );
}

export default function RecipeChat({ recipeId, title, placeholder }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const dialogInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (expanded) dialogInputRef.current?.focus();
  }, [expanded]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    const userMessage: ChatMessage = { id: createId(), role: "user", content: text };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/recipes/${recipeId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        let apiError = t("chat.errorGenerate");
        try {
          const errorBody = await response.json() as { error?: unknown };
          if (typeof errorBody.error === "string" && errorBody.error.trim().length > 0) {
            apiError = errorBody.error;
          }
        } catch {
          // Ignore parse failures; keep fallback message.
        }
        throw new Error(apiError);
      }

      const data: unknown = await response.json();
      const assistantText =
        typeof data === "object" &&
        data !== null &&
        "text" in data &&
        typeof (data as { text?: unknown }).text === "string"
          ? (data as { text: string }).text
          : t("chat.errorGenerate");

      setMessages((prev) => [...prev, { id: createId(), role: "assistant", content: assistantText }]);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t("chat.errorGeneral");
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: message },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Scoped keyframes for chat animations */}
      <style>{`
        @keyframes chat-message-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes typing-dot {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          30% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
      `}</style>

      {/* Inline compact chat */}
      <div className="flex flex-col">
        {/* Header toolbar — cohesive strip with subtle bottom border */}
        <div className="flex items-center justify-between pb-3 mb-1 border-b border-border/20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
            </div>
            <h2 className="font-serif text-lg tracking-tight">{title}</h2>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="/profile"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/50 transition-all duration-200"
            >
              <Settings className="h-3.5 w-3.5" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/50"
              onClick={() => setExpanded(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="sr-only">{t("chat.expand")}</span>
            </Button>
          </div>
        </div>

        {/* Message area or empty state */}
        {messages.length > 0 ? (
          <div className="max-h-52 overflow-y-auto space-y-3 py-3 pr-1 -mr-1 scrollbar-thin">
            <MessageList messages={messages} isLoading={isLoading} />
          </div>
        ) : (
          <EmptyState compact />
        )}

        {/* Input area — separated with subtle top treatment */}
        <div className="pt-3 border-t border-border/20">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="flex-1 h-10 text-sm rounded-xl border-border/40 bg-muted/30 placeholder:text-muted-foreground/40 focus-visible:bg-background transition-colors duration-200"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 rounded-xl shadow-sm shadow-primary/20 active:scale-95 transition-all duration-200 disabled:shadow-none"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Expanded dialog */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex flex-col max-w-2xl h-[80vh] gap-0 p-0 rounded-2xl border-border/50 overflow-hidden">
          {/* Dialog header — warm tinted strip */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/30 bg-gradient-to-b from-primary/[0.03] to-transparent shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <DialogTitle className="font-serif text-lg tracking-tight">{title}</DialogTitle>
                </div>
              </div>
              <a
                href="/profile"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/50 transition-all duration-200 mr-8"
              >
                <Settings className="h-4 w-4" />
              </a>
            </div>
            <DialogDescription className="sr-only">
              {t("chat.dialogDesc")}
            </DialogDescription>
          </DialogHeader>

          {/* Dialog messages */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
            {messages.length === 0 && <EmptyState />}
            <MessageList messages={messages} isLoading={isLoading} />
          </div>

          {/* Dialog input — polished bottom bar */}
          <div className="border-t border-border/30 bg-gradient-to-t from-primary/[0.02] to-transparent px-6 py-4 shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Input
                ref={dialogInputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                className="flex-1 h-11 rounded-xl border-border/40 bg-muted/30 placeholder:text-muted-foreground/40 focus-visible:bg-background transition-colors duration-200"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 rounded-xl shadow-sm shadow-primary/20 active:scale-95 transition-all duration-200 disabled:shadow-none"
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
