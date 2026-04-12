import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { useMemo } from "react"
import type { InputProblem } from "lib/types/InputProblem"
import { SchematicTracePipelineSolver } from "lib/index"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: -2, y: 0 },
      width: 0.6,
      height: 1.2,
      pins: [
        { pinId: "U1.1", x: -2.3, y: 0.3 },
        { pinId: "U1.2", x: -2.3, y: -0.3 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 2, y: 0 },
      width: 0.6,
      height: 1.2,
      pins: [
        { pinId: "U2.1", x: 1.7, y: 0.3 },
        { pinId: "U2.2", x: 1.7, y: -0.3 },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["U1.1", "U2.1"], netId: "VCC" },
    { pinIds: ["U1.2", "U2.2"], netId: "VCC" },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 5,
}

export default () => {
  const solver = useMemo(
    () => new SchematicTracePipelineSolver(inputProblem),
    [],
  )
  return <GenericSolverDebugger solver={solver} />
}
