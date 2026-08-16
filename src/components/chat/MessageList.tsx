/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/refs -- callback ref is intentionally exposed by useChat */
import {
  CheckIcon,
  CloseIcon,
  EditIcon,
  ReplyIcon,
} from "@/components/chat/ChatIcons";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatController } from "@/hooks/useChat";
import {
  formatMessageTimestamp,
  splitMessageLinks,
} from "@/lib/message-format";
import type { Message } from "@/types";

type Props = {
  actions: ChatController["actions"];
  bindings: ChatController["bindings"];
  state: ChatController["state"];
};

export function MessageList({ actions, bindings, state }: Props) {
  return (
    <ScrollArea className="chat-bg min-h-0 flex-1">
      <section
        aria-label="Messages"
        aria-live="polite"
        className="mx-auto max-w-2xl space-y-3 px-3 py-3 sm:px-4"
      >
        {state.hasMore && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void actions.loadMore()}
              disabled={state.loadingMore}
              className="min-h-8 text-xs text-muted-foreground"
            >
              {state.loadingMore
                ? "Chargement..."
                : "Charger les messages précédents"}
            </Button>
          </div>
        )}
        {state.messages.length === 0 && !state.hasMore && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun message
          </p>
        )}
        {state.messages.map((message) => (
          <MessageRow
            key={message.id}
            message={message}
            actions={actions}
            state={state}
          />
        ))}
        <div ref={bindings.bindMessagesEnd} aria-hidden="true" />
        {state.otherTyping && (
          <div
            className="flex justify-start"
            aria-label={`${state.otherLabel} écrit`}
          >
            <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-3">
              {[
                "[animation-delay:0ms]",
                "[animation-delay:150ms]",
                "[animation-delay:300ms]",
              ].map((delayClass) => (
                <span
                  key={delayClass}
                  className={`size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none ${delayClass}`}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </ScrollArea>
  );
}

function MessageRow({
  message,
  actions,
  state,
}: { message: Message } & Pick<Props, "actions" | "state">) {
  const isMine = message.sender_id === state.userId;
  const isNew = state.newMsgIds.has(message.id);
  const repliedMessage = message.reply_to
    ? state.messageById.get(message.reply_to)
    : null;
  const timestamp = formatMessageTimestamp(message.created_at);
  if (message.media_type === "system")
    return (
      <article className="flex justify-center">
        <div className="max-w-[92%] rounded-full bg-muted/70 px-4 py-2 text-center text-xs italic text-muted-foreground">
          <p>{message.content}</p>
          <time
            dateTime={message.created_at}
            className="mt-0.5 block text-[10px] not-italic opacity-75"
          >
            {timestamp}
          </time>
        </div>
      </article>
    );
  const bubble = isNew
    ? isMine
      ? "msg-gold-mine"
      : "msg-gold-other"
    : isMine
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground";
  return (
    <article
      className={`group flex ${isMine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`relative max-w-[88%] rounded-2xl px-3.5 py-2 sm:max-w-[80%] sm:px-4 ${bubble} ${message.pending ? "opacity-80" : ""}`}
      >
        {!message.pending && (
          <div
            className={`absolute -top-3 z-10 flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${isMine ? "-left-2" : "-right-2"}`}
          >
            <ActionButton
              label="Répondre"
              onClick={() => actions.startReply(message)}
            >
              <ReplyIcon className="size-3.5" />
            </ActionButton>
            {isMine && message.content && (
              <ActionButton
                label="Modifier"
                onClick={() => actions.startEdit(message)}
              >
                <EditIcon className="size-3.5" />
              </ActionButton>
            )}
            <ActionButton
              label="Masquer ce message"
              destructive
              onClick={() => void actions.handleDelete(message.id)}
            >
              <CloseIcon className="size-3.5" />
            </ActionButton>
          </div>
        )}
        {repliedMessage && (
          <div
            className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${isMine ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-muted-foreground/30 bg-background/30"}`}
          >
            <span className="font-medium opacity-70">
              {repliedMessage.sender_id === state.userId
                ? "Vous"
                : state.otherLabel}
            </span>
            <p className="max-w-[200px] truncate opacity-60">
              {repliedMessage.content ||
                (repliedMessage.media || repliedMessage.has_media
                  ? "Média"
                  : "...")}
            </p>
          </div>
        )}
        {message.reply_to && !repliedMessage && (
          <p
            className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs italic opacity-50 ${isMine ? "border-primary-foreground/30" : "border-muted-foreground/30"}`}
          >
            Message supprimé
          </p>
        )}
        {message.media && message.media_type === "image" && (
          <button
            type="button"
            className="mb-1 block cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/70"
            onClick={() => actions.setLightboxSrc(message.media)}
            aria-label="Agrandir l'image envoyée"
          >
            <img
              src={message.media}
              alt="Image envoyée"
              className="max-h-64 max-w-full rounded-lg object-contain"
            />
          </button>
        )}
        {message.media && message.media_type === "video" && (
          <video
            src={message.media}
            controls
            className="mb-1 max-h-64 max-w-full rounded-lg"
            playsInline
            aria-label="Vidéo envoyée"
          />
        )}
        {!message.media && message.has_media && (
          <div
            className="flex items-center gap-2 py-2 text-xs opacity-70"
            role="status"
          >
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
            Chargement du média...
          </div>
        )}
        {message.content && (
          <p className="break-words text-sm whitespace-pre-wrap">
            {splitMessageLinks(message.content).map((part, index) =>
              part.kind === "link" ? (
                <a
                  key={`${part.value}-${index}`}
                  href={part.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all underline opacity-80 hover:opacity-100"
                >
                  {part.value}
                </a>
              ) : (
                <span key={`${part.value}-${index}`}>{part.value}</span>
              ),
            )}
          </p>
        )}
        <div
          className={`mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 ${isMine ? "justify-end" : ""}`}
        >
          {message.edited && (
            <span className="text-[10px] italic opacity-60">modifié</span>
          )}
          {message.pending && (
            <span className="text-[10px] italic opacity-70">Envoi...</span>
          )}
          <time
            dateTime={message.created_at}
            className="text-[10px] opacity-65"
          >
            {timestamp}
          </time>
          {isMine && !isNew && !message.pending && (
            <span title={message.is_read ? "Lu" : "Envoyé"}>
              <CheckIcon
                double={message.is_read}
                className={`size-3.5 ${message.is_read ? "text-blue-400" : "opacity-60"}`}
              />
              <span className="sr-only">
                {message.is_read ? "Message lu" : "Message envoyé"}
              </span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function ActionButton({
  children,
  destructive = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  destructive?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex size-7 cursor-pointer items-center justify-center rounded-full text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${destructive ? "bg-destructive hover:bg-destructive/85" : "bg-muted-foreground hover:bg-foreground"}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
