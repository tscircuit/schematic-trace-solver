import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

const AXIS_TOLERANCE = 0.01
const MAX_MERGE_GAP = 0.15

type SegmentOrientation = "horizontal" | "vertical"

type TraceSegment = {
  orientation: SegmentOrientation
  axis: number
  start: number
  end: number
  sourceTrace: SolvedTracePath
  sourceSegmentIndex: number
}

type AxisGroup = {
  orientation: SegmentOrientation
  axis: number
  segments: TraceSegment[]
}

type MergeCluster = {
  start: number
  end: number
  segments: TraceSegment[]
}

export class SameNetTraceCombiningSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[] = []

  constructor(params: {
    inputProblem: InputProblem
    inputTraces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.outputTraces = params.inputTraces
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceCombiningSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraces: this.inputTraces,
    }
  }

  override _step() {
    this.outputTraces = this.combineSameNetTraceSegments()
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  private combineSameNetTraceSegments(): SolvedTracePath[] {
    const tracesByNet = new Map<string, SolvedTracePath[]>()

    for (const trace of this.inputTraces) {
      const key = trace.globalConnNetId
      if (!tracesByNet.has(key)) tracesByNet.set(key, [])
      tracesByNet.get(key)!.push(trace)
    }

    const combinedTraces: SolvedTracePath[] = []

    for (const [globalConnNetId, traces] of tracesByNet.entries()) {
      const axisGroups: AxisGroup[] = []

      for (const trace of traces) {
        for (const segment of this.getTraceSegments(trace)) {
          const axisGroup = axisGroups.find(
            (group) =>
              group.orientation === segment.orientation &&
              Math.abs(group.axis - segment.axis) <= AXIS_TOLERANCE,
          )

          if (axisGroup) {
            axisGroup.segments.push(segment)
            axisGroup.axis =
              axisGroup.segments.reduce((sum, s) => sum + s.axis, 0) /
              axisGroup.segments.length
          } else {
            axisGroups.push({
              orientation: segment.orientation,
              axis: segment.axis,
              segments: [segment],
            })
          }
        }
      }

      for (let groupIndex = 0; groupIndex < axisGroups.length; groupIndex++) {
        const axisGroup = axisGroups[groupIndex]!
        const clusters = this.mergeAxisGroup(axisGroup)

        for (
          let clusterIndex = 0;
          clusterIndex < clusters.length;
          clusterIndex++
        ) {
          const cluster = clusters[clusterIndex]!
          combinedTraces.push(
            this.createTraceFromCluster({
              globalConnNetId,
              axisGroup,
              cluster,
              groupIndex,
              clusterIndex,
            }),
          )
        }
      }
    }

    return combinedTraces
  }

  private getTraceSegments(trace: SolvedTracePath): TraceSegment[] {
    const segments: TraceSegment[] = []

    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const p1 = trace.tracePath[i]!
      const p2 = trace.tracePath[i + 1]!
      const isHorizontal = Math.abs(p1.y - p2.y) <= AXIS_TOLERANCE
      const isVertical = Math.abs(p1.x - p2.x) <= AXIS_TOLERANCE

      if (isHorizontal) {
        const start = Math.min(p1.x, p2.x)
        const end = Math.max(p1.x, p2.x)
        if (Math.abs(end - start) <= AXIS_TOLERANCE) continue
        segments.push({
          orientation: "horizontal",
          axis: (p1.y + p2.y) / 2,
          start,
          end,
          sourceTrace: trace,
          sourceSegmentIndex: i,
        })
      } else if (isVertical) {
        const start = Math.min(p1.y, p2.y)
        const end = Math.max(p1.y, p2.y)
        if (Math.abs(end - start) <= AXIS_TOLERANCE) continue
        segments.push({
          orientation: "vertical",
          axis: (p1.x + p2.x) / 2,
          start,
          end,
          sourceTrace: trace,
          sourceSegmentIndex: i,
        })
      }
    }

    return segments
  }

  private mergeAxisGroup(axisGroup: AxisGroup): MergeCluster[] {
    const sortedSegments = [...axisGroup.segments].sort((a, b) => {
      if (Math.abs(a.start - b.start) > AXIS_TOLERANCE) {
        return a.start - b.start
      }
      return a.end - b.end
    })
    const clusters: MergeCluster[] = []

    for (const segment of sortedSegments) {
      const lastCluster = clusters[clusters.length - 1]

      if (!lastCluster || segment.start - lastCluster.end > MAX_MERGE_GAP) {
        clusters.push({
          start: segment.start,
          end: segment.end,
          segments: [segment],
        })
        continue
      }

      lastCluster.end = Math.max(lastCluster.end, segment.end)
      lastCluster.segments.push(segment)
    }

    return clusters
  }

  private createTraceFromCluster(params: {
    globalConnNetId: string
    axisGroup: AxisGroup
    cluster: MergeCluster
    groupIndex: number
    clusterIndex: number
  }): SolvedTracePath {
    const { globalConnNetId, axisGroup, cluster, groupIndex, clusterIndex } =
      params
    const sourceTraces = cluster.segments.map((s) => s.sourceTrace)
    const representative = sourceTraces[0]!
    const mspConnectionPairIds = Array.from(
      new Set(
        sourceTraces.flatMap(
          (trace) => trace.mspConnectionPairIds ?? [trace.mspPairId],
        ),
      ),
    )
    const pinIds = Array.from(
      new Set(sourceTraces.flatMap((trace) => trace.pinIds ?? [])),
    )
    const pins = this.getRepresentativePins(sourceTraces)
    const startPoint = this.getPoint(axisGroup, cluster.start)
    const endPoint = this.getPoint(axisGroup, cluster.end)

    return {
      ...representative,
      mspPairId:
        mspConnectionPairIds.length === 1
          ? mspConnectionPairIds[0]!
          : `same-net-combined-${globalConnNetId}-${axisGroup.orientation}-${groupIndex}-${clusterIndex}`,
      dcConnNetId: representative.dcConnNetId,
      globalConnNetId,
      userNetId: representative.userNetId,
      pins,
      tracePath: [startPoint, endPoint],
      mspConnectionPairIds,
      pinIds,
    }
  }

  private getRepresentativePins(
    sourceTraces: SolvedTracePath[],
  ): SolvedTracePath["pins"] {
    const pinsById = new Map<string, SolvedTracePath["pins"][number]>()

    for (const trace of sourceTraces) {
      for (const pin of trace.pins) {
        pinsById.set(pin.pinId, pin)
      }
    }

    const pins = Array.from(pinsById.values())
    if (pins.length >= 2) return [pins[0]!, pins[pins.length - 1]!]
    if (pins.length === 1) return [pins[0]!, pins[0]!]

    const fallback = sourceTraces[0]!.pins
    return [fallback[0]!, fallback[1]!] as [
      InputPin & { chipId: string },
      InputPin & { chipId: string },
    ]
  }

  private getPoint(axisGroup: AxisGroup, value: number): Point {
    if (axisGroup.orientation === "horizontal") {
      return { x: value, y: axisGroup.axis }
    }

    return { x: axisGroup.axis, y: value }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: getColorFromString(trace.globalConnNetId, 0.9),
      })
    }

    return graphics
  }
}
