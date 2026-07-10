# Pega Aí — agora no Firebase

App de casal (Vite + TanStack Start + React + Tailwind). Backend migrado de Supabase para **Firebase**: Auth (e-mail/senha) + **Firestore** (dados + tempo real via `onSnapshot`) + **Security Rules**. Sem confirmação de e-mail e **sem pausar por inatividade**.

## 1. Criar o projeto Firebase
1. https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (modo produção, qualquer região).
4. **Project settings (engrenagem) → General → Your apps → Web (</>)** → registra um app e copia o objeto de config (`apiKey`, `authDomain`, etc.).

## 2. Variáveis de ambiente
Cria `.env.local` (e as mesmas no host — Vercel/Lovable/Firebase Hosting):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> Essas chaves são públicas (config de cliente). Quem protege os dados são as **regras**.

## 3. Publicar as Security Rules
Cola o conteúdo de `firebase/firestore.rules` em **Firestore → Rules → Publish**.
(Ou via CLI: `firebase deploy --only firestore:rules`.)

## 4. Rodar
```
bun install     # ou: npm install
bun dev         # ou: npm run dev
```

## Modelo de dados (Firestore)
```
users/{uid}                      -> { spaceId }              # ponteiro pro espaço
invites/{CODE}                   -> { spaceId, spaceName, adminName }
spaces/{spaceId}                 -> { name, inviteCode, createdAt }
spaces/{spaceId}/members/{uid}   -> { name, email, color, role }
spaces/{spaceId}/lists/{id}      -> { name, shared, dotColor, position }
spaces/{spaceId}/listItems/{id}  -> { listId, text, done, assignee, everyone, doneBy[], position }
spaces/{spaceId}/dates/{id}      -> { title, startISO, endISO, type, color, recurrence, reminder }
spaces/{spaceId}/achievements/{id}
```

## O que mudou em relação ao Supabase
- **Auth**: Firebase Auth (sem o 500 de confirmação de e-mail).
- **Realtime**: `onSnapshot` em 6 coleções do espaço — entrega o estado inicial e as mudanças ao vivo, com *latency compensation* (quem edita vê na hora, sem optimistic manual).
- **RLS → Security Rules** (`firebase/firestore.rules`): acesso só pra quem é membro do espaço; entrar exige o código do convite.
- **Sem pausa por inatividade** (plano Spark não pausa).

## Status
🔜 Saúde/Remédios segue deferido (tela mostra estado vazio). As demais features (listas com "Todos", agenda com recorrência/multi-dia, settings) estão ligadas no Firestore.
