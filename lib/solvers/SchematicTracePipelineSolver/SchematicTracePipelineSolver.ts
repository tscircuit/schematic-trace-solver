/**
 * Pipeline solver that runs a series of solvers to find the best schematic layout.
 * Coordinates the entire layout process from chip partitioning through final packing.
 */

import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { MspConnectionPairSolver } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import {
  SchematicTraceLinesSolver,
  type SolvedTracePath,
} from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceOverlapShiftSolver } from "../TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import {
  NetLabelPlacementSolver,
  type NetLabelPlacement,
} from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { colorAvailableNetOrientationLabels } from "./colorAvailableNetOrientationLabels"
import { visualizeInputProblem } from "./visualizeInputProblem"
import { TraceLabelOverlapAvoidanceSolver } from "../TraceLabelOverlapAvoidanceSolver/TraceLabelOverlapAvoidanceSolver"
import { correctPinsInsideChips } from "./correctPinsInsideChip"
import { expandChipsToFitPins } from "./expandChipsToFitPins"
import { LongDistancePairSolver } from "../LongDistancePairSolver/LongDistancePairSolver"
import { MergedNetLabelObstacleSolver } from "../TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/LabelMergingSolver"
import { TraceCleanupSolver } from "../TraceCleanupSolver/TraceCleanupSolver"
import { Example28Solver } from "../Example28Solver/Example28Solver"
import { AvailableNetOrientationSolver } from "../AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import { RailNetLabelCornerPlacementSolver } from "../RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import { TraceAnchoredNetLabelOverlapSolver } from "../TraceAnchoredNetLabelOverlapSolver/TraceAnchoredNetLabelOverlapSolver"
import { NetLabelTraceCollisionSolver } from "../NetLabelTraceCollisionSolver/NetLabelTraceCollisionSolver"
import { NetLabelNetLabelCollisionSolver } from "../NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"

type PipelineStep<T extends new (...args: any[]) => BaseSolver> = {
  solverName: string
  solverClass: T
  getConstructorParams: (
    instance: SchematicTracePipelineSolver,
  ) => ConstructorParameters<T>
  onSolved?: (instance: SchematicTracePipelineSolver) => void
  shouldSkip?: (instance: SchematicTracePipelineSolver) => boolean
}

function definePipelineStep<
  T extends new (
    ...args: any[]
  ) => BaseSolver,
  const P extends ConstructorParameters<T>,
>(
  solverName: keyof SchematicTracePipelineSolver,
  solverClass: T,
  getConstructorParams: (instance: SchematicTracePipelineSolver) => P,
  opts: {
    onSolved?: (instance: SchematicTracePipelineSolver) => void
    shouldSkip?: (instance: SchematicTracePipelineSolver) => boolean
  } = {},
): PipelineStep<T> {
  return {
    solverName,
    solverClass,
    getConstructorParams,
    onSolved: opts.onSolved,
    shouldSkip: opts.shouldSkip,
  }
}

interface Options {
  hideRatsNet?: boolean
}

export class SchematicTracePipelineSolver extends BaseSolver {
  mspConnectionPairSolver?: MspConnectionPairSolver
  // guidelinesSolver?: GuidelinesSolver
  schematicTraceLinesSolver?: SchematicTraceLinesSolver
  longDistancePairSolver?: LongDistancePairSolver
  traceOverlapShiftSolver?: TraceOverlapShiftSolver
  netLabelPlacementSolver?: NetLabelPlacementSolver
  labelMergingSolver?: MergedNetLabelObstacleSolver
  traceLabelOverlapAvoidanceSolver?: TraceLabelOverlapAvoidanceSolver
  traceCleanupSolver?: TraceCleanupSolver
  example28Solver?: Example28Solver
  availableNetOrientationSolver?: AvailableNetOrientationSolver
  railNetLabelCornerPlacementSolver?: RailNetLabelCornerPlacementSolver
  traceAnchoredNetLabelOverlapSolver?: TraceAnchoredNetLabelOverlapSolver
  preAlignmentNetLabelTraceCollisionSolver?: NetLabelTraceCollisionSolver
  netLabelTraceCollisionSolver?: NetLabelTraceCollisionSolver
  traceCleanupSolver2?: TraceCleanupSolver
  netLabelNetLabelCollisionSolver?: NetLabelNetLabelCollisionSolver

  startTimeOfPhase: Record<string, number>
  endTimeOfPhase: Record<string, number>
  timeSpentOnPhase: Record<string, number>
  firstIterationOfPhase: Record<string, number>

  inputProblem: InputProblem
  hideRatsNet: boolean

  pipelineDef = [
    definePipelineStep(
      "mspConnectionPairSolver",
      MspConnectionPairSolver,
      () => [{ inputProblem: this.inputProblem }],
      {
        onSolved: (mspSolver) => {},
      },
    ),
    // definePipelineStep(
    //   "guidelinesSolver",
    //   GuidelinesSolver,
    //   () => [
    //     {
    //       inputProblem: this.inputProblem,
    //     },
    //   ],
    //   {
    //     onSolved: (guidelinesSolver) => {},
    //   },
    // ),
    definePipelineStep(
      "schematicTraceLinesSolver",
      SchematicTraceLinesSolver,
      () => [
        {
          mspConnectionPairs: this.mspConnectionPairSolver!.mspConnectionPairs,
          dcConnMap: this.mspConnectionPairSolver!.dcConnMap,
          globalConnMap: this.mspConnectionPairSolver!.globalConnMap,
          inputProblem: this.inputProblem,
          // guidelines: this.guidelinesSolver!.guidelines,
          chipMap: this.mspConnectionPairSolver!.chipMap,
        },
      ],
    ),
    definePipelineStep(
      "longDistancePairSolver",
      LongDistancePairSolver,
      (instance) => [
        {
          inputProblem: instance.inputProblem,
          primaryMspConnectionPairs:
            instance.mspConnectionPairSolver!.mspConnectionPairs,
          alreadySolvedTraces:
            instance.schematicTraceLinesSolver!.solvedTracePaths,
        },
      ],
      {
        onSolved: (schematicTraceLinesSolver) => {},
      },
    ),
    definePipelineStep(
      "traceOverlapShiftSolver",
      TraceOverlapShiftSolver,
      () => [
        {
          inputProblem: this.inputProblem,
          inputTracePaths:
            this.longDistancePairSolver?.getOutput().allTracesMerged!,
          globalConnMap: this.mspConnectionPairSolver!.globalConnMap,
        },
      ],
      {
        onSolved: (_solver) => {},
      },
    ),
    definePipelineStep(
      "netLabelPlacementSolver",
      NetLabelPlacementSolver,
      () => [
        {
          inputProblem: this.inputProblem,
          inputTraceMap:
            this.traceOverlapShiftSolver?.correctedTraceMap ??
            Object.fromEntries(
              this.longDistancePairSolver!.getOutput().allTracesMerged.map(
                (p) => [p.mspPairId, p],
              ),
            ),
        },
      ],
      {
        onSolved: (_solver) => {
          // TODO
        },
      },
    ),
    definePipelineStep(
      "traceLabelOverlapAvoidanceSolver",
      TraceLabelOverlapAvoidanceSolver,
      (instance) => {
        const traceMap =
          instance.traceOverlapShiftSolver?.correctedTraceMap ??
          Object.fromEntries(
            instance
              .longDistancePairSolver!.getOutput()
              .allTracesMerged.map((p) => [p.mspPairId, p]),
          )
        const traces = Object.values(traceMap)
        const netLabelPlacements =
          instance.netLabelPlacementSolver!.netLabelPlacements

        return [
          {
            inputProblem: instance.inputProblem,
            traces,
            netLabelPlacements,
          },
        ]
      },
    ),
    definePipelineStep("traceCleanupSolver", TraceCleanupSolver, (instance) => {
      const prevSolverOutput =
        instance.traceLabelOverlapAvoidanceSolver!.getOutput()
      const traces = prevSolverOutput.traces

      const labelMergingOutput =
        instance.traceLabelOverlapAvoidanceSolver!.labelMergingSolver!.getOutput()

      return [
        {
          inputProblem: instance.inputProblem,
          allTraces: traces,
          allLabelPlacements: labelMergingOutput.netLabelPlacements,
          mergedLabelNetIdMap: labelMergingOutput.mergedLabelNetIdMap,
          paddingBuffer: 0.1,
        },
      ]
    }),
    definePipelineStep(
      "netLabelPlacementSolver",
      NetLabelPlacementSolver,
      (instance) => {
        const traces =
          instance.traceCleanupSolver?.getOutput().traces ??
          instance.traceLabelOverlapAvoidanceSolver!.getOutput().traces

        return [
          {
            inputProblem: instance.inputProblem,
            inputTraceMap: Object.fromEntries(
              traces.map((trace: SolvedTracePath) => [trace.mspPairId, trace]),
            ),
          },
        ]
      },
    ),
    definePipelineStep("example28Solver", Example28Solver, (instance) => {
      const traces =
        instance.traceCleanupSolver?.getOutput().traces ??
        instance.traceLabelOverlapAvoidanceSolver!.getOutput().traces

      return [
        {
          inputProblem: instance.inputProblem,
          traces,
          netLabelPlacements:
            instance.netLabelPlacementSolver!.netLabelPlacements,
        },
      ]
    }),
    definePipelineStep(
      "availableNetOrientationSolver",
      AvailableNetOrientationSolver,
      (instance) => [
        {
          inputProblem: instance.inputProblem,
          traces: instance.example28Solver!.outputTraces,
          netLabelPlacements:
            instance.example28Solver!.outputNetLabelPlacements,
        },
      ],
    ),
    definePipelineStep(
      "railNetLabelCornerPlacementSolver",
      RailNetLabelCornerPlacementSolver,
      (instance) => {
        return [
          {
            inputProblem: instance.inputProblem,
            traces: instance.availableNetOrientationSolver!.traces,
            netLabelPlacements:
              instance.availableNetOrientationSolver!.outputNetLabelPlacements,
          },
        ]
      },
    ),
    definePipelineStep(
      "traceAnchoredNetLabelOverlapSolver",
      TraceAnchoredNetLabelOverlapSolver,
      (instance) => [
        {
          inputProblem: instance.inputProblem,
          traces: instance.availableNetOrientationSolver!.traces,
          netLabelPlacements:
            instance.railNetLabelCornerPlacementSolver!
              .outputNetLabelPlacements,
        },
      ],
    ),
    definePipelineStep(
      "preAlignmentNetLabelTraceCollisionSolver",
      NetLabelTraceCollisionSolver,
      (instance) => [
        {
          inputProblem: instance.inputProblem,
          traces: instance.availableNetOrientationSolver!.traces,
          netLabelPlacements:
            instance.traceAnchoredNetLabelOverlapSolver!
              .outputNetLabelPlacements,
        },
      ],
    ),
    definePipelineStep(
      "traceCleanupSolver2",
      TraceCleanupSolver,
      (instance) => {
        const collisionOutput =
          instance.preAlignmentNetLabelTraceCollisionSolver!.getOutput()
        const labelMergingOutput =
          instance.traceLabelOverlapAvoidanceSolver!.labelMergingSolver!.getOutput()

        return [
          {
            inputProblem: instance.inputProblem,
            allTraces: collisionOutput.traces,
            allLabelPlacements: collisionOutput.netLabelPlacements,
            mergedLabelNetIdMap: labelMergingOutput.mergedLabelNetIdMap,
            paddingBuffer: 0.1,
            operations: ["aligning_same_net_rails"],
            eligibleTraceIds: new Set(
              instance
                .traceCleanupSolver!.getOutput()
                .traces.map((trace) => trace.mspPairId),
            ),
          },
        ]
      },
    ),
    definePipelineStep(
      "netLabelTraceCollisionSolver",
      NetLabelTraceCollisionSolver,
      (instance) => {
        const previousCollisionOutput =
          instance.preAlignmentNetLabelTraceCollisionSolver!.getOutput()

        return [
          {
            inputProblem: instance.inputProblem,
            traces: instance.traceCleanupSolver2!.getOutput().traces,
            netLabelPlacements: previousCollisionOutput.netLabelPlacements,
          },
        ]
      },
    ),
    definePipelineStep(
      "netLabelNetLabelCollisionSolver",
      NetLabelNetLabelCollisionSolver,
      (instance) => [
        {
          inputProblem: instance.inputProblem,
          traces: instance.netLabelTraceCollisionSolver!.getOutput().traces,
          netLabelPlacements:
            instance.netLabelTraceCollisionSolver!.getOutput()
              .netLabelPlacements,
        },
      ],
    ),
  ]

  constructor(inputProblem: InputProblem, opts?: Options) {
    super()
    this.hideRatsNet = opts?.hideRatsNet ?? false
    this.inputProblem = this.cloneAndCorrectInputProblem(inputProblem)
    this.MAX_ITERATIONS = 1e6
    this.startTimeOfPhase = {}
    this.endTimeOfPhase = {}
    this.timeSpentOnPhase = {}
    this.firstIterationOfPhase = {}
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicTracePipelineSolver
  > {
    return [this.inputProblem, { hideRatsNet: this.hideRatsNet }]
  }

  currentPipelineStepIndex = 0

  private cloneAndCorrectInputProblem(original: InputProblem): InputProblem {
    const cloned: InputProblem = structuredClone({
      ...original,
      _chipObstacleSpatialIndex: undefined,
      _hideRatsNet: this.hideRatsNet,
    })

    // First, expand chips so existing pin coordinates sit on or within their edges without shrinking.
    expandChipsToFitPins(cloned)
    // Then, for any remaining pins that are still inside due to mixed extremes, snap them to the nearest edge.
    correctPinsInsideChips(cloned)

    return cloned
  }

  override _step() {
    const pipelineStepDef = this.pipelineDef[this.currentPipelineStepIndex]
    if (!pipelineStepDef) {
      this.solved = true
      return
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      if (this.activeSubSolver.solved) {
        this.endTimeOfPhase[pipelineStepDef.solverName] = performance.now()
        this.timeSpentOnPhase[pipelineStepDef.solverName] =
          this.endTimeOfPhase[pipelineStepDef.solverName]! -
          this.startTimeOfPhase[pipelineStepDef.solverName]!
        pipelineStepDef.onSolved?.(this)
        this.activeSubSolver = null
        this.currentPipelineStepIndex++
      } else if (this.activeSubSolver.failed) {
        this.error = this.activeSubSolver?.error
        this.failed = true
        this.activeSubSolver = null
      }
      return
    }

    const constructorParams = pipelineStepDef.getConstructorParams(this)
    // @ts-ignore
    this.activeSubSolver = new pipelineStepDef.solverClass(...constructorParams)
    ;(this as any)[pipelineStepDef.solverName] = this.activeSubSolver
    this.timeSpentOnPhase[pipelineStepDef.solverName] = 0
    this.startTimeOfPhase[pipelineStepDef.solverName] = performance.now()
    this.firstIterationOfPhase[pipelineStepDef.solverName] = this.iterations
  }

  solveUntilPhase(phase: string) {
    while (this.getCurrentPhase().toLowerCase() !== phase.toLowerCase()) {
      this.step()
    }
  }

  getCurrentPhase(): string {
    return this.pipelineDef[this.currentPipelineStepIndex]?.solverName ?? "none"
  }

  override visualize(): GraphicsObject {
    if (!this.solved && this.activeSubSolver)
      return this.activeSubSolver.visualize()

    const visualizations = [
      visualizeInputProblem(this.inputProblem, {
        hideRatsNet: this.hideRatsNet,
      }),
      ...(this.pipelineDef
        .map((p) => (this as any)[p.solverName]?.visualize())
        .filter(Boolean)
        .map((viz, stepIndex) => {
          for (const rect of viz!.rects ?? []) {
            rect.step = stepIndex
          }
          for (const point of viz!.points ?? []) {
            point.step = stepIndex
          }
          for (const circle of viz!.circles ?? []) {
            circle.step = stepIndex
          }
          for (const text of viz!.texts ?? []) {
            text.step = stepIndex
          }
          for (const line of viz!.lines ?? []) {
            line.step = stepIndex
          }
          return viz
        }) as GraphicsObject[]),
    ]

    if (visualizations.length === 1) {
      return visualizations[0]!
    }

    // Simple combination of visualizations
    const finalGraphics = {
      points: visualizations.flatMap((v) => v.points || []),
      rects: visualizations.flatMap((v) => v.rects || []),
      lines: visualizations.flatMap((v) => v.lines || []),
      circles: visualizations.flatMap((v) => v.circles || []),
      texts: visualizations.flatMap((v) => v.texts || []),
    }
    colorAvailableNetOrientationLabels(finalGraphics, this.inputProblem)
    return finalGraphics
  }

  /**
   * Returns the final output of the pipeline after solving.
   *
   * The output contains the fully-routed traces (after label-collision
   * rerouting) and the final net-label placements (after label–label
   * collision resolution).
   *
   * The method walks backwards through the pipeline stages so that it
   * works even if intermediate stages were skipped or haven't been reached
   * yet (in which case earlier stages supply the data).
   */
  getOutput(): {
    traces: SolvedTracePath[]
    netLabelPlacements: NetLabelPlacement[]
  } {
    // Traces: the last solver that modifies traces is NetLabelTraceCollisionSolver.
    // Fall back through earlier stages if later ones haven't run.
    const traces: SolvedTracePath[] =
      this.netLabelTraceCollisionSolver?.getOutput().traces ??
      this.availableNetOrientationSolver?.traces ??
      this.example28Solver?.outputTraces ??
      this.traceCleanupSolver?.getOutput().traces ??
      this.traceLabelOverlapAvoidanceSolver?.getOutput().traces ??
      (this.traceOverlapShiftSolver?.correctedTraceMap
        ? Object.values(this.traceOverlapShiftSolver.correctedTraceMap)
        : undefined) ??
      this.longDistancePairSolver?.getOutput().allTracesMerged ??
      this.schematicTraceLinesSolver?.solvedTracePaths ??
      []

    // Net label placements: the last solver that modifies placements is
    // NetLabelNetLabelCollisionSolver.
    const netLabelPlacements: NetLabelPlacement[] =
      this.netLabelNetLabelCollisionSolver?.getOutput().netLabelPlacements ??
      this.netLabelTraceCollisionSolver?.getOutput().netLabelPlacements ??
      this.traceAnchoredNetLabelOverlapSolver?.outputNetLabelPlacements ??
      this.vccNetLabelCornerPlacementSolver?.outputNetLabelPlacements ??
      this.availableNetOrientationSolver?.outputNetLabelPlacements ??
      this.example28Solver?.outputNetLabelPlacements ??
      this.netLabelPlacementSolver?.netLabelPlacements ??
      []

    return { traces, netLabelPlacements }
  }

  /**
   * A lightweight version of the visualize method that can be used to stream
   * progress
   */
  override preview(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.preview()
    }

    return super.preview()
  }
}
