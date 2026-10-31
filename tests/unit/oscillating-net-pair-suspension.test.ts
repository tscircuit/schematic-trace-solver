import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("oscillating net pair in TraceOverlapShiftSolver suspends only that pair and resolves independent overlaps", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "schematic_component_23",
        center: {
          x: 11.084375,
          y: -5.325,
        },
        width: 2.3000000000000007,
        height: 3.2000000000000006,
        pins: [
          {
            pinId: "schematic_port_75",
            x: 9.934375,
            y: -4.325,
          },
          {
            pinId: "schematic_port_79",
            x: 9.934375,
            y: -5.125,
          },
          {
            pinId: "schematic_port_80",
            x: 9.934375,
            y: -5.325,
          },
          {
            pinId: "schematic_port_96",
            x: 12.234375,
            y: -5.025,
          },
          {
            pinId: "schematic_port_100",
            x: 12.234375,
            y: -4.2250000000000005,
          },
          {
            pinId: "schematic_port_101",
            x: 12.234375,
            y: -4.025,
          },
        ],
        sectionId: "USB to UART",
      },
      {
        chipId: "schematic_component_26",
        center: {
          x: 7.629375,
          y: -3.9250000000000007,
        },
        width: 0.7800000000000002,
        height: 0.7600000000000011,
        pins: [
          {
            pinId: "schematic_port_106",
            x: 7.564375,
            y: -4.3050000000000015,
            _facingDirection: "y-",
          },
        ],
        sectionId: "USB to UART",
      },
      {
        chipId: "schematic_component_27",
        center: {
          x: 9.221875,
          y: -5.55,
        },
        width: 1.205,
        height: 0.5999999999999996,
        pins: [
          {
            pinId: "schematic_port_108",
            x: 8.944374999999999,
            y: -5.25,
            _facingDirection: "y+",
          },
          {
            pinId: "schematic_port_109",
            x: 8.944374999999999,
            y: -5.85,
            _facingDirection: "y-",
          },
        ],
        sectionId: "USB to UART",
      },
      {
        chipId: "schematic_component_28",
        center: {
          x: 9.221875,
          y: -4.23,
        },
        width: 1.205,
        height: 0.6000000000000014,
        pins: [
          {
            pinId: "schematic_port_111",
            x: 8.944374999999999,
            y: -3.9299999999999997,
          },
        ],
        sectionId: "USB to UART",
      },
      {
        chipId: "schematic_component_32",
        center: {
          x: 15.769374999999998,
          y: -4.724999999999999,
        },
        width: 2,
        height: 0.8000000000000007,
        pins: [
          {
            pinId: "schematic_port_118",
            x: 14.769374999999998,
            y: -4.524999999999999,
          },
          {
            pinId: "schematic_port_119",
            x: 14.769374999999998,
            y: -4.724999999999999,
          },
          {
            pinId: "schematic_port_121",
            x: 16.769374999999997,
            y: -4.924999999999999,
          },
          {
            pinId: "schematic_port_122",
            x: 16.769374999999997,
            y: -4.724999999999999,
          },
        ],
        sectionId: "USB to UART",
      },
    ],
    directConnections: [
      {
        netId: ".R5 > .pin1 to .U6 > .VBUS",
        pinIds: ["schematic_port_108", "schematic_port_80"],
      },
    ],
    netConnections: [
      {
        netId: "GND",
        isGround: true,
        netLabelWidth: 0.42,
        netLabelHeight: 0.48,
        pinIds: [
          "schematic_port_75",
          "schematic_port_101",
          "schematic_port_106",
          "schematic_port_109",
        ],
      },
      {
        netId: "VBUS",
        netLabelWidth: 0.42,
        netLabelHeight: 0.6,
        pinIds: ["schematic_port_79", "schematic_port_111"],
      },
      {
        netId: "RTS",
        netLabelWidth: 0.48,
        pinIds: [
          "schematic_port_96",
          "schematic_port_118",
          "schematic_port_122",
        ],
      },
      {
        netId: "DTR",
        netLabelWidth: 0.48,
        pinIds: [
          "schematic_port_100",
          "schematic_port_119",
          "schematic_port_121",
        ],
      },
    ],
    textBoxes: [],
    availableNetLabelOrientations: {
      GND: ["y-"],
      VBUS: ["y+"],
      RTS: ["x-", "x+"],
      DTR: ["x-", "x+"],
    },
    maxMspPairDistance: 8,
    _hideRatsNet: false,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const shiftSolver = solver.traceOverlapShiftSolver!
  expect(shiftSolver).toBeDefined()

  const findOverlappingNetPairs = () => {
    const EPS = 2e-3
    const islands = shiftSolver.computeTraceNetIslands()
    const netIds = Object.keys(islands)
    const pairs: string[] = []
    for (let i = 0; i < netIds.length; i++) {
      for (let j = i + 1; j < netIds.length; j++) {
        const netA = netIds[i]!
        const netB = netIds[j]!
        const pathsA = islands[netA] || []
        const pathsB = islands[netB] || []
        let overlaps = false
        for (const pa of pathsA) {
          for (let sa = 0; sa < pa.tracePath.length - 1; sa++) {
            const a1 = pa.tracePath[sa]!
            const a2 = pa.tracePath[sa + 1]!
            const aVert = Math.abs(a1.x - a2.x) < EPS
            const aHorz = Math.abs(a1.y - a2.y) < EPS
            for (const pb of pathsB) {
              for (let sb = 0; sb < pb.tracePath.length - 1; sb++) {
                const b1 = pb.tracePath[sb]!
                const b2 = pb.tracePath[sb + 1]!
                const bVert = Math.abs(b1.x - b2.x) < EPS
                const bHorz = Math.abs(b1.y - b2.y) < EPS
                if (aVert && bVert && Math.abs(a1.x - b1.x) < EPS) {
                  const overlap =
                    Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
                    Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y))
                  if (overlap > EPS) overlaps = true
                } else if (aHorz && bHorz && Math.abs(a1.y - b1.y) < EPS) {
                  const overlap =
                    Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
                    Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x))
                  if (overlap > EPS) overlaps = true
                }
              }
            }
          }
        }
        if (overlaps) {
          pairs.push(`${netA} ~ ${netB}`)
        }
      }
    }
    return pairs
  }

  expect(findOverlappingNetPairs()).toEqual([
    "connectivity_net0 ~ connectivity_net1",
  ])
})
