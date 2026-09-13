import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { useMemo } from "react"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import input from "../../tests/repros/assets/repro-core-vertical-passive-ground-label-overlap.input.json"

export default function GroundLabelTerminalIndicators() {
  const svg = useMemo(() => {
    const solver = new SchematicTracePipelineSolver(
      input as unknown as InputProblem,
    )
    solver.solve()
    return convertCircuitJsonToSchematicSvg(
      convertSolverOutputToCircuitJson(solver),
      {
        width: 1200,
        height: 1000,
      },
    )
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <h2>Connected net labels show false open-pin indicators</h2>
      <p>
        Complete eight-component circuit: MK1, U1, four capacitors, and two
        resistors. The red dots above the two bottom GND symbols are incorrectly
        drawn as open terminals. Genuine open U1 pins and the green wire
        junction must remain visible when this is fixed. No routing or placement
        changes are applied in this repro.
      </p>
      <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        alt="Complete MK1 and U1 circuit with four capacitors and two resistors, showing false terminal dots above the two bottom GND symbols"
        style={{
          display: "block",
          width: "100%",
          maxWidth: 1200,
          height: "auto",
        }}
      />
    </div>
  )
}
