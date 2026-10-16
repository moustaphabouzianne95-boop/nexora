# 🚀 Déployer NEXORA sur Vercel

> **Durée estimée : ~15 minutes.** Tout le projet est déjà configuré — il reste 3 étapes manuelles (compte Turso, initialisation de la base, import Vercel).

## Pourquoi Turso ?

L'application utilise **SQLite**. Sur Vercel (serverless), un fichier SQLite local ne peut pas persister.
**Turso** est une base **100 % compatible SQLite** hébergée dans le cloud (protocole libSQL) —
le code de l'application reste **identique** : `src/lib/db.ts` bascule automatiquement vers Turso
dès que la variable `TURSO_DATABASE_URL` est définie.

| Environnement | Base de données |
|---|---|
| Développement local | `db/custom.db` (fichier SQLite, inchangé) |
| Vercel (production) | Turso via `@prisma/adapter-libsql` |

---

## Étape 1 — Créer la base Turso (gratuit)

### Option A · Interface web (le plus simple)

1. Créez un compte sur **https://turso.tech** (connexion GitHub possible — plan gratuit).
2. **Create database** → nom : `nexora` → location : la plus proche (ex. `cdg-paris`).
3. Une fois créée, ouvrez la base et notez :
   - **Database URL** → ressemble à `libsql://nexora-<votre-org>.turso.io`
   - Onglet **Tokens** → **Create token** → copiez le jeton.

### Option B · Ligne de commande

```bash
curl -sSfL https://get.tur.so/install.sh | bash   # installer la CLI
turso auth signup                                  # créer le compte
turso db create nexora                             # créer la base
turso db show nexora --url                         # → TURSO_DATABASE_URL
turso db tokens create nexora                      # → TURSO_AUTH_TOKEN
```

## Étape 2 — Initialiser la base (schéma + données de démo)

Le fichier **`deploy/turso-init.sql`** contient le schéma complet **et** les données de démo
(5 comptes, 1 workspace, 4 projets, ~60 tâches, labels, commentaires…).

### Option A · Console web Turso

Ouvrez votre base → **SQL editor** (ou « Console ») → collez le contenu de
`deploy/turso-init.sql` → exécutez. ✅

### Option B · CLI

```bash
turso db shell nexora < deploy/turso-init.sql
```

Vérification rapide :

```bash
turso db shell nexora "SELECT COUNT(*) FROM Task;"   # → ~60
```

## Étape 3 — Importer le projet sur Vercel

1. Allez sur **https://vercel.com/new** (connexion GitHub).
2. **Import** le dépôt `moustaphabouzianne95-boop/nexora`.
3. Vercel détecte **Next.js** automatiquement — **ne modifiez pas** les commandes de build
   (`vercel.json` les définit déjà : `bun install` puis `prisma generate && next build`).
4. Dans **Environment Variables**, ajoutez **pour Production, Preview et Development** :

| Variable | Valeur | Exemple |
|---|---|---|
| `TURSO_DATABASE_URL` | URL de votre base Turso | `libsql://nexora-mon-org.turso.io` |
| `TURSO_AUTH_TOKEN` | Jeton créé à l'étape 1 | `eyJhbGciOi...` |
| `DATABASE_URL` | Valeur factice pour le CLI Prisma au build | `file:./db/custom.db` |

5. Cliquez **Deploy** 🚀 (le premier build prend ~2-3 min).

## Étape 4 — Vérifier

- Ouvrez l'URL `https://<votre-projet>.vercel.app`
- Connectez-vous avec le compte démo : **owner@nexora.dev** / `Demo1234!`
- Dashboard, projets, tâches, commentaires → tout est opérationnel ✅

> ℹ️ Le premier chargement de page peut être un peu plus lent (cold start serverless) — c'est normal sur le plan gratuit.

---

## Déploiements suivants

Chaque `git push` sur `main` déclenche automatiquement un nouveau déploiement Vercel.
Si vous modifiez `prisma/schema.prisma`, régénérez et ré-exécutez le SQL sur Turso :

```bash
bun scripts/export-turso-sql.ts          # régénérer le dump depuis la base locale
turso db shell nexora < deploy/turso-init.sql
```

> ⚠️ Le script ré-initialise les données (DROP/CREATE implicite ? non — il crée les tables).
> Pour repartir de zéro : détruisez et recréez la base Turso, puis rejouez l'init.

## Dépannage

| Problème | Solution |
|---|---|
| Build échoue : `Environment variable not found: DATABASE_URL` | Ajoutez `DATABASE_URL=file:./db/custom.db` dans Vercel (étape 3.4). |
| Page 500 au démarrage | Vérifiez `TURSO_DATABASE_URL` (doit commencer par `libsql://`) et `TURSO_AUTH_TOKEN`. |
| `SOAP/SQLITE_CANTOPEN` ou table inexistante | L'étape 2 (init SQL) n'a pas été exécutée sur Turso. |
| Login impossible | La base Turso est vide → rejouez `deploy/turso-init.sql`. |

## Coûts

- **Turso free plan** : 500 DB, 9 GB de stockage, 1 milliard de lignes lues/mois — largement suffisant.
- **Vercel Hobby** : gratuit, usage non commercial, domaine `.vercel.app` inclus.

---

*Configuration technique : `vercel.json` (build), `src/lib/db.ts` (bascule Turso automatique),
`postinstall: prisma generate`, `serverExternalPackages` pour les modules natifs dans `next.config.ts`.*
