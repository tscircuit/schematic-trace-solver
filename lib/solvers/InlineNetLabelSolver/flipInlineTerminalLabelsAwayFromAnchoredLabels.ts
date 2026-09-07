import type { Bounds, Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

const getBounds = (label: InlineNetLabelPlacement): Bounds => {
  const width = label.axis === "x" ? label.width : label.height
  const height = label.axis === "x" ? label.height : label.width
  return {
    minX: label.center.x - width / 2,
    maxX: label.center.x + width / 2,
    minY: label.center.y - height / 2,
    maxY: label.center.y + height / 2,
  }
}

const pathIntersectsBounds = (path: Point[], bounds: Bounds) =>
  path.slice(1).some((end, index) => {
    const start = path[index]!
    return boundsOverlap(bounds, {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y),
    })
  })

/**
 * Retry the other side of a terminal wire before falling back to an anchored
 * label. A flipped label can require its neighbor to flip too; propagate that
 * constraint and commit the whole chain only when every placement is clear.
 * Wires stay fixed, and a label is visited at most once per attempted chain.
 */
export const flipInlineTerminalLabelsAwayFromAnchoredLabels = ({
  inputProblem,
  traces,
  anchoredNetLabelPlacements,
  inlineNetLabelPlacements,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  anchoredNetLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
}) => {
  let output = [...inlineNetLabelPlacements]
  const fixedBounds = [
    ...inputProblem.chips.map((chip) => ({
      minX: chip.center.x - chip.width / 2,
      maxX: chip.center.x + chip.width / 2,
      minY: chip.center.y - chip.height / 2,
      maxY: chip.center.y + chip.height / 2,
    })),
    ...(inputProblem.textBoxes ?? []).map((textBox) =>
      getTextBoxBounds(textBox),
    ),
  ]
  const anchoredBounds = anchoredNetLabelPlacements.map((label) => ({
    globalConnNetId: label.globalConnNetId,
    bounds: getAnchoredNetLabelRenderedBounds(label),
  }))

  for (let index = 0; index < output.length; index++) {
    const label = output[index]!
    if (
      !label.stubTracePath ||
      !anchoredBounds.some(
        (anchor) =>
          anchor.globalConnNetId !== label.globalConnNetId &&
          boundsOverlap(getBounds(label), anchor.bounds),
      )
    ) {
      continue
    }

    const trial = [...output]
    const flipped = new Set<number>()
    const tryFlip = (movingIndex: number): boolean => {
      const current = trial[movingIndex]!
      if (!current.stubTracePath || flipped.has(movingIndex)) return false
      const proposed: InlineNetLabelPlacement = {
        ...current,
        side:
          current.side === "y+"
            ? "y-"
            : current.side === "y-"
              ? "y+"
              : current.side === "x+"
                ? "x-"
                : "x+",
        center:
          current.axis === "x"
            ? {
                x: current.center.x,
                y: 2 * current.anchorPoint.y - current.center.y,
              }
            : {
                x: 2 * current.anchorPoint.x - current.center.x,
                y: current.center.y,
              },
      }
      const bounds = getBounds(proposed)
      if (
        fixedBounds.some((obstacle) => boundsOverlap(bounds, obstacle)) ||
        anchoredBounds.some(
          (anchor) =>
            anchor.globalConnNetId !== current.globalConnNetId &&
            (boundsOverlap(bounds, anchor.bounds) ||
              pathIntersectsBounds(current.stubTracePath!, anchor.bounds)),
        ) ||
        traces.some(
          (trace) =>
            trace.globalConnNetId !== current.globalConnNetId &&
            pathIntersectsBounds(trace.tracePath, bounds),
        ) ||
        trial.some(
          (other, otherIndex) =>
            otherIndex !== movingIndex &&
            other.stubTracePath &&
            pathIntersectsBounds(other.stubTracePath, bounds),
        )
      ) {
        return false
      }

      trial[movingIndex] = proposed
      flipped.add(movingIndex)
      for (let otherIndex = 0; otherIndex < trial.length; otherIndex++) {
        if (otherIndex === movingIndex) continue
        if (
          boundsOverlap(bounds, getBounds(trial[otherIndex]!)) &&
          !tryFlip(otherIndex)
        ) {
          return false
        }
      }
      return true
    }

    if (tryFlip(index)) output = trial
  }

  return { inlineNetLabelPlacements: output }
}
