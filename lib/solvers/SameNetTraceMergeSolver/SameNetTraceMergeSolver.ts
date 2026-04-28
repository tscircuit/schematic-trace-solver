import { BaseSolver } from "../BaseSolver/BaseSolver"

export class SameNetTraceMergeSolver extends BaseSolver {
  traces: any[]

  constructor(params: { allTraces: any[] }) {
    super()
    this.traces = params.allTraces || []
  }

  override _step(): void {
    if (!this.traces || this.traces.length === 0) {
      this.solved = true
      return
    }

    const threshold = 0.1
    const mergedTraces = this.traces.map((trace) => {
      const edges = [...(trace.edges || [])]
      let changed = true

      while (changed) {
        changed = false
        for (let i = 0; i < edges.length; i++) {
          for (let j = i + 1; j < edges.length; j++) {
            const segA = edges[i]
            const segB = edges[j]

            const isAHoriz = Math.abs(segA.from.y - segA.to.y) < 0.001
            const isBHoriz = Math.abs(segB.from.y - segB.to.y) < 0.001
            const isAVert = Math.abs(segA.from.x - segA.to.x) < 0.001
            const isBVert = Math.abs(segB.from.x - segB.to.x) < 0.001

            let shouldMerge = false
            if (
              isAHoriz &&
              isBHoriz &&
              Math.abs(segA.from.y - segB.from.y) < threshold
            ) {
              shouldMerge = true
            } else if (
              isAVert &&
              isBVert &&
              Math.abs(segA.from.x - segB.from.x) < threshold
            ) {
              shouldMerge = true
            }

            if (shouldMerge) {
              const newSeg = {
                from: {
                  x: Math.min(segA.from.x, segA.to.x, segB.from.x, segB.to.x),
                  y: Math.min(segA.from.y, segA.to.y, segB.from.y, segB.to.y),
                },
                to: {
                  x: Math.max(segA.from.x, segA.to.x, segB.from.x, segB.to.x),
                  y: Math.max(segA.from.y, segA.to.y, segB.from.y, segB.to.y),
                },
              }
              edges.splice(j, 1)
              edges.splice(i, 1, newSeg)
              changed = true
              break
            }
          }
          if (changed) break
        }
      }
      return { ...trace, edges }
    })

    this.traces = mergedTraces
    this.solved = true
  }

  getOutput() {
    return { traces: this.traces }
  }
}
