import { BaseSolver } from "../BaseSolver"

const MERGE_DISTANCE_THRESHOLD = 0.2

export class SameNetTraceMergeSolver extends BaseSolver {
  solve(input: any) {
    const traces = input.traces ?? []

    const merged: any[] = []
    const used = new Set<number>()

    for (let i = 0; i < traces.length; i++) {
      if (used.has(i)) continue

      let current = traces[i]

      for (let j = i + 1; j < traces.length; j++) {
        if (used.has(j)) continue

        const candidate = traces[j]

        if (candidate.net !== current.net) continue

        const dx = Math.abs(current.x2 - candidate.x1)
        const dy = Math.abs(current.y2 - candidate.y1)

        if (dx < MERGE_DISTANCE_THRESHOLD && dy < MERGE_DISTANCE_THRESHOLD) {
          current = {
            ...current,
            x2: candidate.x2,
            y2: candidate.y2,
          }

          used.add(j)
        }
      }

      merged.push(current)
    }

    return {
      traces: merged,
    }
  }
}
