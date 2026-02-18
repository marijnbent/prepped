import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Send, Loader2, Maximize2 } from "lucide-react";

interface Props {
  recipeId: number;
  title: string;
  placeholder: string;
}

function getTextContent(message: { parts?: { type: string; text?: string }[]; content?: string }) {
  if (message.parts) {
    return message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  return message.content ?? "";
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

function MessageList({ messages, isLoading, messagesEndRef }: {
  messages: { id: string; role: string; parts?: any[]; content?: string }[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            <p className="whitespace-pre-wrap">{formatText(getTextContent(message))}</p>
          </div>
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="flex justify-start">
          <div className="bg-muted rounded-lg px-3 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </>
  );
}

export default function RecipeChat({ recipeId, title, placeholder }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const inlineEndRef = useRef<HTMLDivElement>(null);
  const dialogEndRef = useRef<HTMLDivElement>(null);
  const dialogInputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/recipes/${recipeId}/chat` }),
    [recipeId],
  );

  const { messages, status, sendMessage } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (expanded) {
      dialogEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, expanded]);

  useEffect(() => {
    if (expanded) dialogInputRef.current?.focus();
  }, [expanded]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  }

  return (
    <>
      {/* Inline compact chat */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-xl tracking-tight">{title}</h2>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(true)}>
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="sr-only">Expand chat</span>
            </Button>
          )}
        </div>

        {/* Message area — compact */}
        {messages.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
            <MessageList messages={messages} isLoading={isLoading} messagesEndRef={inlineEndRef} />
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1 h-9 text-sm"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-9 w-9" disabled={isLoading || !input.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>

      {/* Expanded dialog */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex flex-col max-w-2xl h-[80vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Chat with AI about this recipe
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Ask anything — substitutions, tips, technique questions...
              </p>
            )}
            <MessageList messages={messages} isLoading={isLoading} messagesEndRef={dialogEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-border px-6 py-4 flex gap-2 shrink-0">
            <Input
              ref={dialogInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
