# Mermaid Studio

Editor desktop de diagramas [Mermaid](https://mermaid.js.org) para macOS — visual e por código, 100% offline.

![stack](https://img.shields.io/badge/Electron-React-465775) ![mermaid](https://img.shields.io/badge/Mermaid-11-D4CDF4)

## Funcionalidades

- **Edição bidirecional em tempo real**: digite código Mermaid e veja o diagrama instantaneamente, ou edite o diagrama visualmente e veja o código se regenerar.
- **Edição visual de flowcharts**: clique para selecionar, duplo-clique para renomear, toolbar para adicionar nós (9 formas) e conexões, Inspector para forma/cor/rótulo/tipo de linha, `Delete` para excluir.
- **Drag & drop**: arraste nós para reposicioná-los. Como a sintaxe Mermaid não suporta posições, os offsets ficam num sidecar `<arquivo>.mmd.layout.json` ao lado do arquivo (versionável). O botão ✨ restaura o layout automático.
- **Todos os tipos de diagrama** renderizam ao vivo (sequence, class, ER, gantt, state, pie, mindmap…); a edição visual é específica de flowcharts.
- **Projetos**: um projeto é uma pasta no disco com arquivos `.mmd`/`.mermaid`, com subpastas, criação, renomeação, duplicação e lixeira. Autosave com indicador de não-salvo.
- **Exportação** em SVG (vetorial, fonte embutida), PNG (2x) e PDF (vetorial via impressão nativa).
- **100% offline**: mermaid, fontes (Ubuntu) e ícones (Material Symbols) empacotados no app. A única chamada de rede é a checagem opcional de atualização.
- **Auto-update gráfico**: banner no app quando uma nova versão é publicada no GitHub Releases.

## Atalhos

| Atalho | Ação |
|---|---|
| ⌘N / ⇧⌘N / ⌘O | Novo diagrama / Novo projeto / Abrir projeto |
| ⌘S | Salvar agora (autosave já é automático) |
| ⇧⌘E | Exportar PNG |
| ⌘+ / ⌘− / ⌘0 / ⇧⌘0 | Zoom in / out / 100% / ajustar à tela |
| ⇧⌘L / ⇧⌘B | Alternar painel de código / barra lateral |
| Delete · Esc | Excluir seleção · cancelar seleção/ferramenta |
| Scroll / ⌘+scroll (pinch) | Pan / zoom no canvas |

## Desenvolvimento

```bash
npm install
npm run dev        # vite + electron com hot reload
npm test           # testes do parser/codegen (vitest)
npm run typecheck
npm run dist       # gera o .dmg em release/
```

Abrindo `http://localhost:5180` num navegador comum, um mock em memória de `window.api` é usado — útil para mexer na UI sem o Electron.

## Auto-update — o que falta configurar

O mecanismo já está pronto (electron-updater + workflow do GitHub Actions). Quando criar o repositório GitHub:

1. Substitua `OWNER`/`REPO` em **dois lugares**:
   - `electron-builder.yml` (chave `publish`)
   - `electron/updater.ts` (constantes `GITHUB_OWNER`/`GITHUB_REPO`)
2. Faça push para a branch `main`: o workflow `.github/workflows/release.yml` roda os testes, incrementa a versão patch, builda o app e publica uma GitHub Release automaticamente.
3. Os apps instalados detectam a release (ao abrir e a cada 4 h) e mostram o banner de atualização com download e barra de progresso.

> ⚠️ **Assinatura obrigatória no macOS**: o auto-update só consegue *instalar* a atualização se o app for assinado (Apple Developer ID) e notarizado. Configure os secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` e `APPLE_TEAM_ID` no repositório. Sem certificado, o banner ainda avisa sobre a nova versão e oferece o download manual pela página de releases.

## Arquitetura (resumo)

- `electron/` — processo main: janela, menu nativo, IPC de filesystem, updater, export PDF via `printToPDF`.
- `src/mermaid/` — `parser.ts` (flowchart → modelo), `codegen.ts` (modelo → código canônico), `renderer.ts` (mermaid com tema próprio).
- `src/canvas/svgLayout.ts` — aplica offsets de drag ao SVG renderizado e re-roteia arestas.
- `src/store/appStore.ts` — estado global (zustand): projeto, arquivo, código, modelo, seleção, updates.
- O **código é a fonte da verdade**; a GUI edita o modelo e regenera o código. Arquivos com sintaxe flowchart fora do subconjunto suportado caem graciosamente para edição somente-texto.
