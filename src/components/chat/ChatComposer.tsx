/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/refs -- callback refs are intentionally exposed by useChat */
import {
  AttachmentIcon,
  CameraIcon,
  CloseIcon,
  SendIcon,
} from "@/components/chat/ChatIcons";
import { Button } from "@/components/ui/button";
import type { ChatController } from "@/hooks/useChat";

type Props = {
  actions: ChatController["actions"];
  bindings: ChatController["bindings"];
  state: ChatController["state"];
};
const ACCEPTED_MEDIA =
  "image/avif,image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";

export function ChatComposer({ actions, bindings, state }: Props) {
  return (
    <>
      {(state.replyTo || state.editingMsg) && (
        <div className="shrink-0 border-t bg-card px-3 py-2 sm:px-4">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-xs">
              {state.editingMsg ? (
                <span className="text-muted-foreground">
                  Modification du message
                </span>
              ) : state.replyTo ? (
                <>
                  <span className="text-muted-foreground">Réponse à </span>
                  <span className="font-medium">
                    {state.replyTo.sender_id === state.userId
                      ? "vous"
                      : state.otherLabel}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    : {state.replyTo.content || "Média"}
                  </span>
                </>
              ) : null}
            </div>
            <button
              type="button"
              onClick={actions.cancelAction}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Annuler"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        </div>
      )}
      {state.mediaPreview && (
        <div className="shrink-0 border-t bg-card px-3 py-2 sm:px-4">
          <div className="relative mx-auto w-fit max-w-2xl">
            {state.mediaType === "image" ? (
              <img
                src={state.mediaPreview}
                alt="Aperçu avant envoi"
                className="h-20 max-w-[min(20rem,80vw)] rounded-lg object-contain"
              />
            ) : (
              <video
                src={state.mediaPreview}
                className="h-20 max-w-[min(20rem,80vw)] rounded-lg"
                aria-label="Aperçu vidéo avant envoi"
              />
            )}
            <button
              type="button"
              onClick={() => {
                actions.setMediaPreview(null);
                actions.setMediaType(null);
              }}
              className="absolute -right-2 -top-2 flex size-7 cursor-pointer items-center justify-center rounded-full bg-destructive text-white shadow-sm"
              aria-label="Retirer le média"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void actions.sendMessage();
        }}
        className="shrink-0 border-t bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          {!state.editingMsg && (
            <>
              <input
                ref={bindings.bindFileInput}
                type="file"
                accept={ACCEPTED_MEDIA}
                onChange={actions.handleFileSelect}
                className="hidden"
              />
              <input
                ref={bindings.bindCameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={actions.handleFileSelect}
                className="hidden"
              />
              <ComposerButton
                label="Joindre un média"
                onClick={actions.openFilePicker}
              >
                <AttachmentIcon />
              </ComposerButton>
              <span className="sm:hidden">
                <ComposerButton
                  label="Prendre une photo"
                  onClick={actions.openCamera}
                >
                  <CameraIcon />
                </ComposerButton>
              </span>
            </>
          )}
          <label htmlFor="message-composer" className="sr-only">
            Message
          </label>
          <textarea
            id="message-composer"
            ref={bindings.bindComposer}
            value={state.newMessage}
            maxLength={5_000}
            onChange={(event) => actions.handleInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void actions.sendMessage();
              }
            }}
            placeholder={
              state.editingMsg ? "Modifier le message..." : "Message..."
            }
            className="min-h-11 max-h-[120px] min-w-0 flex-1 resize-none [field-sizing:content] rounded-lg bg-muted px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
            rows={1}
            autoFocus
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 cursor-pointer self-end"
            disabled={
              state.savingEdit ||
              (!state.newMessage.trim() && !state.mediaPreview)
            }
            aria-label={
              state.editingMsg
                ? "Enregistrer la modification"
                : "Envoyer le message"
            }
          >
            <SendIcon />
          </Button>
        </div>
      </form>
    </>
  );
}

function ComposerButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-11 shrink-0 cursor-pointer"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}
