import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { CatalogView } from './catalog';
import { featureGraph, labelLines, nodeSize } from './feature-graph';
import type { CoverageLevel, MapNode } from './feature-graph';
import { ActionButton, Surface } from '../../components/ui/ds';

const kinds = {
  project: '專案',
  page: '前端頁面',
  feature: '功能',
  case: '測試情境',
  step: '腳本步驟',
  api: 'API',
  question: '待確認',
};

const coverageStroke: Record<CoverageLevel, string> = {
  full: 'stroke-success',
  partial: 'stroke-warning',
  none: 'stroke-danger',
  retired: 'stroke-muted',
};

const coverageFill: Record<CoverageLevel, string> = {
  full: 'fill-success',
  partial: 'fill-warning',
  none: 'fill-danger',
  retired: 'fill-muted',
};

function coverageShort(level: CoverageLevel, count: number) {
  if (level === 'full') return `充分 (${count})`;
  if (level === 'partial') return `部分 (${count})`;
  if (level === 'retired') return `廢棄 (${count})`;
  return '漏測 (0)';
}

function coverageSummary(level: CoverageLevel, count: number) {
  if (level === 'full') return `充分覆蓋（${count} 個測試案例）`;
  if (level === 'partial') return `部分覆蓋（${count} 個測試案例，建議補齊正反／邊界測試）`;
  if (level === 'retired') return `已下線／廢棄（關聯 ${count} 筆待清理案例）`;
  return '尚未覆蓋（0 個測試案例）';
}

export function FeatureMap({
  view,
  featureId,
  selected,
  onSelect,
  disabled = false,
  layer = 'tests',
}: {
  layer?: string;
  view: CatalogView;
  featureId: string;
  selected?: string;
  onSelect: (node?: MapNode) => void;
  disabled?: boolean;
}) {
  const graph = useMemo(() => featureGraph(view, featureId, layer), [view, featureId, layer]);
  const svg = useRef<SVGSVGElement>(null);
  const arrow = useId().replaceAll(':', '');
  const [frame, setFrame] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState({ x: 470, y: 300, zoom: 1 });
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  const [hovered, setHovered] = useState<string>();
  const current = useRef({ camera, frame });
  current.current = { camera, frame };
  const drag = useRef<
    { id?: string; px: number; py: number; x: number; y: number; moved: boolean } | undefined
  >(undefined);
  const moved = useRef(false);

  const hasRelations =
    featureId === 'overview' && graph.edges.some(edge => edge.id.startsWith('relation:'));
  const visibleEdges = useMemo(
    () => graph.edges.filter(edge => !edge.id.startsWith('relation:') || showRelations),
    [graph.edges, showRelations],
  );
  const positions = new Map(
    graph.nodes.map(node => [
      node.id,
      { ...node, x: node.x + (offsets[node.id]?.x || 0), y: node.y + (offsets[node.id]?.y || 0) },
    ]),
  );

  function fit() {
    setOffsets({});
    setCamera({
      x: graph.width / 2,
      y: graph.height / 2,
      zoom: Math.max(
        0.00001,
        Math.min(1, (frame.width - 48) / graph.width, (frame.height - 48) / graph.height),
      ),
    });
  }

  useEffect(() => {
    if (!svg.current) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      setFrame({ width: rect.width, height: rect.height });
    });
    observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);

  const ready = frame.width > 1;
  useEffect(() => {
    if (!ready) return;
    setOffsets({});
    const fitZoom = Math.max(
      0.00001,
      Math.min(1, (frame.width - 48) / graph.width, (frame.height - 48) / graph.height),
    );
    if (fitZoom < 0.45 && graph.nodes.length > 1) {
      const readableZoom = Math.min(1, Math.max(fitZoom, 0.55));
      setCamera({
        x: graph.width / 2,
        y: Math.min(graph.height / 2, Math.max(200, frame.height / readableZoom / 2 + 16)),
        zoom: readableZoom,
      });
      return;
    }
    setCamera({
      x: graph.width / 2,
      y: graph.height / 2,
      zoom: fitZoom,
    });
  }, [graph, ready]);

  useEffect(() => {
    const node = graph.nodes.find(node => node.id === selected);
    if (node) {
      setCamera(value => ({
        ...value,
        x: node.x + nodeSize.width / 2,
        y: node.y + nodeSize.height / 2,
      }));
    }
  }, [selected]);

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    function wheel(event: WheelEvent) {
      if (disabled) return;
      event.preventDefault();
      const { camera, frame } = current.current;
      const rect = element!.getBoundingClientRect();
      const zoom = Math.max(0.01, Math.min(2, camera.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
      const x = event.clientX - rect.left - frame.width / 2;
      const y = event.clientY - rect.top - frame.height / 2;
      setCamera({
        x: camera.x + x / camera.zoom - x / zoom,
        y: camera.y + y / camera.zoom - y / zoom,
        zoom,
      });
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [disabled]);

  function zoom(factor: number) {
    setCamera(value => ({ ...value, zoom: Math.max(0.01, Math.min(2, value.zoom * factor)) }));
  }

  function start(event: PointerEvent<SVGElement>, node?: MapNode) {
    if (disabled || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    moved.current = false;
    drag.current = {
      id: node?.id,
      px: event.clientX,
      py: event.clientY,
      x: node ? offsets[node.id]?.x || 0 : camera.x,
      y: node ? offsets[node.id]?.y || 0 : camera.y,
      moved: false,
    };
    setDragging(true);
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    const value = drag.current;
    if (!value) return;
    const dx = (event.clientX - value.px) / camera.zoom;
    const dy = (event.clientY - value.py) / camera.zoom;
    if (Math.abs(dx) + Math.abs(dy) > 3) value.moved = true;
    if (value.id) {
      const id = value.id;
      setOffsets(previous => ({ ...previous, [id]: { x: value.x + dx, y: value.y + dy } }));
    } else {
      setCamera(previous => ({ ...previous, x: value.x - dx, y: value.y - dy }));
    }
  }

  function end() {
    moved.current = !!drag.current?.moved;
    drag.current = undefined;
    setDragging(false);
  }

  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (disabled) return;
    if (event.key === '+' || event.key === '=') zoom(1.2);
    else if (event.key === '-') zoom(1 / 1.2);
    else if (event.key === 'Home') fit();
    else if (event.key === 'Escape') onSelect();
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      setCamera(value => ({
        ...value,
        x:
          value.x +
          (event.key === 'ArrowLeft' ? -40 : event.key === 'ArrowRight' ? 40 : 0) / value.zoom,
        y:
          value.y +
          (event.key === 'ArrowUp' ? -40 : event.key === 'ArrowDown' ? 40 : 0) / value.zoom,
      }));
    } else return;
    event.preventDefault();
  }

  const focusNode = hovered || selected;
  const box = [
    camera.x - frame.width / camera.zoom / 2,
    camera.y - frame.height / camera.zoom / 2,
    frame.width / camera.zoom,
    frame.height / camera.zoom,
  ].join(' ');

  return (
    <Surface
      padding="none"
      className="flex min-h-0 flex-col overflow-hidden bg-sidebar"
      aria-label="功能關聯地圖"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2.5">
        <p className="font-medium text-ink">
          {view.catalog.features.find(row => row.id === featureId)?.name || '全部功能'}
        </p>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="地圖控制">
          {hasRelations && (
            <ActionButton
              variant={showRelations ? 'primary' : 'secondary'}
              disabled={disabled}
              aria-pressed={showRelations}
              onClick={() => setShowRelations(value => !value)}
            >
              跳轉／關聯連線
            </ActionButton>
          )}
          <ActionButton
            variant="ghost"
            icon="zoom-out"
            disabled={disabled || camera.zoom <= 0.01}
            onClick={() => zoom(1 / 1.2)}
          >
            縮小
          </ActionButton>
          <output
            className="min-w-12 text-center tabular-nums text-muted"
            aria-label="地圖縮放比例"
          >
            {camera.zoom < 0.01 ? '小於 1%' : `${Math.round(camera.zoom * 100)}%`}
          </output>
          <ActionButton
            variant="ghost"
            icon="zoom-in"
            disabled={disabled || camera.zoom >= 2}
            onClick={() => zoom(1.2)}
          >
            放大
          </ActionButton>
          <ActionButton variant="secondary" icon="fit" disabled={disabled} onClick={fit}>
            適合視窗
          </ActionButton>
        </div>
      </div>

      <svg
        ref={svg}
        viewBox={box}
        data-zoom={camera.zoom}
        aria-label="互動地圖畫布"
        aria-describedby="map-help"
        role="group"
        tabIndex={disabled ? -1 : 0}
        className={`h-map-canvas min-h-map-canvas w-full touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={event => start(event)}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={keyboard}
        onClick={() => {
          if (!moved.current) onSelect();
        }}
      >
        <defs>
          <marker id={arrow} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" className="fill-line-strong" />
          </marker>
        </defs>
        {visibleEdges.map(edge => {
          const from = positions.get(edge.from)!;
          const to = positions.get(edge.to)!;
          const x1 =
            edge.direction === 'left'
              ? from.x
              : edge.direction === 'right'
                ? from.x + nodeSize.width
                : from.x + nodeSize.width / 2;
          const y1 =
            edge.direction === 'down' ? from.y + nodeSize.height : from.y + nodeSize.height / 2;
          const x2 =
            edge.direction === 'left'
              ? to.x + nodeSize.width
              : edge.direction === 'right'
                ? to.x
                : to.x + nodeSize.width / 2;
          const y2 = edge.direction === 'down' ? to.y : to.y + nodeSize.height / 2;
          const middle = edge.direction === 'down' ? (y1 + y2) / 2 : (x1 + x2) / 2;
          const d =
            edge.direction === 'down'
              ? `M ${x1} ${y1} C ${x1} ${middle} ${x2} ${middle} ${x2} ${y2}`
              : `M ${x1} ${y1} C ${middle} ${y1} ${middle} ${y2} ${x2} ${y2}`;
          const related = !!focusNode && (edge.from === focusNode || edge.to === focusNode);
          const dimmed = !!focusNode && !related;
          return (
            <g
              key={edge.id}
              role="img"
              aria-label={`${from.label} 到 ${to.label}：${edge.dashed ? '待確認或宣告的關係' : '已知關係'}`}
              className={dimmed ? 'opacity-25' : undefined}
            >
              <path
                data-map-edge={edge.id}
                d={d}
                fill="none"
                strokeWidth={related ? '2' : '1.5'}
                strokeDasharray={edge.dashed ? '6 5' : undefined}
                markerEnd={`url(#${arrow})`}
                className={related ? 'stroke-ink' : 'stroke-line-strong'}
              />
              {edge.label && (
                <text
                  x={(x1 + x2) / 2 + (edge.direction === 'down' ? 16 : 0)}
                  y={(y1 + y2) / 2 - 10}
                  textAnchor={edge.direction === 'down' ? 'start' : 'middle'}
                  className="fill-muted font-sans text-body"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
        {graph.nodes.map(original => {
          const node = positions.get(original.id)!;
          const active = selected === node.id;
          const strokeClass = active
            ? 'stroke-ink stroke-2'
            : node.coverage
              ? `${coverageStroke[node.coverage]} stroke-2`
              : 'stroke-line-strong stroke-1';
          return (
            <g
              key={node.id}
              data-map-node={node.id}
              role="button"
              aria-label={kinds[node.kind] + '：' + node.label}
              aria-pressed={active}
              aria-disabled={disabled || undefined}
              tabIndex={disabled ? -1 : 0}
              transform={`translate(${node.x} ${node.y})`}
              className="group cursor-pointer focus-visible:outline-none"
              onPointerEnter={() => setHovered(node.id)}
              onPointerLeave={() => setHovered(value => (value === node.id ? undefined : value))}
              onFocus={() => setHovered(node.id)}
              onBlur={() => setHovered(value => (value === node.id ? undefined : value))}
              onPointerDown={event => start(event, node)}
              onClick={event => {
                event.stopPropagation();
                if (!disabled && !moved.current) onSelect(original);
              }}
              onKeyDown={event => {
                if (
                  event.altKey &&
                  ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  setOffsets(previous => ({
                    ...previous,
                    [node.id]: {
                      x:
                        (previous[node.id]?.x || 0) +
                        (event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0),
                      y:
                        (previous[node.id]?.y || 0) +
                        (event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0),
                    },
                  }));
                  return;
                }
                if (['Enter', ' '].includes(event.key)) {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!disabled) onSelect(original);
                }
              }}
            >
              <title>
                {node.coverage
                  ? `${node.label}（${coverageSummary(node.coverage, node.caseCount ?? 0)}）`
                  : node.label}
              </title>
              <rect
                width={nodeSize.width}
                height={nodeSize.height}
                rx="8"
                strokeDasharray={node.coverage === 'retired' ? '6 4' : undefined}
                className={`fill-surface group-hover:stroke-ink group-focus-visible:stroke-2 group-focus-visible:stroke-ink ${strokeClass}`}
              />
              <text
                x="16"
                y="23"
                className={`font-sans text-body ${node.kind === 'question' ? 'fill-warning' : 'fill-muted'}`}
              >
                {kinds[node.kind]}
                {node.level ? ` · L${node.level}` : ''}
              </text>
              {node.coverage && (
                <>
                  <circle
                    cx={nodeSize.width - 18}
                    cy="18"
                    r="3.5"
                    className={coverageFill[node.coverage]}
                  />
                  <text
                    x={nodeSize.width - 28}
                    y="23"
                    textAnchor="end"
                    className={`font-sans text-body font-medium ${coverageFill[node.coverage]}`}
                  >
                    {coverageShort(node.coverage, node.caseCount ?? 0)}
                  </text>
                </>
              )}
              <text x="16" y="49" className="fill-ink font-sans text-body font-medium">
                {labelLines(node.label).map((line, index) => (
                  <tspan key={index} x="16" dy={index ? 20 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-2.5 text-muted">
        <p id="map-help">
          實線：已知關聯 · 虛線：待確認／宣告 · 綠：充分 · 黃：部分 · 紅：漏測 · 灰：已廢棄
        </p>
        <details>
          <summary className="min-h-8 cursor-pointer rounded-lg px-2 py-1 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            操作說明
          </summary>
          <p className="max-w-prose pt-2">
            拖曳畫布移動、滾輪縮放；節點可拖曳調整檢視。鍵盤方向鍵平移，＋／－縮放，Home 重設，Alt＋方向鍵移動節點，Enter 查看詳情。
          </p>
        </details>
      </div>
    </Surface>
  );
}
