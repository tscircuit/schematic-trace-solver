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
        Full existing repro circuit, unchanged. The red dots above the two lower
        GND symbols are incorrectly drawn as open terminals. Genuine open U1
        pins and the green wire junction must remain visible when this is fixed.
      </p>
      <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        alt="Full circuit showing false terminal dots at the resistor and capacitor ground connections"
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
