import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { AiMessage } from "@/features/ai/state/aiStore";

type MessageBubbleProps = {
  message: AiMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--color-noxe-primary)] px-3 py-2 text-sm text-[var(--color-noxe-primary-foreground)]">
          <pre className="whitespace-pre-wrap font-[inherit] text-sm">{message.content}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[var(--color-noxe-panel-2)] px-3 py-2 text-sm text-[var(--color-noxe-ink)]">
        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1 prose-pre:bg-[var(--color-noxe-panel)] prose-code:text-[0.8em]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
