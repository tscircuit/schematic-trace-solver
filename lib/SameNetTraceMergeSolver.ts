import { BaseSolver } from "./solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "./types/InputProblem"

export class SameNetTraceMergeSolver extends BaseSolver {
  traces: any[]
  netLabelPlacements: any[]
  inputProblem: InputProblem

  constructor(params: {
    inputProblem: InputProblem
    traces: any[]
    netLabelPlacements?: any[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces || []
    this.netLabelPlacements = params.netLabelPlacements || []
  }

  override _step() {
    const EPSILON = 0.1
    const mergedSegments: any[] = []

    const segmentsByNet = this.traces.reduce(
      (acc, seg) => {
        // Support different property names just in case
        const netId = seg.net_id || seg.netId || "unknown"
        if (!acc[netId]) acc[netId] = []
        acc[netId].push(seg)
        return acc
      },
      {} as Record<string, any[]>,
    )

    for (const netId in segmentsByNet) {
      const netSegments = segmentsByNet[netId]

      const verticals = netSegments.filter(
        (s: any) => Math.abs(s.x1 - s.x2) < EPSILON,
      )
      const horizontals = netSegments.filter(
        (s: any) => Math.abs(s.y1 - s.y2) < EPSILON,
      )
      const others = netSegments.filter(
        (s: any) =>
          Math.abs(s.x1 - s.x2) >= EPSILON && Math.abs(s.y1 - s.y2) >= EPSILON,
      )

      mergedSegments.push(...others)
      mergedSegments.push(...this.mergeOrthogonal(verticals, "x", "y"))
      mergedSegments.push(...this.mergeOrthogonal(horizontals, "y", "x"))
    }

    this.traces = mergedSegments
    this.solved = true
  }

  private mergeOrthogonal(
    segments: any[],
    fixedAxis: "x" | "y",
    slidingAxis: "x" | "y",
  ) {
    const EPSILON = 0.1
    if (segments.length === 0) return []

    const merged: any[] = []
    const groupedByAxis: Record<string, any[]> = {}

    for (const seg of segments) {
      if (seg[`${slidingAxis}1`] > seg[`${slidingAxis}2`]) {
        ;[seg[`${slidingAxis}1`], seg[`${slidingAxis}2`]] = [
          seg[`${slidingAxis}2`],
          seg[`${slidingAxis}1`],
        ]
        ;[seg[`${fixedAxis}1`], seg[`${fixedAxis}2`]] = [
          seg[`${fixedAxis}2`],
          seg[`${fixedAxis}1`],
        ]
      }

      const axisVal = seg[`${fixedAxis}1`]
      const existingKey = Object.keys(groupedByAxis).find(
        (key) => Math.abs(parseFloat(key) - axisVal) < EPSILON,
      )

      if (existingKey) {
        seg[`${fixedAxis}1`] = parseFloat(existingKey)
        seg[`${fixedAxis}2`] = parseFloat(existingKey)
        groupedByAxis[existingKey].push(seg)
      } else {
        groupedByAxis[axisVal.toString()] = [seg]
      }
    }

    for (const key in groupedByAxis) {
      const group = groupedByAxis[key]
      group.sort(
        (a: any, b: any) => a[`${slidingAxis}1`] - b[`${slidingAxis}1`],
      )

      let current = group[0]

      for (let i = 1; i < group.length; i++) {
        const next = group[i]

        if (current[`${slidingAxis}2`] >= next[`${slidingAxis}1`] - EPSILON) {
          current[`${slidingAxis}2`] = Math.max(
            current[`${slidingAxis}2`],
            next[`${slidingAxis}2`],
          )
        } else {
          merged.push({ ...current })
          current = next
        }
      }
      merged.push({ ...current })
    }

    return merged
  }

  getOutput() {
    return {
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }
}
