# Vexo

Vexo est un chat privé à deux utilisateurs construit avec Next.js 16, React 19, Neon PostgreSQL et Tailwind CSS 4. Les messages texte et les médias sont chiffrés avant stockage. L'interface utilise un flux SSE pour synchroniser les messages, la lecture, la présence et l'indicateur de saisie.

## Architecture

```text
src/app/page.tsx              -> point d'entrée client
src/components/chat/          -> connexion, en-tête, messages et compositeur
src/hooks/useChat.ts          -> état et orchestration temps réel
src/app/api/auth/             -> connexion et cookie de session HttpOnly
src/app/api/messages/         -> historique, envoi, édition et masquage
src/app/api/messages/stream/  -> flux SSE sans polling concurrent
src/app/api/presence/         -> présence et saisie
src/lib/db.ts                 -> connexion Neon et migrations idempotentes
src/lib/crypto.ts             -> AES-256-GCM et signature de session
src/lib/session.ts            -> authentification et protection same-origin
```

La première tentative de connexion initialise ou migre le schéma. La limitation des tentatives est stockée dans PostgreSQL afin de rester cohérente entre les instances Vercel. Les messages lus sont supprimés lorsque l'un des participants quitte la conversation, conformément au comportement éphémère existant.

## Configuration

Prérequis: Node.js 24 et npm 10 ou plus récent.

```bash
copy .env.example .env.local
npm ci
npm run dev
```

Variables obligatoires:

- `DATABASE_URL`: chaîne PostgreSQL Neon;
- `ENCRYPTION_KEY`: exactement 64 caractères hexadécimaux;
- `USER1_PASSWORD` et `USER2_PASSWORD`: requis uniquement lors de la création initiale des utilisateurs, avec 12 caractères minimum.

Ne jamais changer `ENCRYPTION_KEY` sans procédure de rotation: les anciens messages ne pourraient plus être déchiffrés et les sessions seraient invalidées.

## Qualité

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run build
npm audit
```

Les tests Playwright couvrent le champ de connexion immédiatement disponible, l'envoi optimiste malgré une API ralentie, la date complète, le viewport mobile et les contrôles WCAG automatisables.

## Déploiement

La branche `main` est destinée à Vercel. Le projet déclare Node.js 24 dans `package.json`; les secrets doivent être configurés dans les variables d'environnement Vercel. Après un push, vérifier le statut du déploiement, son alias de production et le parcours de connexion dans le navigateur.
