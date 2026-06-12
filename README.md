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

## Instalar no seu Mac

```bash
npm install
npm run dist
open release/        # abra o "Mermaid Studio-<versão>-universal.dmg"
```

Arraste o app para `Aplicativos`. Como o build foi feito na sua própria máquina, o macOS abre normalmente, sem nenhum aviso.

## Distribuir para colegas e amigos (sem Apple Developer ID)

O app é distribuído **sem assinatura/notarização da Apple**. Funciona normalmente, mas quem baixar o `.dmg` da internet vai esbarrar no Gatekeeper na primeira abertura ("não pode ser aberto" / "está danificado"). Há duas saídas — inclua estas instruções quando compartilhar:

- **Caminho gráfico**: tentar abrir o app uma vez → ir em **Ajustes do Sistema → Privacidade e Segurança** → na seção Segurança, clicar em **"Abrir Assim Mesmo"** ao lado do aviso sobre o Mermaid Studio (e confirmar). Só é preciso uma vez.
- **Caminho terminal** (remove a marca de quarentena):
  ```bash
  xattr -cr "/Applications/Mermaid Studio.app"
  ```

Isso é uma limitação do macOS para qualquer app não assinado, não um defeito do app. Se um dia você tiver um certificado Apple Developer ID, basta configurar os secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` e `APPLE_TEAM_ID` no repositório e os builds passam a sair assinados, sem nenhum outro ajuste.

## Auto-update

O mecanismo já está configurado para `igorvac/mermaidEditor` (em `electron-builder.yml` e `electron/updater.ts`). Para ativá-lo:

1. Crie o repositório **público** `igorvac/mermaidEditor` no GitHub (precisa ser público para os apps instalados consultarem as releases sem token) e faça push do código.
2. A cada push na `main`, o workflow `.github/workflows/release.yml` roda os testes, incrementa a versão patch, builda o app e publica uma GitHub Release.
3. Os apps instalados checam ao abrir e a cada 4 h, e mostram o banner de nova versão.

> ⚠️ **Sem assinatura, a instalação automática não funciona no macOS** — o sistema exige app assinado para o updater trocar o binário sozinho. Na prática, sem certificado o fluxo é: o banner avisa que há versão nova → ao falhar a instalação automática, oferece **"Baixar manualmente"**, que abre a página da release para baixar o novo `.dmg`. Com certificado (secrets acima), o fluxo completo de baixar-e-reiniciar passa a funcionar.

## Licença

[GPL-3.0-or-later](LICENSE) — software livre: use, estude, modifique e redistribua; obras derivadas devem permanecer sob a mesma licença.

## Arquitetura (resumo)

- `electron/` — processo main: janela, menu nativo, IPC de filesystem, updater, export PDF via `printToPDF`.
- `src/mermaid/` — `parser.ts` (flowchart → modelo), `codegen.ts` (modelo → código canônico), `renderer.ts` (mermaid com tema próprio).
- `src/canvas/svgLayout.ts` — aplica offsets de drag ao SVG renderizado e re-roteia arestas.
- `src/store/appStore.ts` — estado global (zustand): projeto, arquivo, código, modelo, seleção, updates.
- O **código é a fonte da verdade**; a GUI edita o modelo e regenera o código. Arquivos com sintaxe flowchart fora do subconjunto suportado caem graciosamente para edição somente-texto.
