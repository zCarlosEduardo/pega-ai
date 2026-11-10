# Notificações (Web Push) — Pega Aí

Push real no iPhone (com o app **instalado na tela inicial**, iOS 16.4+), Android e desktop.
Tipos: **datas** (X dias antes), **remédios** (no horário), **atividade do parceiro** e **resumo diário** (opcional).

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
É a **mesma** chave pública do `VAPID_PUBLIC` do servidor. Se forem diferentes, o push nunca chega
(o servidor recebe 401/403 do serviço de push e registra `push err` no log).

No iPhone: o usuário precisa **Compartilhar → Adicionar à Tela de Início**, abrir por lá,
e em Configurações tocar em **"Notificações neste aparelho → Ativar"**. Depois, **"Enviar notificação
de teste"** confirma que o aparelho consegue exibir notificações.

## 3. Service account do Firebase (pro server ler/escrever)
Firebase Console → Project settings → **Service accounts → Generate new private key**.
Use os campos no `server/.env`.

## 4. Subir o enviador (`server/`)
Qualquer host Node serve (Render, Railway, Fly, uma VPS…). Variáveis: ver `server/.env.example`.
Se faltar alguma obrigatória, o servidor **não sobe** e diz qual é.
```
npm install && npm start    # sobe em /notify  (e /health para o host checar)
```

## 5. cron-job.org
Crie um job chamando:
```
https://SEU-SERVER/notify?key=<CRON_SECRET>
```
- **A cada 10–15 min** (a janela do remédio é de 45 min; a atividade do parceiro chega no ciclo seguinte).
- Se uma execução ainda estiver rodando, a nova responde 429 (evita envio duplicado).

## 6. Validar que está funcionando (faça nesta ordem)
1. **Servidor no ar:** abra `https://SEU-SERVER/health` → deve responder `ok`.
2. **Aparelho:** Configurações → Notificações → **Ativar** → **Enviar notificação de teste**.
   Se a de teste local aparecer, permissão e service worker estão ok.
3. **Caminho completo (servidor → serviço de push → aparelho):**
   `https://SEU-SERVER/notify?key=<CRON_SECRET>&test=1`
   Resposta: `{"devices":N,"delivered":M}`. `devices` = aparelhos inscritos; `delivered` = aceitos pelo
   serviço de push. Se `devices` = 0, ninguém ativou (ou o app não gravou a inscrição). Se
   `delivered` < `devices`, veja o log do servidor (`push err 401/403` = chave VAPID diferente da do app).
4. **Cron de verdade:** cadastre um remédio para daqui a ~10 min com notificação ligada e espere.

## Quando cada aviso chega
| Aviso | Quando |
|---|---|
| Data | A partir das **09:00** (`DATE_HOUR`) do dia do lembrete; 1 vez por ocorrência. Nunca à meia-noite. |
| Remédio | No horário, até 45 min depois. Não avisa se a dose já foi marcada como tomada. |
| Atividade do parceiro | **1 push por pessoa por ciclo**, resumido ("Ana adicionou 40 itens"). Atividade com mais de 6 h não é enviada. |
| Resumo diário | Só para quem ligou "Resumo diário". Entre **08:00 e 12:00** (`DAILY_HOUR`), 1 vez por dia. Só envia se houver algo. |

Cada tipo respeita a preferência de quem recebe (Configurações → Notificações).

## Dedupe (não repete)
- Datas: grava `notifiedKey` (ocorrência + dias antes) no doc da data.
- Remédios: grava `notifiedSlots` (`YYYY-MM-DD:HH:MM`) no doc do remédio.
- Atividade: marca `notified: true` nos docs.
- Resumo: grava `lastDailyKey` no doc do membro.

## Testes
```
node --test server/logic.test.mjs
```
Cobrem fuso horário, datas (ano/mês/29-fev), janela e dedupe de remédio, agrupamento da atividade e resumo.

## Limites conhecidos
- **iOS:** só funciona com o PWA **instalado na tela inicial**; a permissão precisa vir de um toque;
  sem push silencioso / sem acordar em segundo plano.
- **1 aparelho por pessoa em cada espaço:** ativar no segundo aparelho substitui o primeiro.
- **Só o espaço ativo:** quem participa de mais de um espaço recebe push do espaço em que ativou.
  Ao trocar de espaço, o app regrava a inscrição automaticamente ao abrir.
- Se o cron ficar parado por mais de ~45 min, a janela do remédio daquele horário é perdida.
- A inscrição de push é privada de cada pessoa (regra do Firestore): o parceiro não consegue lê-la.
