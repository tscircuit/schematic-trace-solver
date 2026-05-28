import { useMemo } from "react"
import { InteractiveGraphics } from "graphics-debug/react"
import { SameNetTraceMergingSolver } from "lib/solvers/SameNetTraceMergingSolver/SameNetTraceMergingSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Visual demo: issue #29 — two same-net GND traces routed close together.
 *
 * The MST router produced two nearly-parallel horizontal runs for the GND
 * net (one at y = 0, one at y = 0.12).  SameNetTraceMergingSolver collapses
 * the interior of the second run onto y = 0, eliminating the visual clutter.
 */

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "JP6",
      center: { x: -3, y: 0 },
      width: 1,
      height: 0.8,
      pins: [
        { pinId: "JP6.VOUT", x: -2.5, y: 0.2 },
        { pinId: "JP6.GND", x: -2.5, y: -0.2 },
      ],
    },
    {
      chipId: "R1",
      center: { x: 2, y: 0.06 },
      width: 0.4,
      height: 0.6,
      pins: [
        { pinId: "R1.A", x: 2, y: 0.36 },
        { pinId: "R1.B", x: 2, y: -0.24 },
      ],
    },
    {
      chipId: "SJ2",
      center: { x: 2, y: -0.8 },
      width: 0.4,
      height: 0.4,
      pins: [
        { pinId: "SJ2.A", x: 2, y: -0.6 },
        { pinId: "SJ2.B", x: 2, y: -1.0 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "VOUT", pinIds: ["JP6.VOUT", "R1.A", "SJ2.A"] },
    { netId: "GND", pinIds: ["JP6.GND", "R1.B", "SJ2.B"] },
  ],
  availableNetLabelOrientations: { VOUT: ["y+"], GND: ["y-"] },
}

function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [
      { pinId: `${id}-a`, x: path[0].x, y: path[0].y, chipId: "JP6" },
      {
        pinId: `${id}-b`,
        x: path[path.length - 1].x,
        y: path[path.length - 1].y,
        chipId: "R1",
      },
    ],
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-a`, `${id}-b`],
  }
}

/**
 * Two GND traces that the MST router produced — nearly identical horizontal
 * runs only 0.12 units apart.  Without the solver these appear as a pair of
 * parallel wires.
 */
const tracesBeforeMerge: SolvedTracePath[] = [
  // GND trace 1: JP6.GND → R1.B  (y = 0)
  makeTrace("gnd-1", "GND", [
    { x: -2.5, y: -0.2 }, // pin — JP6.GND
    { x: -1.0, y: -0.2 }, // turn
    { x: -1.0, y: 0.0 }, // interior
    { x: 1.5, y: 0.0 }, // interior
    { x: 1.5, y: -0.24 }, // turn
    { x: 2.0, y: -0.24 }, // pin — R1.B
  ]),
  // GND trace 2: JP6.GND → SJ2.B  (y = 0.12, close to trace 1)
  makeTrace("gnd-2", "GND", [
    { x: -2.5, y: -0.2 }, // pin — JP6.GND
    { x: -1.2, y: -0.2 }, // turn
    { x: -1.2, y: 0.12 }, // interior — slightly above trace 1
    { x: 1.5, y: 0.12 }, // interior
    { x: 1.5, y: -1.0 }, // turn
    { x: 2.0, y: -1.0 }, // pin — SJ2.B
  ]),
]

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 4,
  color: "#333",
}

const PANEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minWidth: 0,
  border: "1px solid #ddd",
  borderRadius: 6,
  padding: 8,
  background: "#fafafa",
}

export default () => {
  const beforeSolver = useMemo(() => {
    const s = new SameNetTraceMergingSolver({
      inputProblem,
      traces: tracesBeforeMerge,
    })
    // Don't solve — show the initial (broken) state
    return s
  }, [])

  const afterSolver = useMemo(() => {
    const s = new SameNetTraceMergingSolver({
      inputProblem,
      traces: tracesBeforeMerge,
    })
    s.solve()
    return s
  }, [])

  return (
    <div style={{ fontFamily: "sans-serif", padding: 16 }}>
      <h2 style={{ marginBottom: 4 }}>SameNetTraceMergingSolver — issue #29</h2>
      <p style={{ color: "#555", marginBottom: 16, fontSize: 13 }}>
        Two GND traces routed by the MST at y = 0 and y = 0.12. The solver snaps
        the interior of the second trace onto y = 0, eliminating the
        parallel-wire clutter.
      </p>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={PANEL_STYLE}>
          <div style={{ ...LABEL_STYLE, color: "#c0392b" }}>
            ❌ Before — two parallel GND traces (y = 0 and y = 0.12)
          </div>
          <InteractiveGraphics graphics={beforeSolver.visualize()} />
        </div>
        <div style={PANEL_STYLE}>
          <div style={{ ...LABEL_STYLE, color: "#27ae60" }}>
            ✅ After — merged onto a single axis
          </div>
          <InteractiveGraphics graphics={afterSolver.visualize()} />
        </div>
      </div>
    </div>
  )
}
