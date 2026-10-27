# Récapitulatif temporaire - Vexo

## Actualisation des consignes et de la livraison - 27 octobre 2026

Les consignes sont révisées pour travailler sur main, sans sauvegarde ou worktree automatique, avec contrôles proportionnés et secrets privés hors Git/logs. Les anciennes mentions d'une autorisation de push encore à obtenir sont remplacées : l'utilisateur a autorisé ces publications et les pushes ont eu lieu. Les passages historiques décrivant des sauvegardes ou des tests non exécutés ne demandent pas de reproduire ces opérations.

Le dernier constat API Vercel avant cette mise à jour documentaire identifie la production `dpl_BUZLWW4VrASXnHRpajGzroMeSbEq`, état `READY`, commit source `b7e55722ca6416d6a2d9c1ac44485773b270edc6`. Ce constat prouve l'état du déploiement, pas un nouveau parcours utilisateur ou une opération métier. Les changements documentaires suivants restent à distinguer de cette preuve datée. Le suivi CI n'est plus demandé dans cette clôture.

Mise à jour : 27 octobre 2026. Ce fichier permet de reprendre le projet dans un nouveau chat.
Il est temporaire et peut être supprimé après transmission.

## Portée de cette discussion

La demande actuelle porte sur la transmission, le nettoyage justifié, les commits/pushes
et la consolidation des branches vers main. Les informations de produit ci-dessous
sont tirées des sources, de la documentation et de l'historique du dépôt ; elles ne
prétendent pas reconstituer toutes les conversations antérieures.

Révision de départ : `4b070b460725f9a7772535a78e423e62685eeec3`. Inventaire initial : 59 fichiers suivis.

## Produit et fonctionnement

Chat privé à deux personnes, avec texte/médias chiffrés avant stockage et synchronisation de messages, lecture, présence et saisie.

Next.js 16 App Router, React 19 et Tailwind CSS 4. Neon PostgreSQL via requêtes paramétrées ; AES-256-GCM et sessions signées dans src/lib/crypto.ts ; cookie HttpOnly et contrôle d'origine dans src/lib/session.ts. useChat.ts orchestre l'envoi optimiste et un flux SSE sans polling concurrent.

## Choix de design à préserver

Interface concentrée sur la conversation : saisie disponible immédiatement, envoi optimiste, horodatages belges déterministes, zoom conservé et contrôles mobiles accessibles. Les messages lus suivent la politique éphémère existante à la sortie de conversation.

## Déjà réalisé avant ce nettoyage

- Durcissement et simplification du chat, comportement optimiste et sécurité des sessions (b17aecf).
- Dates belges rendues déterministes (2ac8c03).
- Sécurité web, désindexation et outils modernisés (b660376) ; dépendances de production précédentes intégrées dans 4b070b4.

## Nettoyage et préservation

Conserver tests sécurité/réactivité, configuration CSP, exemples env et documentation de fonctionnement. ENCRYPTION_KEY ne doit jamais être changée sans rotation contrôlée ni publiée.

L'inventaire distingue fichiers suivis, non suivis, ignorés et worktrees. Les candidats
à suppression sont vérifiés par rôle et consommateurs ; aucune suppression massive
de tests, documentation, médias, dépendances, secrets ou données personnelles.
Les sauvegardes des fichiers retirés et les diffs initiaux sont hors des dépôts, dans
le dossier local `Documents/Codex/cleanup-2026-10-27/apps/Vexo`.
Une liste de fichiers ne constitue pas une revue comportementale de chaque ligne.

## Vérification et livraison

Commandes de référence : npm run format:check ; npm run lint ; npm run typecheck ; npm test ; npm run test:coverage ; npm run test:e2e ; npm run build ; npm audit. Les tests utilisent leurs données isolées, sans connexion réelle.

Vérifié le 27 octobre : lint, TypeScript, build Next.js, 49 tests avec couverture et 8 parcours Playwright réussis ; npm audit à zéro. La couverture mesure 89,89 % des instructions et 92,8 % des lignes. Les parcours navigateur utilisent les routes simulées du harnais, sans connexion à la base réelle.

## Résolutions de compatibilité de ce passage

La branche de développement proposait TypeScript 7, refusé par typescript-eslint dans sa CI, et ESLint 10 hors des peer ranges des plugins Next. La fusion conserve TypeScript 6.0.3 et ESLint 9.39.5 compatibles, les types Node 24 alignés sur le runtime, et les autres mises à jour validées dont Vitest 5. Les verrous transitifs @humanfs/node et Zod ont été corrigés par mise à jour ciblée : audit zéro, sans ajouter de dépendance directe.

## Restant à traiter ou à confirmer

- Les branches de production et de développement sont réunies ; supprimer leurs refs distantes seulement après la preuve de push main.
- La première connexion peut initialiser/migrer la base : ne pas lancer ce parcours sur la base réelle pendant un nettoyage.
- Tout push main déclenche Vercel en production selon CLAUDE.md : attendre l'autorisation explicite de cette activation après préparation des commits.
- Vérifier l'alias et le SHA réellement servis avant toute affirmation de déploiement réussi.

## Reprendre sans perdre le contexte

Lire ce fichier puis les consignes AGENTS.md/CLAUDE.md, README et les documents de domaine
encore présents. Contrôler `git status`, `git branch -avv`, `git worktree list` et les
refs distantes actuelles avant de reprendre. Garder les sources, la CI, le déploiement,
le runtime chargé et la validation utilisateur comme preuves distinctes.
Aucun redémarrage/rechargement de service, activation de release ou changement de base
n'est autorisé par le seul nettoyage Git.
