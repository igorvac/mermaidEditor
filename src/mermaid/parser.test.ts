import { describe, expect, it } from 'vitest';
import { parseFlow, detectDiagramType } from './parser';
import { genFlow, nextNodeId } from './codegen';

describe('parseFlow', () => {
  it('analisa um flowchart básico', () => {
    const model = parseFlow(`flowchart TD
  a[Início] --> b{Decisão}
  b -->|Sim| c([Fim])
  b -->|Não| a
`);
    expect(model).not.toBeNull();
    expect(model!.direction).toBe('TD');
    expect(model!.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(model!.nodes[1].shape).toBe('diamond');
    expect(model!.nodes[2].shape).toBe('stadium');
    expect(model!.edges).toHaveLength(3);
    expect(model!.edges[1]).toMatchObject({ from: 'b', to: 'c', label: 'Sim', type: 'arrow' });
  });

  it('aceita graph LR e cadeias de nós', () => {
    const model = parseFlow('graph LR\n  a --> b --> c --> d\n');
    expect(model).not.toBeNull();
    expect(model!.header).toBe('graph');
    expect(model!.edges).toHaveLength(3);
    expect(model!.nodes.every((n) => !n.defined)).toBe(true);
  });

  it('reconhece todas as formas do subconjunto', () => {
    const model = parseFlow(`flowchart TD
  r[ret] --> o(round)
  s([stadium]) --> c((circle))
  d{diamond} --> h{{hex}}
  sub[[subroutine]] --> cy[(cylinder)]
  as>asym] --> r
`);
    expect(model).not.toBeNull();
    const shapes = Object.fromEntries(model!.nodes.map((n) => [n.id, n.shape]));
    expect(shapes).toEqual({
      r: 'rect',
      o: 'round',
      s: 'stadium',
      c: 'circle',
      d: 'diamond',
      h: 'hexagon',
      sub: 'subroutine',
      cy: 'cylinder',
      as: 'asymmetric'
    });
  });

  it('suporta tipos de aresta e rótulos com aspas', () => {
    const model = parseFlow(`flowchart LR
  a --- b
  a -.-> c
  a ==> d
  a -- durante --> e
  a -->|"com aspas"| f
`);
    expect(model).not.toBeNull();
    const types = model!.edges.map((e) => e.type);
    expect(types).toEqual(['open', 'dotted', 'thick', 'arrow', 'arrow']);
    expect(model!.edges[3].label).toBe('durante');
    expect(model!.edges[4].label).toBe('com aspas');
  });

  it('suporta subgraphs com direction e preserva extras', () => {
    const model = parseFlow(`flowchart TB
  subgraph s1 [Bloco um]
    direction LR
    a --> b
  end
  b --> c
  classDef destaque fill:#EF6F6C
  class c destaque
  style a fill:#59C9A5
`);
    expect(model).not.toBeNull();
    expect(model!.subgraphs).toHaveLength(1);
    expect(model!.subgraphs[0].direction).toBe('LR');
    expect(model!.nodes.find((n) => n.id === 'a')!.subgraph).toBe(0);
    expect(model!.nodes.find((n) => n.id === 'c')!.subgraph).toBeUndefined();
    expect(model!.extras).toHaveLength(3);
  });

  it('retorna null para outros tipos de diagrama', () => {
    expect(parseFlow('sequenceDiagram\n  A->>B: oi\n')).toBeNull();
    expect(parseFlow('pie\n  "a": 10\n')).toBeNull();
  });

  it('retorna null para sintaxe flowchart fora do subconjunto', () => {
    expect(parseFlow('flowchart TD\n  a & b --> c\n')).toBeNull();
    expect(parseFlow('flowchart TD\n  a --o b\n')).toBeNull();
  });

  it('preserva diretivas init antes do header', () => {
    const model = parseFlow(`%%{init: {"theme": "base"}}%%
flowchart TD
  a --> b
`);
    expect(model).not.toBeNull();
    expect(model!.init).toEqual(['%%{init: {"theme": "base"}}%%']);
  });
});

describe('round-trip parse → gen → parse', () => {
  const samples = [
    'flowchart TD\n  a[Início] --> b{Decisão}\n  b -->|Sim| c([Fim])\n  b -->|Não| a\n',
    'graph LR\n  a --> b --> c\n  c -.-> a\n',
    'flowchart TB\n  subgraph s1 [Grupo]\n    direction LR\n    x[Um] --> y(Dois)\n  end\n  y ==> z{{Três}}\n  style x fill:#59C9A5\n',
    'flowchart RL\n  a((Círculo)) --- b[(Banco)]\n  b -- "rótulo, especial" --> c>Bandeira]\n'
  ];

  for (const [i, code] of samples.entries()) {
    it(`amostra ${i + 1} é estável`, () => {
      const m1 = parseFlow(code);
      expect(m1).not.toBeNull();
      const generated = genFlow(m1!);
      const m2 = parseFlow(generated);
      expect(m2).not.toBeNull();
      expect(m2).toEqual(m1);
      // segunda geração idêntica (forma canônica estável)
      expect(genFlow(m2!)).toBe(generated);
    });
  }
});

describe('utilitários', () => {
  it('nextNodeId evita colisões', () => {
    const model = parseFlow('flowchart TD\n  n1 --> n2\n')!;
    expect(nextNodeId(model)).toBe('n3');
  });

  it('detectDiagramType lê a primeira linha útil', () => {
    expect(detectDiagramType('%% comentário\nsequenceDiagram\n')).toBe('sequenceDiagram');
    expect(detectDiagramType('flowchart TD\n')).toBe('flowchart');
  });
});
