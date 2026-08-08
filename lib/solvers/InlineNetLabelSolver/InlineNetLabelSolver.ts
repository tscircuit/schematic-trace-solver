import type { Bounds, Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Rect } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type {
  InputDirectConnection,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import {
  type AxisAlignedSegment,
  getAxisAlignedSegments,
} from "./getAxisAlignedSegments"

export const DEFAULT_INLINE_NET_LABEL_HEIGHT = 0.18

/**
 * Gap between the trace and the near edge of the inline label text.
 */
export const INLINE_NET_LABEL_TRACE_MARGIN = 0.05

/**
 * How much of the label is allowed to hang off the end of the wire it names,
 * as a fraction of the label's length. A short elbow stub is technically clear
 * of every obstacle but reads as a label floating in space, so runs shorter
 * than this are not considered.
 */
export const MIN_INLINE_NET_LABEL_SEGMENT_RATIO = 0.5

/**
 * A net label drawn parallel to the trace it names, rather than anchored to the
 * end of it. Used for point-to-point signal traces, where an anchored label
 * would break the visual line between the two pins.
 *
 * `center` is the center of the text box in the schematic's own (unrotated)
 * coordinate space. `width` is the extent of the text along the trace and
 * `height` is its extent perpendicular to the trace, so a vertical label has
 * its `width` running along y.
 */
export interface InlineNetLabelPlacement {
  globalConnNetId: string
  netId?: string
  mspPairId: string
  pinIds: PinId[]

  /** Axis the text runs along: "x" reads left-to-right, "y" reads bottom-to-top */
  axis: "x" | "y"

  /** Midpoint of the trace segment the label is attached to */
  anchorPoint: Point

  /** Center of the label text, offset perpendicular to the trace */
  center: Point

  /** Extent along the trace */
  width: number
  /** Extent perpendicular to the trace */
  height: number

  /**
   * Which side of the trace the label sits on. For a horizontal trace, "y+" is
   * above; for a vertical trace, "x-" is the left side (which is "above" once
   * the text is rotated).
   */
  side: "x+" | "x-" | "y+" | "y-"
}

interface InlineNetLabelSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

const getPinPairKey = (pinIds: readonly string[]) =>
  [...pinIds].sort().join("::")

/**
 * Places "inline net labels" - net names drawn alongside the trace they belong
 * to - for direct connections that opted in via `allowInlineNetLabel`.
 *
 * Any regular (anchored) net label placement for the same net is dropped, so a
 * net is never labeled twice.
 */
export class InlineNetLabelSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  inputNetLabelPlacements: NetLabelPlacement[]

  inlineNetLabelPlacements: InlineNetLabelPlacement[] = []

  /** Direct connections that opted in, still waiting to be processed */
  queuedDirectConnections: InputDirectConnection[]

  private tracesByPinPairKey: Map<string, SolvedTracePath[]>

  constructor(input: InlineNetLabelSolverInput) {
    super()
    this.inputProblem = input.inputProblem
    this.traces = input.traces
    this.inputNetLabelPlacements = input.netLabelPlacements

    this.queuedDirectConnections = this.inputProblem.directConnections.filter(
      (dc) => dc.allowInlineNetLabel && dc.netId,
    )

    this.tracesByPinPairKey = new Map()
    for (const trace of this.traces) {
      const key = getPinPairKey(trace.pins.map((p) => p.pinId))
      const existing = this.tracesByPinPairKey.get(key)
      if (existing) {
        existing.push(trace)
      } else {
        this.tracesByPinPairKey.set(key, [trace])
      }
    }
  }

  override getConstructorParams(): [InlineNetLabelSolverInput] {
    return [
      {
        inputProblem: this.inputProblem,
        traces: this.traces,
        netLabelPlacements: this.inputNetLabelPlacements,
      },
    ]
  }

  override _step() {
    const directConnection = this.queuedDirectConnections.shift()
    if (!directConnection) {
      this.solved = true
      this.stats.inlineNetLabelCount = this.inlineNetLabelPlacements.length
      return
    }

    const placement = this.computeInlinePlacement(directConnection)
    if (placement) {
      this.inlineNetLabelPlacements.push(placement)
    }
  }

  private computeInlinePlacement(
    directConnection: InputDirectConnection,
  ): InlineNetLabelPlacement | null {
    // Only connections the router actually drew a trace for can carry an inline
    // label - there's nothing to run parallel to otherwise.
    const traces =
      this.tracesByPinPairKey.get(getPinPairKey(directConnection.pinIds)) ?? []
    if (traces.length === 0) return null

    const trace = traces[0]!
    const segments = getAxisAlignedSegments(trace.tracePath)
    if (segments.length === 0) return null

    const height =
      directConnection.inlineNetLabelHeight ?? DEFAULT_INLINE_NET_LABEL_HEIGHT
    const width =
      directConnection.inlineNetLabelWidth ??
      directConnection.netLabelWidth ??
      estimateInlineNetLabelWidth(directConnection.netId!, height)

    const offset = height / 2 + INLINE_NET_LABEL_TRACE_MARGIN

    // Runs the label fully fits on come first, then longer-to-shorter among the
    // runs it may overhang. Within a run, try the preferred side before the far
    // side, and positions near the middle before ones near the ends.
    const usableSegments = segments
      .filter(
        (segment) =>
          segment.length >= width * MIN_INLINE_NET_LABEL_SEGMENT_RATIO,
      )
      .sort((a, b) => {
        const aFits = a.length >= width
        const bFits = b.length >= width
        if (aFits !== bFits) return aFits ? -1 : 1
        return b.length - a.length
      })

    for (const segment of usableSegments) {
      // "Above" the trace: +y for a horizontal trace, and -x for a vertical one
      // (rotating the text 90deg counter-clockwise maps "above" onto the left).
      const sides: InlineNetLabelPlacement["side"][] =
        segment.axis === "x" ? ["y+", "y-"] : ["x-", "x+"]

      for (const side of sides) {
        for (const anchorPoint of getAnchorCandidates(segment, width)) {
          const center =
            side === "y+"
              ? { x: anchorPoint.x, y: anchorPoint.y + offset }
              : side === "y-"
                ? { x: anchorPoint.x, y: anchorPoint.y - offset }
                : side === "x-"
                  ? { x: anchorPoint.x - offset, y: anchorPoint.y }
                  : { x: anchorPoint.x + offset, y: anchorPoint.y }

          const halfAlong = width / 2
          const halfAcross = height / 2
          const bounds: Bounds =
            segment.axis === "x"
              ? {
                  minX: center.x - halfAlong,
                  maxX: center.x + halfAlong,
                  minY: center.y - halfAcross,
                  maxY: center.y + halfAcross,
                }
              : {
                  minX: center.x - halfAcross,
                  maxX: center.x + halfAcross,
                  minY: center.y - halfAlong,
                  maxY: center.y + halfAlong,
                }

          if (this.isObstructed(bounds, trace)) continue

          return {
            globalConnNetId: trace.globalConnNetId,
            netId: directConnection.netId,
            mspPairId: trace.mspPairId,
            pinIds: [...directConnection.pinIds],
            axis: segment.axis,
            anchorPoint,
            center,
            width,
            height,
            side,
          }
        }
      }
    }

    // No room anywhere along the trace. Leave the net to the regular anchored
    // net label rather than drawing the name over a chip.
    return null
  }

  /**
   * An inline label may not sit on top of a chip, a component's text, or a
   * trace belonging to another net.
   */
  private isObstructed(bounds: Bounds, ownTrace: SolvedTracePath): boolean {
    for (const chip of this.inputProblem.chips) {
      const chipBounds: Bounds = {
        minX: chip.center.x - chip.width / 2,
        maxX: chip.center.x + chip.width / 2,
        minY: chip.center.y - chip.height / 2,
        maxY: chip.center.y + chip.height / 2,
      }
      if (boundsOverlap(bounds, chipBounds)) return true
    }

    for (const textBox of this.inputProblem.textBoxes ?? []) {
      if (boundsOverlap(bounds, getTextBoxBounds(textBox))) return true
    }

    for (const trace of this.traces) {
      if (trace.mspPairId === ownTrace.mspPairId) continue
      if (trace.globalConnNetId === ownTrace.globalConnNetId) continue
      if (doesPathIntersectBounds(trace.tracePath, bounds)) return true
    }

    return false
  }

  /**
   * Net label placements superseded by an inline label. A net gets one label or
   * the other, never both.
   */
  private getSupersededNetLabelKeys(): Set<string> {
    const keys = new Set<string>()
    for (const placement of this.inlineNetLabelPlacements) {
      keys.add(placement.globalConnNetId)
    }
    return keys
  }

  getOutput() {
    const superseded = this.getSupersededNetLabelKeys()
    return {
      traces: this.traces,
      netLabelPlacements: this.inputNetLabelPlacements.filter(
        (placement) => !superseded.has(placement.globalConnNetId),
      ),
      inlineNetLabelPlacements: this.inlineNetLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    // Mirrors the previous pipeline stage's visualization so that a problem
    // with no inline labels renders identically, then layers the inline labels
    // on top.
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.lines ??= []
    graphics.rects ??= []
    graphics.points ??= []
    graphics.texts ??= []

    for (const trace of this.traces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    const { netLabelPlacements } = this.getOutput()
    for (const label of netLabelPlacements) {
      graphics.rects.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: getColorFromString(label.globalConnNetId, 0.35),
        strokeColor: getColorFromString(label.globalConnNetId, 0.9),
        label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
      } as Rect & { strokeColor: string })
      graphics.points.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: getColorFromString(label.globalConnNetId, 0.9),
        label: `anchorPoint\norientation: ${label.orientation}`,
      })
    }

    for (const inlineLabel of this.inlineNetLabelPlacements) {
      const isHorizontal = inlineLabel.axis === "x"
      graphics.rects.push({
        center: inlineLabel.center,
        width: isHorizontal ? inlineLabel.width : inlineLabel.height,
        height: isHorizontal ? inlineLabel.height : inlineLabel.width,
        fill: getColorFromString(inlineLabel.globalConnNetId, 0.35),
        strokeColor: "green",
        label: [
          `INLINE netId: ${inlineLabel.netId}`,
          `axis: ${inlineLabel.axis}`,
          `side: ${inlineLabel.side}`,
        ].join("\n"),
      } as Rect & { strokeColor: string })
      graphics.texts.push({
        x: inlineLabel.center.x,
        y: inlineLabel.center.y,
        text: inlineLabel.netId ?? "",
        color: "green",
        fontSize: inlineLabel.height,
        anchorSide: "center",
      })
      graphics.points.push({
        x: inlineLabel.anchorPoint.x,
        y: inlineLabel.anchorPoint.y,
        color: "green",
        label: `inline anchor\n${inlineLabel.netId}`,
      })
    }

    return graphics
  }
}

/**
 * Mirrors the net label text width used by @tscircuit/core so a label that core
 * did not measure for us still reserves a sane amount of space.
 */
export const estimateInlineNetLabelWidth = (
  text: string,
  fontSize = DEFAULT_INLINE_NET_LABEL_HEIGHT,
) => {
  const fontScale = fontSize / 0.18
  return text.length * 0.12 * fontScale + 0.12 * fontScale
}

/**
 * Points along a segment where the label's midpoint could sit, ordered from the
 * middle of the segment outwards. Sliding the label along the wire lets it
 * dodge a chip that only crowds one end.
 *
 * When the label is shorter than the segment, candidates keep it fully on the
 * wire; when it is longer, candidates keep the wire fully under the label (the
 * overhang shifts between the two ends). Either way the slide range is
 * |segmentLength - labelWidth| about the midpoint, which lets a label that
 * doesn't quite fit dodge a chip crowding one end by overhanging the other.
 */
const getAnchorCandidates = (
  segment: AxisAlignedSegment,
  labelWidth: number,
  step = 0.1,
): Point[] => {
  const along = segment.axis === "x" ? "x" : "y"
  const start = segment.start[along]
  const end = segment.end[along]
  const mid = (start + end) / 2
  const direction = Math.sign(end - start) || 1

  const pointAt = (value: number): Point =>
    segment.axis === "x"
      ? { x: value, y: segment.start.y }
      : { x: segment.start.x, y: segment.start.y + (value - start) }

  const halfRange = Math.abs(segment.length - labelWidth) / 2
  if (halfRange < 1e-9) return [pointAt(mid)]

  const offsets: number[] = [0]
  for (let offset = step; offset <= halfRange + 1e-9; offset += step) {
    offsets.push(offset, -offset)
  }
  // Always consider both extremes, even when they fall between samples.
  offsets.push(halfRange, -halfRange)

  return offsets.map((offset) => pointAt(mid + offset * direction))
}

const doesPathIntersectBounds = (path: Point[], bounds: Bounds): boolean => {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const segmentBounds: Bounds = {
      minX: Math.min(a.x, b.x),
      maxX: Math.max(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxY: Math.max(a.y, b.y),
    }
    // Trace segments are axis-aligned, so their bounding box is the segment.
    if (boundsOverlap(segmentBounds, bounds)) return true
  }
  return false
}
