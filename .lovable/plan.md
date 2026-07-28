
# Integração One Page Report ↔ SharePoint

## Visão geral
Conectar o app a **uma conta corporativa Microsoft** via connector SharePoint da Lovable. Cada projeto ganha um campo com a URL do arquivo Excel no SharePoint. Um botão **"Sincronizar SharePoint"** baixa o arquivo mais recente e roda o parser existente (formatos A/B/C/D) — sem intervenção manual.

## Passos

### 1. Conectar Microsoft SharePoint (workspace)
Uso do `standard_connectors--connect` com `microsoft_sharepoint`. Isso abre um card onde alguém com acesso à conta corporativa faz login uma vez. As credenciais ficam no gateway da Lovable; o app nunca vê o token.

### 2. Campo "SharePoint URL" por projeto
Adicionar em `ProjectInfo` um campo opcional `sharepointUrl`. Editável na aba **Dados** (topo, junto com os outros metadados do projeto). Aceita:
- URL completa do arquivo (`.../Documents/Projetos/GUAXE/Status.xlsx`)
- URL de compartilhamento do SharePoint (`.../:x:/r/sites/.../Status.xlsx?...`)

### 3. Edge function `sharepoint-fetch`
Rota interna que recebe `{ sharepointUrl }`, resolve o arquivo via Microsoft Graph através do gateway e devolve os bytes do `.xlsx` em base64.

Fluxo:
1. Parseia a URL → extrai hostname, site-path e caminho do arquivo (ou shareId codificado se for link de compartilhamento).
2. Chama Graph via gateway:
   - Link de compartilhamento → `GET /shares/{shareId}/driveItem/content`
   - Caminho direto → `GET /sites/{host}:/sites/{path}:/drive/root:/{filepath}:/content`
3. Retorna `{ filename, contentBase64, lastModified }`.

### 4. Botão "Sincronizar SharePoint"
Adicionado no cabeçalho do relatório (`ReportHeader`) e ao lado do seletor de arquivo em `WeeklyImportModal`. Só aparece quando o projeto tem `sharepointUrl` configurada.

Ao clicar:
1. Chama a edge function.
2. Converte base64 → `File` no browser.
3. Alimenta o pipeline de parsing atual (mesmo caminho do upload manual — detecção A/B/C/D, preview, confirmação).
4. Salva a data/hora de sincronização em `info.atualizadoEm` e registra `info.sharepointLastSync`.
5. Toast de sucesso: "Sincronizado — versão de dd/mm/aaaa hh:mm".

### 5. Feedback visual
- Botão mostra spinner durante o fetch.
- Se a URL estiver inválida ou o arquivo não for encontrado, exibe o erro exato retornado pelo Graph (missing scope, 404, etc.).
- Cabeçalho do relatório mostra "Última sincronização SharePoint: dd/mm/aaaa hh:mm" quando disponível.

## Detalhes técnicos

**Escopo do connector:** `Sites.Read.All` (leitura de qualquer site que a conta corporativa acessa).

**Arquivos alterados:**
- `src/store/projectStore.ts` — adicionar `sharepointUrl` e `sharepointLastSync` em `ProjectInfo`; nova ação `setSharepointUrl`.
- `src/pages/DataInput.tsx` — input de URL do SharePoint no bloco de informações do projeto.
- `src/components/ReportHeader.tsx` — botão "Sincronizar SharePoint" + timestamp.
- `src/components/WeeklyImportModal.tsx` — expor função utilitária que aceita `File` externo (refactor mínimo para reutilizar o fluxo `runImport` a partir do botão de sync).
- `supabase/functions/sharepoint-fetch/index.ts` — edge function nova.
- `supabase/config.toml` — não precisa alterar (verify_jwt padrão).

**Parser de URL do SharePoint:**
- Se contém `/:x:/` ou `/:b:/` → link de compartilhamento; codifica como shareId (`u!` + base64url) e usa `/shares/{id}/driveItem`.
- Se contém `/sites/{site}/Documents/...` → resolve pelo caminho.

**Segurança:**
- A edge function não expõe o token; usa o gateway (`LOVABLE_API_KEY` + `MICROSOFT_SHAREPOINT_API_KEY`).
- Como o app é aberto, qualquer visitante pode acionar o sync. Isso é aceitável no modelo atual (mesma premissa dos dados públicos). Caso queira restringir depois, aplicamos autenticação no app.

## O que fica fora deste passo
- Sincronização automática/agendada (pode ser adicionada depois com um cron).
- Escrita de volta no SharePoint (só leitura).
- Autenticação por usuário no app.

Se aprovado, sigo com a implementação.
