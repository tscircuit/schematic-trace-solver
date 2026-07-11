import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPSILON = 1e-9

export function snapSameNetTraces(
  traces: SolvedTracePath[],
  tolerance: number = 0.3,
): SolvedTracePath[] {
  if (traces.length <= 1) return traces

  const workingTraces: SolvedTracePath[] = traces.map((t) => ({
   ...t,
    tracePath: t.tracePath.map((p) => ({...p })),
  }))

  for (let i = 0; i < workingTraces.length; i++) {
    for (let j = i + 1; j < workingTraces.length; j++) {
      const traceA = workingTraces[i]
      const traceB = workingTraces[j]

      if (traceA.net!== traceB.net) continue

      for (let a = 0; a < traceA.tracePath.length - 1; a++) {
        const p1A = traceA.tracePath[a]
        const p2A = traceA.tracePath[a + 1]

        for (let b = 0; b < traceB.tracePath.length - 1; b++) {
          const p1B = traceB.tracePath[b]
          const p2B = traceB.tracePath[b + 1]

          const isVerticalA = Math.abs(p1A.x - p2A.x) < EPSILON
          const isVerticalB = Math.abs(p1B.x - p2B.x) < EPSILON
          const isHorizontalA = Math.abs(p1A.y - p2A.y) < EPSILON
          const isHorizontalB = Math.abs(p1B.y - p2B.y) < EPSILON

          if (isVerticalA && isVerticalB) {
            const xA = p1A.x
            const xB = p1B.x
            if (Math.abs(xA - xB) < tolerance && Math.abs(xA - xB) > EPSILON) {
              const newX = (xA + xB) / 2
              p1A.x = newX
              p2A.x = newX
              p1B.x = newX
              p2B.x = newX
            }
          }

          if (isHorizontalA && isHorizontalB) {
            const yA = p1A.y
            const yB = p1B.y
            if (Math.abs(yA - yB) < tolerance && Math.abs(yA - yB) > EPSILON) {
              const newY = (yA + yB) / 2
              p1A.y = newY
              p2A.y = newY
              p1B.y = newY
              p2B.y = newY
            }
          }
        }
      }
    }
  }

  return workingTraces
  }
