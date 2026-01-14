import { test } from "bun:test"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

type ComponentBox = {
  center: { x: number; y: number }
  width: number
  height: number
  chipId?: string
}

type Intersection = {
  segment: { a: Point; b: Point }
  box: {
    minX: number
    maxX: number
    minY: number
    maxY: number
    chipId?: string
  }
  netId?: string
} | null

const findBoxIntersection = (
  path: Point[],
  boxes: ComponentBox[],
  netId?: string,
): Intersection => {
  const EPS = 1e-9

  const isVertical = (a: Point, b: Point) => Math.abs(a.x - b.x) < EPS
  const isHorizontal = (a: Point, b: Point) => Math.abs(a.y - b.y) < EPS

  const segmentIntersectsInterior = (a: Point, b: Point, box: ComponentBox) => {
    const minX = box.center.x - box.width / 2
    const maxX = box.center.x + box.width / 2
    const minY = box.center.y - box.height / 2
    const maxY = box.center.y + box.height / 2

    const vert = isVertical(a, b)
    const horz = isHorizontal(a, b)
    if (!vert && !horz) return false

    if (vert) {
      const x = a.x
      if (x <= minX + EPS || x >= maxX - EPS) return false
      const segMinY = Math.min(a.y, b.y)
      const segMaxY = Math.max(a.y, b.y)
      const overlap =
        Math.min(segMaxY, maxY - EPS) - Math.max(segMinY, minY + EPS)
      return overlap > EPS
    }

    const y = a.y
    if (y <= minY + EPS || y >= maxY - EPS) return false
    const segMinX = Math.min(a.x, b.x)
    const segMaxX = Math.max(a.x, b.x)
    const overlap =
      Math.min(segMaxX, maxX - EPS) - Math.max(segMinX, minX + EPS)
    return overlap > EPS
  }

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    for (const box of boxes) {
      if (segmentIntersectsInterior(a, b, box)) {
        return {
          segment: { a, b },
          box: {
            minX: box.center.x - box.width / 2,
            maxX: box.center.x + box.width / 2,
            minY: box.center.y - box.height / 2,
            maxY: box.center.y + box.height / 2,
            chipId: box.chipId,
          },
          netId,
        }
      }
    }
  }
  return null
}

const example18: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 2,
      height: 1.4,
      pins: [
        {
          pinId: "U3.8",
          x: -1.4,
          y: 0.42500000000000004,
        },
        {
          pinId: "U3.4",
          x: -1.4,
          y: -0.42500000000000004,
        },
        {
          pinId: "U3.1",
          x: 1.4,
          y: 0.5,
        },
        {
          pinId: "U3.6",
          x: 1.4,
          y: 0.30000000000000004,
        },
        {
          pinId: "U3.5",
          x: 1.4,
          y: 0.10000000000000009,
        },
        {
          pinId: "U3.2",
          x: 1.4,
          y: -0.09999999999999998,
        },
        {
          pinId: "U3.3",
          x: 1.4,
          y: -0.3,
        },
        {
          pinId: "U3.7",
          x: 1.4,
          y: -0.5,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: -2.3145833,
        y: 0,
      },
      width: 0.5291665999999999,
      height: 1.0583333000000001,
      pins: [
        {
          pinId: "C20.1",
          x: -2.3148566499999994,
          y: 0.5512093000000002,
        },
        {
          pinId: "C20.2",
          x: -2.31430995,
          y: -0.5512093000000002,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 1.7577928249999983,
        y: 1.7512907000000002,
      },
      width: 0.3155856499999966,
      height: 1.0583332999999997,
      pins: [
        {
          pinId: "R11.1",
          x: 1.7580660749999977,
          y: 2.3025814000000002,
        },
        {
          pinId: "R11.2",
          x: 1.757519574999999,
          y: 1.2,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: -1.7577928249999983,
        y: -2.7512907000000002,
      },
      width: 0.3155856499999966,
      height: 1.0583332999999997,
      pins: [
        {
          pinId: "R12.1",
          x: -1.7580660749999977,
          y: -3.3025814000000002,
        },
        {
          pinId: "R12.2",
          x: -1.757519574999999,
          y: -2.2,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: 1.7577928249999983,
        y: -2.7512907000000002,
      },
      width: 0.3155856499999966,
      height: 1.0583332999999997,
      pins: [
        {
          pinId: "R13.1",
          x: 1.7580660749999977,
          y: -3.3025814000000002,
        },
        {
          pinId: "R13.2",
          x: 1.757519574999999,
          y: -2.2,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["C20.1", "U3.8"],
      netId: "capacitor.C20 > port.pin1 to .U3 > .VDD",
    },
    {
      pinIds: ["C20.2", "U3.4"],
      netId: "capacitor.C20 > port.pin2 to .U3 > .GND",
    },
    {
      pinIds: ["R11.2", "U3.1"],
      netId: "resistor.R11 > port.pin2 to .U3 > .N_CS",
    },
    {
      pinIds: ["R13.2", "R12.2"],
      netId: "resistor.R11 > port.pin1 to resistor.R12 > port.pin1",
    },
  ],
  netConnections: [
    {
      netId: "V3_3",
      pinIds: ["U3.8", "U3.3", "U3.7", "C20.1", "R11.1"],
    },
    {
      netId: "GND",
      pinIds: ["U3.4", "C20.2"],
    },
    {
      netId: "FLASH_N_CS",
      pinIds: ["U3.1", "R11.2"],
    },
  ],
  availableNetLabelOrientations: {
    V3_3: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
}

const example19: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 0.4,
      height: 0.8,
      pins: [
        {
          pinId: "U1.6",
          x: 0.6000000000000001,
          y: -0.2,
        },
        {
          pinId: "U1.8",
          x: 0.6000000000000001,
          y: 0,
        },
        {
          pinId: "U1.1",
          x: 0.6000000000000001,
          y: 0.2,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 1.4,
        y: 0.55,
      },
      width: 0.5291665999999999,
      height: 1.0583333000000001,
      pins: [
        {
          pinId: "C2.1",
          x: 1.4002733499999995,
          y: -0.0012093000000001908,
        },
        {
          pinId: "C2.2",
          x: 1.3997266500000003,
          y: 1.1012093000000003,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 2.7,
        y: 1.3,
      },
      width: 1.0583332999999997,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R1.1",
          x: 2.1487093,
          y: 1.3002732499999994,
        },
        {
          pinId: "R1.2",
          x: 3.2512907000000006,
          y: 1.2997267500000007,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: 4.4,
        y: 0,
      },
      width: 0.4,
      height: 0.4,
      pins: [
        {
          pinId: "JP5.1",
          x: 3.8000000000000003,
          y: 0,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: 4.4,
        y: -0.9,
      },
      width: 0.4,
      height: 0.4,
      pins: [
        {
          pinId: "JP9.1",
          x: 3.8000000000000003,
          y: -0.9,
        },
      ],
    },
    {
      chipId: "schematic_component_5",
      center: {
        x: 2,
        y: -1.1,
      },
      width: 0.8843008999999997,
      height: 0.5299361999999987,
      pins: [
        {
          pinId: "JP8.1",
          x: 2.4458007999999998,
          y: -1.2015872704999997,
        },
        {
          pinId: "JP8.2",
          x: 2.0034928,
          y: -0.8474009705000005,
        },
        {
          pinId: "JP8.3",
          x: 1.5541992,
          y: -1.2014628704999997,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["C2.1", "U1.8"],
      netId: "capacitor.C2 > port.pin1 to .U1 > .pin8",
    },
    {
      pinIds: ["C2.2", "R1.1"],
      netId: "capacitor.C2 > port.pin2 to .R1 > .pin1",
    },
    {
      pinIds: ["R1.1", "U1.1"],
      netId: "resistor.R1 > port.pin1 to .U1 > .pin1",
    },
    {
      pinIds: ["JP5.1", "R1.2"],
      netId: "pinheader.JP5 > port.pin1 to .R1 > .pin2",
    },
    {
      pinIds: ["JP9.1", "R1.2"],
      netId: "pinheader.JP9 > port.pin1 to .R1 > .pin2",
    },
    {
      pinIds: ["JP8.2", "U1.6"],
      netId: "solderjumper.JP8 > port.pin2 to .U1 > .pin6",
    },
  ],
  netConnections: [
    {
      netId: "PAD",
      pinIds: ["R1.2", "JP5.1", "JP9.1"],
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 5,
}

const cases: Array<{ id: string; input: InputProblem }> = [
  { id: "example18", input: example18 },
  { id: "example19", input: example19 },
]

test("traces do not intersect component box interiors (examples 18/19)", () => {
  for (const { id, input } of cases) {
    const pipeline = new SchematicTracePipelineSolver(input)
    pipeline.solve()

    const componentBoxes: ComponentBox[] = pipeline.inputProblem.chips.map(
      (chip) => ({
        center: chip.center,
        width: chip.width,
        height: chip.height,
        chipId: chip.chipId,
      }),
    )

    const stageTraces: Array<{ stage: string; traces: SolvedTracePath[] }> = [
      {
        stage: "schematicTraceLines",
        traces: pipeline.schematicTraceLinesSolver?.solvedTracePaths ?? [],
      },
      {
        stage: "traceOverlapShift",
        traces: Object.values(
          pipeline.traceOverlapShiftSolver?.correctedTraceMap ?? {},
        ),
      },
      {
        stage: "traceLabelOverlapAvoidance",
        traces:
          pipeline.traceLabelOverlapAvoidanceSolver?.getOutput().traces ?? [],
      },
      {
        stage: "traceCleanup",
        traces: pipeline.traceCleanupSolver?.getOutput().traces ?? [],
      },
      {
        stage: "sameNetTraceMerge",
        traces: pipeline.sameNetTraceMergeSolver?.getOutput().traces ?? [],
      },
      {
        stage: "final",
        traces: Object.values(
          pipeline.netLabelPlacementSolver?.inputTraceMap ?? {},
        ),
      },
    ]

    for (const { stage, traces } of stageTraces) {
      for (const trace of traces) {
        const boxesToCheck = componentBoxes
        const violation = findBoxIntersection(trace.tracePath, boxesToCheck)

        if (violation) {
          const { segment, box } = violation
          console.error(
            `[${id}] stage=${stage} segment ${segment.a.x},${segment.a.y} -> ${segment.b.x},${segment.b.y} crosses box x[${box.minX},${box.maxX}] y[${box.minY},${box.maxY}] chip=${box.chipId}`,
          )
          throw new Error(
            `[${id}] stage=${stage} segment intersects component box interior: ${segment.a.x},${segment.a.y} -> ${segment.b.x},${segment.b.y}`,
          )
        }
      }
    }
  }
})
