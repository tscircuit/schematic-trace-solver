import type { TraceLine } from "../types"

export class UntanglingSolver {
  solve(traces: TraceLine[]): TraceLine[] {
    return traces.map((trace) => {
      const dx = Math.abs(trace.start.x - trace.end.x)
      const dy = Math.abs(trace.start.y - trace.end.y)

      if (dx > 3 && dy < 0.5) {
        const midX = (trace.start.x + trace.end.x) / 2
        const offset = trace.start.y > 0 ? 1.5 : -1.5

        return {
          ...trace,
          path: [
            trace.start,
            { x: midX, y: trace.start.y + offset },
            trace.end,
          ],
        }
      }
      return trace
    })
  }
}
