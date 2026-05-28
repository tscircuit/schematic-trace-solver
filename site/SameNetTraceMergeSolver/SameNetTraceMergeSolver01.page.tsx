import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"

const pin = (pinId: string, x: number, y: number) => ({
  pinId,
  chipId: "U1",
  x,
  y,
})

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  yOffset: number,
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}-start`, `${mspPairId}-end`],
  pins: [
    pin(`${mspPairId}-start`, 0, yOffset),
    pin(`${mspPairId}-end`, 2, yOffset),
  ],
  tracePath: [
    { x: 0, y: yOffset },
    { x: 0, y: 1 + yOffset },
    { x: 2, y: 1 + yOffset },
    { x: 2, y: yOffset },
  ],
})

export default () => {
  const solver = useMemo(() => {
    const solver = new SameNetTraceMergeSolver({
      inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      },
      traces: [
        trace("same-net-a", "net-1", 0),
        trace("same-net-b", "net-1", 0.08),
        trace("different-net", "net-2", 0.35),
      ],
    })
    solver.solve()
    return solver
  }, [])

  return <GenericSolverDebugger solver={solver} />
}
