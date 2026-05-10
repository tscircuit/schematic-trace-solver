import { SameNetTraceMergingSolver } from "lib/solvers/SameNetTraceMergingSolver/SameNetTraceMergingSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { InteractiveGraphics } from "graphics-debug/react"
import { useMemo } from "react"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
  }) as any

const inputTraces = [
  makeTrace("a", "net0", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 0 },
  ]),
  makeTrace("b", "net0", [
    { x: 0, y: 0 },
    { x: 0, y: 1.12 },
    { x: 3, y: 1.12 },
    { x: 3, y: 0 },
  ]),
  makeTrace("other-net", "net1", [
    { x: 0.5, y: 1.35 },
    { x: 2.5, y: 1.35 },
  ]),
]

export default () => {
  const { beforeSolver, afterSolver } = useMemo(() => {
    const beforeSolver = new SameNetTraceMergingSolver({
      inputProblem,
      inputTraces,
    })
    const afterSolver = new SameNetTraceMergingSolver({
      inputProblem,
      inputTraces,
    })
    afterSolver.solve()

    return { beforeSolver, afterSolver }
  }, [])

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 16,
      }}
    >
      <section>
        <h2>Before</h2>
        <InteractiveGraphics graphics={beforeSolver.visualize()} />
      </section>
      <section>
        <h2>After</h2>
        <InteractiveGraphics graphics={afterSolver.visualize()} />
      </section>
    </div>
  )
}
