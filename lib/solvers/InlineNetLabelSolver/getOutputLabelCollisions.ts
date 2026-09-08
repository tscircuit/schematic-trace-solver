import type { InlineNetLabelOutput } from "./InlineNetLabelSolver"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"
import { getInlineTerminalBounds } from "./getInlineLabelObstacles"
import { boundsOverlap } from "lib/utils/textBoxBounds"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

type LabelIdentity = { globalConnNetId: string; pinIds: string[] }
type TraceIdentity =
  | { kind: "routed"; id: string }
  | { kind: "terminal"; label: LabelIdentity }

export type OutputLabelCollision =
  | { kind: "label-label"; labels: [LabelIdentity, LabelIdentity] }
  | {
      kind: "trace-label"
      trace: TraceIdentity
      label: LabelIdentity
      target: "text" | "terminal"
    }

const sameLabel = (a: LabelIdentity, b: LabelIdentity) => {
  const first = [...a.pinIds].sort()
  const second = [...b.pinIds].sort()
  return (
    a.globalConnNetId === b.globalConnNetId &&
    first.length === second.length &&
    first.every((pinId, index) => pinId === second[index])
  )
}

export const sameOutputLabelCollision = (
  a: OutputLabelCollision,
  b: OutputLabelCollision,
): boolean => {
  if (a.kind === "label-label" && b.kind === "label-label")
    return (
      (sameLabel(a.labels[0], b.labels[0]) &&
        sameLabel(a.labels[1], b.labels[1])) ||
      (sameLabel(a.labels[0], b.labels[1]) &&
        sameLabel(a.labels[1], b.labels[0]))
    )
  if (a.kind !== "trace-label" || b.kind !== "trace-label") return false
  const sameTrace =
    a.trace.kind === "routed" && b.trace.kind === "routed"
      ? a.trace.id === b.trace.id
      : a.trace.kind === "terminal" &&
        b.trace.kind === "terminal" &&
        sameLabel(a.trace.label, b.trace.label)
  return sameTrace && a.target === b.target && sameLabel(a.label, b.label)
}

/** Identify final geometry conflicts without interpreting opaque identifiers. */
export const getOutputLabelCollisions = (
  output: Omit<InlineNetLabelOutput, "inputProblem">,
) => {
  const labels = [
    ...output.netLabelPlacements,
    ...output.inlineNetLabelPlacements,
  ].map((label) => ({
    label,
    bounds:
      "axis" in label
        ? {
            minX:
              label.center.x -
              (label.axis === "x" ? label.width : label.height) / 2,
            maxX:
              label.center.x +
              (label.axis === "x" ? label.width : label.height) / 2,
            minY:
              label.center.y -
              (label.axis === "x" ? label.height : label.width) / 2,
            maxY:
              label.center.y +
              (label.axis === "x" ? label.height : label.width) / 2,
          }
        : getAnchoredNetLabelRenderedBounds(label),
  }))
  const collisions: OutputLabelCollision[] = []
  const add = (collision: OutputLabelCollision) => {
    if (!collisions.some((other) => sameOutputLabelCollision(collision, other)))
      collisions.push(collision)
  }
  for (let i = 0; i < labels.length; i++)
    for (const other of labels.slice(i + 1)) {
      if (boundsOverlap(labels[i]!.bounds, other.bounds))
        add({ kind: "label-label", labels: [labels[i]!.label, other.label] })
    }
  const traces = [
    ...output.traces.map((trace) => ({
      ...trace,
      identity: { kind: "routed", id: trace.mspPairId } satisfies TraceIdentity,
    })),
    ...output.inlineNetLabelPlacements.flatMap((label) =>
      label.stubTracePath
        ? [
            {
              identity: { kind: "terminal", label } satisfies TraceIdentity,
              globalConnNetId: label.globalConnNetId,
              tracePath: label.stubTracePath,
            },
          ]
        : [],
    ),
  ]
  for (const trace of traces)
    for (const { label, bounds } of labels) {
      if (
        ("axis" in label || label.globalConnNetId !== trace.globalConnNetId) &&
        trace.tracePath
          .slice(1)
          .some((end, index) =>
            segmentIntersectsRect(trace.tracePath[index]!, end, bounds),
          )
      )
        add({
          kind: "trace-label",
          trace: trace.identity,
          label,
          target: "text",
        })
    }
  for (const label of output.inlineNetLabelPlacements) {
    const bounds = getInlineTerminalBounds(label)
    if (!bounds) continue
    for (const trace of output.traces) {
      // A route attached to the terminal's own pin is an intentional connection.
      if (trace.pinIds.some((pinId) => label.pinIds.includes(pinId))) continue
      if (
        trace.tracePath
          .slice(1)
          .some((end, index) =>
            segmentIntersectsRect(trace.tracePath[index]!, end, bounds),
          )
      )
        add({
          kind: "trace-label",
          trace: { kind: "routed", id: trace.mspPairId },
          label,
          target: "terminal",
        })
    }
  }
  return collisions
}
