import mermaid from 'mermaid';

let initialized = false;

function init() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    fontFamily: "'Ubuntu', 'Helvetica Neue', sans-serif",
    // labels como <text> SVG puro: necessário para export PNG/PDF e para a
    // camada de edição visual manipular o SVG com segurança
    htmlLabels: false,
    flowchart: { htmlLabels: false, curve: 'basis' },
    themeVariables: {
      fontFamily: "'Ubuntu', 'Helvetica Neue', sans-serif",
      fontSize: '15px',
      primaryColor: '#D4CDF4',
      primaryTextColor: '#465775',
      primaryBorderColor: '#465775',
      secondaryColor: '#59C9A5',
      secondaryTextColor: '#1d3d33',
      secondaryBorderColor: '#3da183',
      tertiaryColor: '#ffffff',
      tertiaryTextColor: '#465775',
      tertiaryBorderColor: '#465775',
      lineColor: '#465775',
      textColor: '#465775',
      mainBkg: '#D4CDF4',
      nodeBorder: '#465775',
      clusterBkg: 'rgba(212, 205, 244, 0.18)',
      clusterBorder: '#b7abe8',
      edgeLabelBackground: '#F6E8EA',
      titleColor: '#465775',
      errorBkgColor: '#F6E8EA',
      errorTextColor: '#EF6F6C',
      actorBkg: '#D4CDF4',
      actorBorder: '#465775',
      actorTextColor: '#465775',
      signalColor: '#465775',
      signalTextColor: '#465775',
      labelBoxBkgColor: '#F6E8EA',
      noteBkgColor: '#F6E8EA',
      noteBorderColor: '#EF6F6C',
      pie1: '#465775',
      pie2: '#EF6F6C',
      pie3: '#59C9A5',
      pie4: '#D4CDF4',
      pie5: '#F6E8EA'
    }
  });
  initialized = true;
}

let seq = 0;

/** Renderiza código mermaid e retorna o markup SVG. Lança erro em sintaxe inválida. */
export async function renderMermaid(code: string): Promise<string> {
  if (!initialized) init();
  const id = `mmd-render-${++seq}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } finally {
    // mermaid deixa um elemento temporário no DOM quando o parse falha
    document.getElementById('d' + id)?.remove();
    document.getElementById(id)?.remove();
  }
}
