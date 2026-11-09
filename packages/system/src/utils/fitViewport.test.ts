import { describe, expect, it, vi } from 'vitest';

import type { FitViewOptionsBase, InternalNodeBase, NodeBase, PanZoomInstance } from '../types';
import { fitViewport } from './graph';

function createNode(overrides: Partial<InternalNodeBase> = {}): InternalNodeBase {
  const node: NodeBase = { id: 'node', data: {}, position: { x: 100, y: 200 } };
  return {
    ...node,
    measured: { width: 100, height: 50 },
    internals: { positionAbsolute: node.position, z: 0, isParent: false, userNode: node },
    ...overrides,
  };
}

function setup(nodes: InternalNodeBase[]) {
  const setViewport = vi.fn<PanZoomInstance['setViewport']>().mockResolvedValue(true);
  return {
    setViewport,
    params: {
      nodes: new Map(nodes.map((node) => [node.id, node])),
      width: 800,
      height: 600,
      minZoom: 0.5,
      maxZoom: 2,
      panZoom: { setViewport } as unknown as PanZoomInstance,
    },
  };
}

describe('fitViewport', () => {
  it.each([
    { name: 'an empty graph', nodes: [] },
    { name: 'only hidden nodes', nodes: [createNode({ hidden: true })] },
    { name: 'only unmeasured nodes', nodes: [createNode({ measured: {} })] },
    { name: 'only zero-sized nodes', nodes: [createNode({ measured: { width: 0, height: 50 } })] },
  ])('preserves the viewport for $name', async ({ nodes }) => {
    const { params, setViewport } = setup(nodes);
    expect(await fitViewport(params)).toBe(true);
    expect(setViewport).not.toHaveBeenCalled();
  });

  it.each([{ nodes: [] }, { nodes: [{ id: 'missing' }] }])(
    'preserves the viewport when the node filter matches nothing: $nodes',
    async ({ nodes }) => {
      const { params, setViewport } = setup([createNode()]);
      const options: FitViewOptionsBase<NodeBase> = { nodes };
      expect(await fitViewport(params, options)).toBe(true);
      expect(setViewport).not.toHaveBeenCalled();
    }
  );

  it('still fits eligible nodes and returns the transition result', async () => {
    const { params, setViewport } = setup([createNode(), createNode({ id: 'hidden', hidden: true })]);
    setViewport.mockResolvedValue(false);
    expect(await fitViewport(params, { padding: 0, duration: 200 })).toBe(false);
    expect(setViewport).toHaveBeenCalledExactlyOnceWith(
      { x: 100, y: -150, zoom: 2 },
      { duration: 200, ease: undefined, interpolate: undefined }
    );
  });

  it('still includes hidden nodes when requested', async () => {
    const { params, setViewport } = setup([createNode({ hidden: true })]);
    const options: FitViewOptionsBase<NodeBase> = { includeHiddenNodes: true, padding: 0 };
    expect(await fitViewport(params, options)).toBe(true);
    expect(setViewport).toHaveBeenCalledOnce();
  });
});
