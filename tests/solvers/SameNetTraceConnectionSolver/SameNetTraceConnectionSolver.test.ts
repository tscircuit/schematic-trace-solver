import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { connectCloseSameNetTraces } from "lib/solvers/SameNetTraceConnectionSolver/SameNetTraceConnectionSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const trace = ({
  id,
  globalConnNetId,
  userNetId = globalConnNetId,
  tracePath,
}: {
  id: string
  globalConnNetId: string
  userNetId?: string
  tracePath: SolvedTracePath["tracePath"]
}): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: `${globalConnNetId}-dc`,
    globalConnNetId,
    userNetId,
    pins: [
      { pinId: `${id}.1`, chipId: "U1", x: -10, y: -10 },
      { pinId: `${id}.2`, chipId: "U2", x: 10, y: 10 },
    ],
    pinIds: [`${id}.1`, `${id}.2`],
    mspConnectionPairIds: [id],
    tracePath,
  }) as SolvedTracePath

const connect = (
  traces: SolvedTracePath[],
  overrides: Partial<Parameters<typeof connectCloseSameNetTraces>[0]> = {},
) =>
  connectCloseSameNetTraces({
    inputProblem,
    inputTraceMap: Object.fromEntries(
      traces.map((singleTrace) => [singleTrace.mspPairId, singleTrace]),
    ),
    maxGap: 0.15,
    ...overrides,
  })

const expectManhattan = (traces: SolvedTracePath[]) => {
  for (const singleTrace of traces) {
    for (let i = 0; i < singleTrace.tracePath.length - 1; i++) {
      const start = singleTrace.tracePath[i]!
      const end = singleTrace.tracePath[i + 1]!
      expect(start.x === end.x || start.y === end.y).toBe(true)
    }
  }
}

test("closes a horizontal same-net collinear gap", () => {
  const result = connect([
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
  ])

  expect(result.a!.tracePath[1]).toEqual({ x: 1.05, y: 0 })
  expect(result.b!.tracePath[0]).toEqual({ x: 1.05, y: 0 })
  expectManhattan(Object.values(result))
})

test("closes a vertical same-net collinear gap", () => {
  const result = connect([
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 1.1 },
        { x: 0, y: 2 },
      ],
    }),
  ])

  expect(result.a!.tracePath[1]).toEqual({ x: 0, y: 1.05 })
  expect(result.b!.tracePath[0]).toEqual({ x: 0, y: 1.05 })
  expectManhattan(Object.values(result))
})

test("snaps nearby same-net horizontal segments to the same y", () => {
  const result = connect([
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0.5, y: 0.1 },
        { x: 1.5, y: 0.1 },
      ],
    }),
  ])

  expect(result.a!.tracePath).toEqual([
    { x: 0, y: 0.05 },
    { x: 2, y: 0.05 },
  ])
  expect(result.b!.tracePath).toEqual([
    { x: 0.5, y: 0.05 },
    { x: 1.5, y: 0.05 },
  ])
  expectManhattan(Object.values(result))
})

test("snaps nearby same-net vertical segments to the same x", () => {
  const result = connect([
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0.1, y: 0.5 },
        { x: 0.1, y: 1.5 },
      ],
    }),
  ])

  expect(result.a!.tracePath).toEqual([
    { x: 0.05, y: 0 },
    { x: 0.05, y: 2 },
  ])
  expect(result.b!.tracePath).toEqual([
    { x: 0.05, y: 0.5 },
    { x: 0.05, y: 1.5 },
  ])
  expectManhattan(Object.values(result))
})

test("uses global net identity instead of user net identity", () => {
  const result = connect([
    trace({
      id: "a",
      globalConnNetId: "NET1",
      userNetId: "LEFT_LABEL",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      userNetId: "RIGHT_LABEL",
      tracePath: [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
  ])

  expect(result.a!.tracePath[1]).toEqual({ x: 1.05, y: 0 })
  expect(result.b!.tracePath[0]).toEqual({ x: 1.05, y: 0 })
})

test("does not connect different global nets", () => {
  const traces = [
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET2",
      tracePath: [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
  ]

  const result = connect(traces)

  expect(result.a!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result.b!.tracePath).toEqual(traces[1]!.tracePath)
})

test("does not move true pin endpoints", () => {
  const pinnedTrace = trace({
    id: "a",
    globalConnNetId: "NET1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  })
  pinnedTrace.pins[1].x = 1
  pinnedTrace.pins[1].y = 0

  const result = connect([
    pinnedTrace,
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
  ])

  expect(result.a!.tracePath[1]).toEqual({ x: 1, y: 0 })
  expect(result.b!.tracePath[0]).toEqual({ x: 1, y: 0 })
  expectManhattan(Object.values(result))
})

test("keeps interior elbow moves manhattan", () => {
  const traces = [
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 1.1, y: -1 },
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
  ]

  const result = connect(traces)

  expectManhattan(Object.values(result))
})

test("skips a bridge blocked by a chip obstacle", () => {
  const traces = [
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
  ]

  const result = connect(traces, {
    inputProblem: {
      ...inputProblem,
      chips: [
        {
          chipId: "U1",
          center: { x: 1.05, y: 0 },
          width: 0.08,
          height: 0.08,
          pins: [],
        },
      ],
    },
  })

  expect(result.a!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result.b!.tracePath).toEqual(traces[1]!.tracePath)
})

test("skips a bridge that would touch a foreign-net trace", () => {
  const traces = [
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
    trace({
      id: "c",
      globalConnNetId: "NET2",
      tracePath: [
        { x: 1.05, y: -1 },
        { x: 1.05, y: 1 },
      ],
    }),
  ]

  const result = connect(traces)

  expect(result.a!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result.b!.tracePath).toEqual(traces[1]!.tracePath)
})

test("skips a bridge blocked by a label obstacle", () => {
  const traces = [
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
  ]

  const result = connect(traces, {
    labelObstacles: [{ minX: 1.01, maxX: 1.09, minY: -0.04, maxY: 0.04 }],
  })

  expect(result.a!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result.b!.tracePath).toEqual(traces[1]!.tracePath)
})

test("skips gaps larger than tolerance", () => {
  const traces = [
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 1.2, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
  ]

  const result = connect(traces)

  expect(result.a!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result.b!.tracePath).toEqual(traces[1]!.tracePath)
})

test("connects chained close same-net segments deterministically", () => {
  const result = connect([
    trace({
      id: "a",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    trace({
      id: "b",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
    trace({
      id: "c",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 2.1, y: 0 },
        { x: 3, y: 0 },
      ],
    }),
  ])

  expect(result.a!.tracePath[1]).toEqual({ x: 1.05, y: 0 })
  expect(result.b!.tracePath[0]).toEqual({ x: 1.05, y: 0 })
  expect(result.b!.tracePath[1]).toEqual({ x: 2.05, y: 0 })
  expect(result.c!.tracePath[0]).toEqual({ x: 2.05, y: 0 })
  expectManhattan(Object.values(result))
})

test("continues connecting same-net chains beyond fifty successful passes", () => {
  const traceCount = 62
  const result = connect(
    Array.from({ length: traceCount }, (_, index) =>
      trace({
        id: `trace${index}`,
        globalConnNetId: "NET1",
        tracePath: [
          { x: index * 1.1, y: 0 },
          { x: index * 1.1 + 1, y: 0 },
        ],
      }),
    ),
  )

  for (let index = 0; index < traceCount - 1; index++) {
    expect(result[`trace${index}`]!.tracePath[1]).toEqual(
      result[`trace${index + 1}`]!.tracePath[0],
    )
  }
  expectManhattan(Object.values(result))
})

test("terminates deterministically on dense same-net traces", () => {
  const traces = Array.from({ length: 24 }, (_, index) =>
    trace({
      id: `dense${index}`,
      globalConnNetId: "NET1",
      tracePath: [
        { x: index * 0.55, y: 0 },
        { x: index * 0.55 + 0.5, y: 0 },
      ],
    }),
  )

  const firstResult = connect(traces)
  const secondResult = connect(traces)

  expect(secondResult).toEqual(firstResult)
  expectManhattan(Object.values(firstResult))
})
