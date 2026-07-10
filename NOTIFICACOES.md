# Notificações (Web Push) — Pega Aí

Push real no iPhone (com o app **instalado na tela inicial**, iOS 16.4+), Android e desktop.
Tipos: **datas** (X dias antes), **remédios** (no horário) e **atividade do parceiro**.

Arquitetura: o app (cliente) inscreve o aparelho e salva a subscription no Firestore.
Um serviço Node (`server/`) é chamado pelo **cron-job.org** de tempos em tempos, lê o que
está vencido e dispara o push. Sem Cloud Functions / sem plano Blaze.

## 1. Gerar as chaves VAPID
```
cd server
npm install
npx web-push generate-vapid-keys
```
Guarde o par (Public/Private).

## 2. App (cliente)
No `.env.local` do app (e no host), adicione a **pública**:
```
VITE_VAPID_PUBLIC_KEY=<public key>
```
No iPhone: o usuário precisa **Compartilhar → Adicionar à Tela de Início**, abrir por lá,
e em Configurações tocar em **"Notificações neste aparelho → Ativar"**.

## 3. Service account do Firebase (pro server ler/escrever)
Firebase Console → Project settings → **Service accounts → Generate new private key**.
Use os campos no `server/.env`.

## 4. Subir o enviador (`server/`)
Qualquer host Node serve (Render, Railway, Fly, uma VPS…). Variáveis: ver `server/.env.example`.
```
npm install && npm start    # sobe em /notify
```

## 5. cron-job.org
Crie um job chamando:
```
https://SEU-SERVER/notify?key=<CRON_SECRET>
```
- **A cada 10–15 min** (pra remédio cair perto do horário e a atividade do parceiro chegar rápido).
- As datas são checadas em toda execução (dispara 1x por ocorrência, sem repetir).

## Dedupe (não repete)
- Datas: grava `notifiedKey` (ocorrência + dias antes) no doc da data.
- Remédios: grava `notifiedSlots` (`YYYY-MM-DD:HH:MM`) no doc do remédio.
- Atividade: marca `notified: true` no doc.

## Limites do iOS (não dá pra contornar no código)
- Só funciona com o PWA **instalado na tela inicial** (aba do Safari não recebe push).
- Permissão precisa ser concedida a partir de um toque do usuário.
- Sem push silencioso / sem acordar em segundo plano; o aparelho mostra a notificação.
