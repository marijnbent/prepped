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
import { Send, Loader2, Maximize2, Settings } from "lucide-react";
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
      {messages.map((message) => (
        <div
          key={message.id}
          className={`chat-message flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-[20px] px-4 py-2.5 text-sm leading-relaxed ${
              message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            <p className="whitespace-pre-wrap">{formatText(message.content)}</p>
          </div>
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="chat-message flex justify-start" role="status" aria-label={t("common.loading")}>
          <div className="flex items-center gap-1.5 rounded-[20px] bg-secondary px-4 py-3.5">
            <span className="chat-typing-dot size-1.5 rounded-full bg-muted-foreground" />
            <span className="chat-typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: "0.2s" }} />
            <span className="chat-typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      )}
    </>
  );
}

/* Shared empty state used in both inline and expanded views */
function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`text-muted-foreground ${compact ? "py-3 text-sm" : "text-base"}`}>
      {t("chat.emptyState")}
    </p>
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
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .chat-message { animation: chat-message-in 0.2s ease-out both; }
          .chat-typing-dot { animation: typing-dot 1.4s ease-in-out infinite; }
        }
        @keyframes chat-message-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
      `}</style>

      {/* Inline compact chat */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-medium tracking-tight">{title}</h2>
          <div className="-mr-2 flex items-center">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" asChild>
              <a href="/profile" aria-label={t("profile.title")} title={t("profile.title")}>
                <Settings />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("chat.expand")}
              title={t("chat.expand")}
              onClick={() => setExpanded(true)}
            >
              <Maximize2 />
            </Button>
          </div>
        </div>

        {messages.length > 0 ? (
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            <MessageList messages={messages} isLoading={isLoading} />
          </div>
        ) : (
          <EmptyState compact />
        )}

        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="min-w-0 flex-1"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon-lg"
            className="shrink-0"
            aria-label={t("chat.send")}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      </div>

      {/* Expanded dialog */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[80dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("chat.dialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-2 overflow-y-auto px-6 py-5">
            {messages.length === 0 && <EmptyState />}
            <MessageList messages={messages} isLoading={isLoading} />
          </div>

          <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t border-border px-6 py-4">
            <Input
              ref={dialogInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className="h-12 min-w-0 flex-1 px-5 text-base"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon-lg"
              className="size-12 shrink-0"
              aria-label={t("chat.send")}
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
