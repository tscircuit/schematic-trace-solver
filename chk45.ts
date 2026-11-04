import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { readFileSync } from "node:fs"
const s: any = new SchematicTracePipelineSolver(JSON.parse(readFileSync("tests/assets/example45.json", "utf8")))
s.solve()
const t = (s.netLabelToTraceSolver?.getOutput?.().traces ?? []).find((x: any) => x.mspPairId === "R10.1-CONN1.2")
console.log(t ? t.tracePath.map((p: any) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") : "absent")
