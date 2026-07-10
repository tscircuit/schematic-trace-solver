import { useMemo } from "react"
import type { GraphicsObject } from "graphics-debug"
import { stackGraphicsHorizontally } from "graphics-debug"
import { InteractiveGraphics } from "graphics-debug/react"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetSegments"

const makeTrace = (
  id: string,
  netId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: netId,
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [id],
    tracePath,
  }) as SolvedTracePath

const toGraphics = (traces: SolvedTracePath[]): GraphicsObject => ({
  lines: traces.map((trace, index) => ({
    points: trace.tracePath,
    strokeColor: index === 0 ? "#2563eb" : "#dc2626",
    strokeWidth: 0.04,
  })),
})

export default () => {
  const graphics = useMemo(() => {
    const before = [
      makeTrace("trunk", "N1", [
        { x: 1, y: 0 },
        { x: 5, y: 0 },
      ]),
      makeTrace("branch", "N1", [
        { x: 0, y: 1 },
        { x: 1, y: 0.07 },
        { x: 5, y: 0.07 },
        { x: 6, y: 1 },
      ]),
    ]
    const after = mergeNearbySameNetSegments(before).traces

    return stackGraphicsHorizontally([toGraphics(before), toGraphics(after)], {
      titles: ["Before: nearby same-net lines", "After: shared Y axis"],
    })
  }, [])

  return <InteractiveGraphics graphics={graphics} />
}
