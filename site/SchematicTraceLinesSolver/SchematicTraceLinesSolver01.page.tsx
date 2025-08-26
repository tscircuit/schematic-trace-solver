import { useMemo } from "react"
import { GenericSolverDebugger } from "../components/GenericSolverDebugger"
import { SchematicTraceLinesSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const input = {
  mspConnectionPairs: [
    {
      mspPairId: "Q1.1-Q1.2",
      dcConnNetId: "connectivity_net0",
      globalConnNetId: "connectivity_net0",
      userNetId: "V3_3",
      pins: [
        {
          pinId: "Q1.1",
          x: 0.30397715550000004,
          y: 0.5800832909999993,
          _facingDirection: "y+",
          chipId: "schematic_component_0",
        },
        {
          pinId: "Q1.2",
          x: 0.31067575550000137,
          y: -0.5800832909999993,
          _facingDirection: "y-",
          chipId: "schematic_component_0",
        },
      ],
    },
  ],
  dcConnMap: {
    netMap: {
      connectivity_net0: ["Q1.1", "Q1.2"],
    },
    idToNetMap: {},
  },
  globalConnMap: {
    netMap: {
      connectivity_net0: ["Q1.1", "Q1.2"],
    },
    idToNetMap: {
      "Q1.1": "connectivity_net0",
      "Q1.2": "connectivity_net0",
    },
  },
  inputProblem: {
    chips: [
      {
        chipId: "schematic_component_0",
        center: {
          x: 0,
          y: 0,
        },
        width: 0.8935117710000002,
        height: 1.1601665819999987,
        pins: [
          {
            pinId: "Q1.1",
            x: 0.30397715550000004,
            y: 0.5800832909999993,
          },
          {
            pinId: "Q1.2",
            x: 0.31067575550000137,
            y: -0.5800832909999993,
          },
          {
            pinId: "Q1.3",
            x: -0.4467558855000001,
            y: -0.10250625000000019,
          },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "V3_3",
        pinIds: ["Q1.1", "Q1.2"],
      },
    ],
    availableNetLabelOrientations: {
      V3_3: ["y+"],
    },
    maxMspPairDistance: 2,
    _chipObstacleSpatialIndex: {
      chips: [
        {
          chipId: "schematic_component_0",
          center: {
            x: 0,
            y: 0,
          },
          width: 0.8935117710000002,
          height: 1.1601665819999987,
          pins: [
            {
              pinId: "Q1.1",
              x: 0.30397715550000004,
              y: 0.5800832909999993,
            },
            {
              pinId: "Q1.2",
              x: 0.31067575550000137,
              y: -0.5800832909999993,
            },
            {
              pinId: "Q1.3",
              x: -0.4467558855000001,
              y: -0.10250625000000019,
            },
          ],
          bounds: {
            minX: -0.4467558855000001,
            maxX: 0.4467558855000001,
            minY: -0.5800832909999993,
            maxY: 0.5800832909999993,
          },
          spatialIndexId: 0,
        },
      ],
      spatialIndex: {
        numItems: 1,
        nodeSize: 16,
        byteOffset: 0,
        _levelBounds: [4, 8],
        data: {},
        _boxes: {
          "0": -0.4467558855000001,
          "1": -0.5800832909999993,
          "2": 0.4467558855000001,
          "3": 0.5800832909999993,
          "4": -0.4467558855000001,
          "5": -0.5800832909999993,
          "6": 0.4467558855000001,
          "7": 0.5800832909999993,
        },
        _indices: {
          "0": 0,
          "1": 0,
        },
        _pos: 8,
        minX: -0.4467558855000001,
        minY: -0.5800832909999993,
        maxX: 0.4467558855000001,
        maxY: 0.5800832909999993,
        _queue: {
          ids: [],
          values: [],
          length: 0,
        },
      },
      spatialIndexIdToChip: {},
    },
  },
  guidelines: [],
  chipMap: {
    schematic_component_0: {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 0.8935117710000002,
      height: 1.1601665819999987,
      pins: [
        {
          pinId: "Q1.1",
          x: 0.30397715550000004,
          y: 0.5800832909999993,
        },
        {
          pinId: "Q1.2",
          x: 0.31067575550000137,
          y: -0.5800832909999993,
        },
        {
          pinId: "Q1.3",
          x: -0.4467558855000001,
          y: -0.10250625000000019,
        },
      ],
    },
  },
}

export default () => {
  const solver = useMemo(() => {
    return new SchematicTraceLinesSolver(input as any)
  }, [])
  return <GenericSolverDebugger solver={solver} />
}
