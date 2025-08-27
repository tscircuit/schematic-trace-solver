import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"
import { test, expect } from "bun:test"

test("SchematicTraceSingleLineSolver should solve problem correctly", () => {
  const input = {
    chipMap: {
      schematic_component_0: {
        chipId: "schematic_component_0",
        center: {
          x: 0,
          y: 0,
        },
        width: 2.3,
        height: 1.7999999999999998,
        pins: [
          {
            pinId: "U1.1",
            x: -1.15,
            y: 0.7,
          },
          {
            pinId: "U1.2",
            x: -1.15,
            y: 0.49999999999999994,
          },
          {
            pinId: "U1.3",
            x: -1.15,
            y: 0.29999999999999993,
          },
          {
            pinId: "U1.4",
            x: -1.15,
            y: 0.09999999999999987,
          },
          {
            pinId: "U1.5",
            x: -1.15,
            y: -0.10000000000000009,
          },
          {
            pinId: "U1.6",
            x: -1.15,
            y: -0.30000000000000004,
          },
          {
            pinId: "U1.7",
            x: -1.15,
            y: -0.5,
          },
          {
            pinId: "U1.8",
            x: -1.15,
            y: -0.7,
          },
          {
            pinId: "U1.9",
            x: 1.15,
            y: -0.7,
          },
          {
            pinId: "U1.10",
            x: 1.15,
            y: -0.49999999999999994,
          },
          {
            pinId: "U1.11",
            x: 1.15,
            y: -0.29999999999999993,
          },
          {
            pinId: "U1.12",
            x: 1.15,
            y: -0.09999999999999987,
          },
          {
            pinId: "U1.13",
            x: 1.15,
            y: 0.10000000000000009,
          },
          {
            pinId: "U1.14",
            x: 1.15,
            y: 0.30000000000000004,
          },
          {
            pinId: "U1.15",
            x: 1.15,
            y: 0.5,
          },
          {
            pinId: "U1.16",
            x: 1.15,
            y: 0.7,
          },
        ],
      },
      schematic_component_1: {
        chipId: "schematic_component_1",
        center: {
          x: -4,
          y: -3,
        },
        width: 1.1025814000000018,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R1.1",
            x: -4.551290700000001,
            y: -2.9997267500000007,
          },
          {
            pinId: "R1.2",
            x: -3.448709299999999,
            y: -3.0002732499999993,
          },
        ],
      },
      schematic_component_2: {
        chipId: "schematic_component_2",
        center: {
          x: -4,
          y: -2,
        },
        width: 1.1025814000000018,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R2.1",
            x: -4.551290700000001,
            y: -1.9997267500000007,
          },
          {
            pinId: "R2.2",
            x: -3.448709299999999,
            y: -2.0002732499999993,
          },
        ],
      },
      schematic_component_3: {
        chipId: "schematic_component_3",
        center: {
          x: -4,
          y: -1,
        },
        width: 1.1025814000000018,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R3.1",
            x: -4.551290700000001,
            y: -0.9997267500000007,
          },
          {
            pinId: "R3.2",
            x: -3.448709299999999,
            y: -1.0002732499999993,
          },
        ],
      },
      schematic_component_4: {
        chipId: "schematic_component_4",
        center: {
          x: -4,
          y: 0,
        },
        width: 1.1025814000000018,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R4.1",
            x: -4.551290700000001,
            y: 0.0002732499999993365,
          },
          {
            pinId: "R4.2",
            x: -3.448709299999999,
            y: -0.0002732499999993365,
          },
        ],
      },
      schematic_component_5: {
        chipId: "schematic_component_5",
        center: {
          x: -4,
          y: 1,
        },
        width: 1.1025814000000018,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R5.1",
            x: -4.551290700000001,
            y: 1.0002732499999993,
          },
          {
            pinId: "R5.2",
            x: -3.448709299999999,
            y: 0.9997267500000007,
          },
        ],
      },
      schematic_component_6: {
        chipId: "schematic_component_6",
        center: {
          x: -4,
          y: 2,
        },
        width: 1.1025814000000018,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R6.1",
            x: -4.551290700000001,
            y: 2.0002732499999993,
          },
          {
            pinId: "R6.2",
            x: -3.448709299999999,
            y: 1.9997267500000007,
          },
        ],
      },
      schematic_component_7: {
        chipId: "schematic_component_7",
        center: {
          x: 4,
          y: -3,
        },
        width: 1.1025814,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R7.1",
            x: 3.4487093,
            y: -2.9997267500000007,
          },
          {
            pinId: "R7.2",
            x: 4.5512907,
            y: -3.0002732499999993,
          },
        ],
      },
      schematic_component_8: {
        chipId: "schematic_component_8",
        center: {
          x: 4,
          y: -2,
        },
        width: 1.1025814,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R8.1",
            x: 3.4487093,
            y: -1.9997267500000007,
          },
          {
            pinId: "R8.2",
            x: 4.5512907,
            y: -2.0002732499999993,
          },
        ],
      },
      schematic_component_9: {
        chipId: "schematic_component_9",
        center: {
          x: 4,
          y: -1,
        },
        width: 1.1025814,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R9.1",
            x: 3.4487093,
            y: -0.9997267500000007,
          },
          {
            pinId: "R9.2",
            x: 4.5512907,
            y: -1.0002732499999993,
          },
        ],
      },
      schematic_component_10: {
        chipId: "schematic_component_10",
        center: {
          x: 4,
          y: 0,
        },
        width: 1.1025814,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R10.1",
            x: 3.4487093,
            y: 0.0002732499999993365,
          },
          {
            pinId: "R10.2",
            x: 4.5512907,
            y: -0.0002732499999993365,
          },
        ],
      },
      schematic_component_11: {
        chipId: "schematic_component_11",
        center: {
          x: 4,
          y: 1,
        },
        width: 1.1025814,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R11.1",
            x: 3.4487093,
            y: 1.0002732499999993,
          },
          {
            pinId: "R11.2",
            x: 4.5512907,
            y: 0.9997267500000007,
          },
        ],
      },
      schematic_component_12: {
        chipId: "schematic_component_12",
        center: {
          x: 4,
          y: 2,
        },
        width: 1.1025814,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R12.1",
            x: 3.4487093,
            y: 2.0002732499999993,
          },
          {
            pinId: "R12.2",
            x: 4.5512907,
            y: 1.9997267500000007,
          },
        ],
      },
    },
    pins: [
      {
        pinId: "R1.2",
        x: -3.448709299999999,
        y: -3.0002732499999993,
        chipId: "schematic_component_1",
      },
      {
        pinId: "U1.1",
        x: -1.15,
        y: 0.7,
        chipId: "schematic_component_0",
      },
    ],
    guidelines: [
      {
        orientation: "horizontal",
        y: -3.29445535,
      },
      {
        orientation: "horizontal",
        y: 2.29445535,
      },
      {
        orientation: "vertical",
        x: -4.6512907000000006,
      },
      {
        orientation: "vertical",
        x: 4.6512907,
      },
      {
        orientation: "horizontal",
        y: -1.852772325,
      },
      {
        orientation: "vertical",
        x: -2.2993546499999997,
      },
      {
        orientation: "horizontal",
        y: -1.352772325,
      },
      {
        orientation: "horizontal",
        y: -0.8527723250000002,
      },
      {
        orientation: "horizontal",
        y: 0,
      },
      {
        orientation: "horizontal",
        y: 0.8527723250000002,
      },
      {
        orientation: "horizontal",
        y: 1.352772325,
      },
      {
        orientation: "vertical",
        x: 2.2993546499999997,
      },
      {
        orientation: "horizontal",
        y: -2.5,
      },
      {
        orientation: "vertical",
        x: -4,
      },
      {
        orientation: "horizontal",
        y: -2,
      },
      {
        orientation: "horizontal",
        y: -1.5,
      },
      {
        orientation: "horizontal",
        y: -0.9999999999999999,
      },
      {
        orientation: "horizontal",
        y: -0.4999999999999999,
      },
      {
        orientation: "horizontal",
        y: -3,
      },
      {
        orientation: "vertical",
        x: 4.440892098500626e-16,
      },
      {
        orientation: "horizontal",
        y: -1,
      },
      {
        orientation: "horizontal",
        y: -0.5,
      },
      {
        orientation: "horizontal",
        y: 0.5,
      },
      {
        orientation: "horizontal",
        y: 1,
      },
      {
        orientation: "horizontal",
        y: 1.5,
      },
      {
        orientation: "horizontal",
        y: 2,
      },
      {
        orientation: "vertical",
        x: 4,
      },
    ],
    inputProblem: {
      chips: [
        {
          chipId: "schematic_component_0",
          center: {
            x: 0,
            y: 0,
          },
          width: 2.3,
          height: 1.7999999999999998,
          pins: [
            {
              pinId: "U1.1",
              x: -1.15,
              y: 0.7,
            },
            {
              pinId: "U1.2",
              x: -1.15,
              y: 0.49999999999999994,
            },
            {
              pinId: "U1.3",
              x: -1.15,
              y: 0.29999999999999993,
            },
            {
              pinId: "U1.4",
              x: -1.15,
              y: 0.09999999999999987,
            },
            {
              pinId: "U1.5",
              x: -1.15,
              y: -0.10000000000000009,
            },
            {
              pinId: "U1.6",
              x: -1.15,
              y: -0.30000000000000004,
            },
            {
              pinId: "U1.7",
              x: -1.15,
              y: -0.5,
            },
            {
              pinId: "U1.8",
              x: -1.15,
              y: -0.7,
            },
            {
              pinId: "U1.9",
              x: 1.15,
              y: -0.7,
            },
            {
              pinId: "U1.10",
              x: 1.15,
              y: -0.49999999999999994,
            },
            {
              pinId: "U1.11",
              x: 1.15,
              y: -0.29999999999999993,
            },
            {
              pinId: "U1.12",
              x: 1.15,
              y: -0.09999999999999987,
            },
            {
              pinId: "U1.13",
              x: 1.15,
              y: 0.10000000000000009,
            },
            {
              pinId: "U1.14",
              x: 1.15,
              y: 0.30000000000000004,
            },
            {
              pinId: "U1.15",
              x: 1.15,
              y: 0.5,
            },
            {
              pinId: "U1.16",
              x: 1.15,
              y: 0.7,
            },
          ],
        },
        {
          chipId: "schematic_component_1",
          center: {
            x: -4,
            y: -3,
          },
          width: 1.1025814000000018,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R1.1",
              x: -4.551290700000001,
              y: -2.9997267500000007,
            },
            {
              pinId: "R1.2",
              x: -3.448709299999999,
              y: -3.0002732499999993,
            },
          ],
        },
        {
          chipId: "schematic_component_2",
          center: {
            x: -4,
            y: -2,
          },
          width: 1.1025814000000018,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R2.1",
              x: -4.551290700000001,
              y: -1.9997267500000007,
            },
            {
              pinId: "R2.2",
              x: -3.448709299999999,
              y: -2.0002732499999993,
            },
          ],
        },
        {
          chipId: "schematic_component_3",
          center: {
            x: -4,
            y: -1,
          },
          width: 1.1025814000000018,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R3.1",
              x: -4.551290700000001,
              y: -0.9997267500000007,
            },
            {
              pinId: "R3.2",
              x: -3.448709299999999,
              y: -1.0002732499999993,
            },
          ],
        },
        {
          chipId: "schematic_component_4",
          center: {
            x: -4,
            y: 0,
          },
          width: 1.1025814000000018,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R4.1",
              x: -4.551290700000001,
              y: 0.0002732499999993365,
            },
            {
              pinId: "R4.2",
              x: -3.448709299999999,
              y: -0.0002732499999993365,
            },
          ],
        },
        {
          chipId: "schematic_component_5",
          center: {
            x: -4,
            y: 1,
          },
          width: 1.1025814000000018,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R5.1",
              x: -4.551290700000001,
              y: 1.0002732499999993,
            },
            {
              pinId: "R5.2",
              x: -3.448709299999999,
              y: 0.9997267500000007,
            },
          ],
        },
        {
          chipId: "schematic_component_6",
          center: {
            x: -4,
            y: 2,
          },
          width: 1.1025814000000018,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R6.1",
              x: -4.551290700000001,
              y: 2.0002732499999993,
            },
            {
              pinId: "R6.2",
              x: -3.448709299999999,
              y: 1.9997267500000007,
            },
          ],
        },
        {
          chipId: "schematic_component_7",
          center: {
            x: 4,
            y: -3,
          },
          width: 1.1025814,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R7.1",
              x: 3.4487093,
              y: -2.9997267500000007,
            },
            {
              pinId: "R7.2",
              x: 4.5512907,
              y: -3.0002732499999993,
            },
          ],
        },
        {
          chipId: "schematic_component_8",
          center: {
            x: 4,
            y: -2,
          },
          width: 1.1025814,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R8.1",
              x: 3.4487093,
              y: -1.9997267500000007,
            },
            {
              pinId: "R8.2",
              x: 4.5512907,
              y: -2.0002732499999993,
            },
          ],
        },
        {
          chipId: "schematic_component_9",
          center: {
            x: 4,
            y: -1,
          },
          width: 1.1025814,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R9.1",
              x: 3.4487093,
              y: -0.9997267500000007,
            },
            {
              pinId: "R9.2",
              x: 4.5512907,
              y: -1.0002732499999993,
            },
          ],
        },
        {
          chipId: "schematic_component_10",
          center: {
            x: 4,
            y: 0,
          },
          width: 1.1025814,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R10.1",
              x: 3.4487093,
              y: 0.0002732499999993365,
            },
            {
              pinId: "R10.2",
              x: 4.5512907,
              y: -0.0002732499999993365,
            },
          ],
        },
        {
          chipId: "schematic_component_11",
          center: {
            x: 4,
            y: 1,
          },
          width: 1.1025814,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R11.1",
              x: 3.4487093,
              y: 1.0002732499999993,
            },
            {
              pinId: "R11.2",
              x: 4.5512907,
              y: 0.9997267500000007,
            },
          ],
        },
        {
          chipId: "schematic_component_12",
          center: {
            x: 4,
            y: 2,
          },
          width: 1.1025814,
          height: 0.388910699999999,
          pins: [
            {
              pinId: "R12.1",
              x: 3.4487093,
              y: 2.0002732499999993,
            },
            {
              pinId: "R12.2",
              x: 4.5512907,
              y: 1.9997267500000007,
            },
          ],
        },
      ],
      directConnections: [
        {
          pinIds: ["R1.2", "U1.1"],
          netId: ".R1 > .pin2 to .U1 > .IN1",
        },
        {
          pinIds: ["R2.2", "U1.3"],
          netId: ".R2 > .pin2 to .U1 > .IN3",
        },
        {
          pinIds: ["R3.2", "U1.4"],
          netId: ".R3 > .pin2 to .U1 > .IN4",
        },
        {
          pinIds: ["R4.2", "U1.6"],
          netId: ".R4 > .pin2 to .U1 > .IN6",
        },
        {
          pinIds: ["R5.2", "U1.7"],
          netId: ".R5 > .pin2 to .U1 > .IN7",
        },
        {
          pinIds: ["R6.2", "U1.8"],
          netId: ".R6 > .pin2 to .U1 > .IN8",
        },
        {
          pinIds: ["R7.1", "U1.16"],
          netId: ".R7 > .pin1 to .U1 > .OUT8",
        },
        {
          pinIds: ["R8.1", "U1.14"],
          netId: ".R8 > .pin1 to .U1 > .OUT6",
        },
        {
          pinIds: ["R9.1", "U1.13"],
          netId: ".R9 > .pin1 to .U1 > .OUT5",
        },
        {
          pinIds: ["R10.1", "U1.12"],
          netId: ".R10 > .pin1 to .U1 > .OUT4",
        },
        {
          pinIds: ["R11.1", "U1.10"],
          netId: ".R11 > .pin1 to .U1 > .OUT2",
        },
        {
          pinIds: ["R12.1", "U1.9"],
          netId: ".R12 > .pin1 to .U1 > .OUT1",
        },
        {
          pinIds: ["R1.1", "R12.2"],
          netId: ".R1 > .pin1 to .R12 > .pin2",
        },
        {
          pinIds: ["R3.1", "R10.2"],
          netId: ".R3 > .pin1 to .R10 > .pin2",
        },
        {
          pinIds: ["R5.1", "R8.2"],
          netId: ".R5 > .pin1 to .R8 > .pin2",
        },
      ],
      netConnections: [],
      availableNetLabelOrientations: {},
      maxMspPairDistance: 2,
    },
  }

  const solver = new SchematicTraceSingleLineSolver(input as any)
  solver.solve()

  // Check that the output is composed of strictly orthogonal lines

  for (let i = 0; i < solver.solvedTracePath!.length - 1; i++) {
    const start = solver.solvedTracePath![i]
    const end = solver.solvedTracePath![i + 1]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const isHorizontal = Math.abs(dy) < 1e-6
    const isVertical = Math.abs(dx) < 1e-6
    expect(isHorizontal || isVertical).toBe(true)
  }
})
