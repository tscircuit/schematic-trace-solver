import type { GraphicsObject } from "graphics-debug"
import { getBounds, getSvgFromGraphicsObject } from "graphics-debug"
import { InteractiveGraphics } from "graphics-debug/react"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { useMemo } from "react"
import { applyToPoint, compose, scale, translate } from "transformation-matrix"
import { issue34InputProblem } from "./issue-34-input"

const SVG_SIZE = 640
const SVG_PADDING = 40

/** Zoom: horizontal bus area between U1 and U2 (VCC / GND alleys). */
const TRACE_FOCUS_CLIP = {
  minX: -0.35,
  maxX: 1.35,
  minY: -0.72,
  maxY: 0.72,
} as const

function projectionMatrix(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  svgWidth: number,
  svgHeight: number,
) {
  const width = bounds.maxX - bounds.minX || 1
  const height = bounds.maxY - bounds.minY || 1
  const scaleFactor = Math.min(
    (svgWidth - 2 * SVG_PADDING) / width,
    (svgHeight - 2 * SVG_PADDING) / height,
  )
  return compose(
    translate(svgWidth / 2, svgHeight / 2),
    scale(scaleFactor, -scaleFactor),
    translate(-(bounds.minX + width / 2), -(bounds.minY + height / 2)),
  )
}

function pixelViewBoxForSchematicClip(
  graphics: GraphicsObject,
  clip: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const fullBounds = getBounds(graphics)
  const M = projectionMatrix(fullBounds, SVG_SIZE, SVG_SIZE)
  const corners = [
    { x: clip.minX, y: clip.minY },
    { x: clip.maxX, y: clip.minY },
    { x: clip.maxX, y: clip.maxY },
    { x: clip.minX, y: clip.maxY },
  ]
  let minPxX = Infinity
  let minPxY = Infinity
  let maxPxX = -Infinity
  let maxPxY = -Infinity
  for (const c of corners) {
    const p = applyToPoint(M, c)
    minPxX = Math.min(minPxX, p.x)
    maxPxX = Math.max(maxPxX, p.x)
    minPxY = Math.min(minPxY, p.y)
    maxPxY = Math.max(maxPxY, p.y)
  }
  const pad = 14
  return {
    x: minPxX - pad,
    y: minPxY - pad,
    w: maxPxX - minPxX + 2 * pad,
    h: maxPxY - minPxY + 2 * pad,
  }
}

function countTraceSegments(
  traceMap: Record<MspConnectionPairId, SolvedTracePath>,
): number {
  let n = 0
  for (const t of Object.values(traceMap)) {
    n += Math.max(0, t.tracePath.length - 1)
  }
  return n
}

/** Long horizontal bus segments in the zoom band (VCC + GND each contribute one). */
function countParallelBusSegmentsInClip(
  traceMap: Record<MspConnectionPairId, SolvedTracePath>,
): number {
  let n = 0
  for (const t of Object.values(traceMap)) {
    const pts = t.tracePath
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!
      const b = pts[i + 1]!
      if (Math.abs(a.y - b.y) > 1e-9) continue
      const y = (a.y + b.y) / 2
      if (Math.abs(y) < 0.35 || Math.abs(y) > 0.75) continue
      const x0 = Math.min(a.x, b.x)
      const x1 = Math.max(a.x, b.x)
      if (x1 < TRACE_FOCUS_CLIP.minX || x0 > TRACE_FOCUS_CLIP.maxX) continue
      if (x1 - x0 < 0.8) continue
      n++
    }
  }
  return n
}

function SvgZoomInset(props: {
  fullSvgMarkup: string
  clip: { x: number; y: number; w: number; h: number }
  caption: string
}) {
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(props.fullSvgMarkup)}`
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          margin: "10px 0 6px",
          color: "#374151",
        }}
      >
        {props.caption}
      </div>
      <div
        style={{
          border: "1px dashed #bbb",
          borderRadius: 6,
          overflow: "hidden",
          background: "white",
          height: 200,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${props.clip.x} ${props.clip.y} ${props.clip.w} ${props.clip.h}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <image href={dataUrl} width="640" height="640" />
        </svg>
      </div>
    </div>
  )
}

export default function Issue34ReproPage() {
  const {
    beforeGraphics,
    afterGraphics,
    beforeSvg,
    afterSvg,
    beforeClip,
    afterClip,
    beforeTotalSegments,
    afterTotalSegments,
    beforeBusCount,
    afterBusCount,
  } = useMemo(() => {
    const before = new SchematicTracePipelineSolver(issue34InputProblem)
    before.solveUntilPhase("sameNetTraceLineMergeSolver")
    const beforeMap = before.traceOverlapShiftSolver!.correctedTraceMap
    const beforeGraphicsInner = before.visualize() as GraphicsObject

    const after = new SchematicTracePipelineSolver(issue34InputProblem)
    after.solve()
    const mergedMap = after.sameNetTraceLineMergeSolver!.mergedTraceMap
    const afterGraphicsInner = after.visualize() as GraphicsObject

    const svgOpts = { backgroundColor: "white" as const }
    const beforeSvgInner = getSvgFromGraphicsObject(
      beforeGraphicsInner,
      svgOpts,
    )
    const afterSvgInner = getSvgFromGraphicsObject(afterGraphicsInner, svgOpts)

    return {
      beforeGraphics: beforeGraphicsInner,
      afterGraphics: afterGraphicsInner,
      beforeSvg: beforeSvgInner,
      afterSvg: afterSvgInner,
      beforeClip: pixelViewBoxForSchematicClip(
        beforeGraphicsInner,
        TRACE_FOCUS_CLIP,
      ),
      afterClip: pixelViewBoxForSchematicClip(
        afterGraphicsInner,
        TRACE_FOCUS_CLIP,
      ),
      beforeTotalSegments: countTraceSegments(beforeMap),
      afterTotalSegments: countTraceSegments(mergedMap),
      beforeBusCount: countParallelBusSegmentsInClip(beforeMap),
      afterBusCount: countParallelBusSegmentsInClip(mergedMap),
    }
  }, [])

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>Issue #34 — same-net trace merge</h2>
      <p style={{ maxWidth: 820 }}>
        Two ICs with <code>VCC</code> on the upper pins and <code>GND</code> on
        the lower pins. Orthogonal routing forms two long, nearly stacked
        horizontal buses between the chips; overlap shifting brings them close
        in&nbsp;Y. <code>SameNetTraceLineMergeSolver</code> then cleans same-net
        collinear fragments (see full pipeline on the right).
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 28,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "1 1 340px", minWidth: 300 }}>
          <h3 style={{ margin: "0 0 8px" }}>
            BEFORE — pre-merge (overlap-shift output only)
          </h3>
          <p style={{ fontSize: 13, margin: "0 0 8px", color: "#555" }}>
            Pipeline stopped before <code>SameNetTraceLineMergeSolver</code>.
            Purple / green polylines are the routed traces; inset highlights the
            parallel horizontal buses.
          </p>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
              minHeight: 360,
              background: "white",
            }}
          >
            <InteractiveGraphics graphics={beforeGraphics} />
          </div>
          <SvgZoomInset
            fullSvgMarkup={beforeSvg}
            clip={beforeClip}
            caption="Zoomed inset — VCC and GND buses between chips"
          />
          <div style={{ fontSize: 14, margin: "8px 0 0", color: "#111" }}>
            <div>
              <strong>Long horizontal buses in inset band:</strong>{" "}
              {beforeBusCount}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Orthogonal segments (sum over paths, pre-merge):{" "}
              {beforeTotalSegments}
            </div>
          </div>
        </div>

        <div style={{ flex: "1 1 340px", minWidth: 300 }}>
          <h3 style={{ margin: "0 0 8px" }}>AFTER — full pipeline (solved)</h3>
          <div
            style={{
              fontSize: 13,
              margin: "0 0 10px",
              padding: "10px 12px",
              background: "#f0fdfa",
              border: "1px solid #99f6e4",
              borderRadius: 8,
              color: "#134e4a",
              lineHeight: 1.5,
            }}
          >
            <div>
              Uses <code>afterSolver.solve()</code> then{" "}
              <code>afterSolver.visualize()</code> (same as{" "}
              <code>GenericSolverDebugger</code>) so chips, pins, and all trace
              layers render together.
            </div>
            <div style={{ marginTop: 6 }}>
              Teal segments include output from{" "}
              <code>SameNetTraceLineMergeSolver</code>; other colors come from
              earlier pipeline stages and labels.
            </div>
          </div>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
              minHeight: 360,
              background: "white",
            }}
          >
            <InteractiveGraphics graphics={afterGraphics} />
          </div>
          <SvgZoomInset
            fullSvgMarkup={afterSvg}
            clip={afterClip}
            caption="Zoomed inset — same region after full solve"
          />
          <div style={{ fontSize: 14, margin: "8px 0 0", color: "#111" }}>
            <div>
              <strong>Long horizontal buses in inset band:</strong>{" "}
              {afterBusCount}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Orthogonal segments (sum over paths, merged map):{" "}
              {afterTotalSegments}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
