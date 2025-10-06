import { test, expect } from "bun:test"
import input from "./SchematicTraceSingleLineSolver_repro_long_trace.json"
import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"
import { getSvgFromGraphicsObject } from "graphics-debug"
import fs from "fs"

test("SchematicTraceSingleLineSolver_long_trace_snapshot", () => {
  const solver = new SchematicTraceSingleLineSolver(input as any)
  solver.solve()

  const graphics = solver.visualize()

  const svgContent = getSvgFromGraphicsObject(graphics)

  const snapshotDir =
    "tests/solvers/SchematicTraceSingleLineSolver/__snapshots__"
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true })
  }
  fs.writeFileSync(
    `${snapshotDir}/SchematicTraceSingleLineSolver_long_trace_snapshot.svg`,
    svgContent,
  )
})
