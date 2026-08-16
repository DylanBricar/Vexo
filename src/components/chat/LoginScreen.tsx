import { MoonIcon, SunIcon } from "@/components/chat/ChatIcons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ChatController } from "@/hooks/useChat";

type Props = {
  actions: ChatController["actions"];
  state: ChatController["state"];
};

export function LoginScreen({ actions, state }: Props) {
  const themeLabel =
    state.theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre";
  return (
    <main className="chat-bg flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="relative w-full max-w-sm space-y-4 p-6">
        <button
          type="button"
          onClick={actions.toggleTheme}
          className="absolute right-3 top-3 flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={themeLabel}
          title={themeLabel}
        >
          {state.theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Chat</h1>
          <p className="text-sm text-muted-foreground">
            Entrez votre mot de passe
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void actions.handleLogin();
          }}
          className="space-y-3"
        >
          <label htmlFor="password" className="sr-only">
            Mot de passe
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={state.password}
            onChange={(event) => actions.setPassword(event.target.value)}
            autoFocus
            disabled={state.loading}
            aria-describedby={state.error ? "login-error" : undefined}
            aria-invalid={Boolean(state.error)}
            className="h-12 text-base"
          />
          {state.error && (
            <p
              id="login-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {state.error}
            </p>
          )}
          <Button
            type="submit"
            className="h-12 w-full cursor-pointer text-base"
            disabled={state.loading}
          >
            {state.loading ? "Connexion..." : "Entrer"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
