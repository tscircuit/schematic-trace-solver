export const MERGE_DISTANCE_THRESHOLD = 0.2

type Trace = {
  net?: string
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

export class SameNetTraceMergeSolver {
  solve(input: { traces?: Trace[] }) {

    const traces = input.traces ?? []

    const merged: Trace[] = []
    const used = new Set<number>()

    for (let i = 0; i < traces.length; i++) {

      if (used.has(i)) continue

      let current = traces[i]

      for (let j = i + 1; j < traces.length; j++) {

        if (used.has(j)) continue

        const candidate = traces[j]

        if (candidate.net !== current.net) continue

        const dx = Math.abs((current.x2 ?? 0) - (candidate.x1 ?? 0))
        const dy = Math.abs((current.y2 ?? 0) - (candidate.y1 ?? 0))

        if (dx < MERGE_DISTANCE_THRESHOLD && dy < MERGE_DISTANCE_THRESHOLD) {

          current = {
            ...current,
            x2: candidate.x2,
            y2: candidate.y2
          }

          used.add(j)
        }
      }

      merged.push(current)
    }

    return {
      traces: merged
    }
  }
}
