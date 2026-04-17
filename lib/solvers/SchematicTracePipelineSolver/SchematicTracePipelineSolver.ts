import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { InputProblem, SolvedTracePath } from "lib/types/InputProblem"
import { MspConnectionPairSolver } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTraceLinesSolver } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceOverlapShiftSolver } from "../TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import { NetLabelPlacementSolver } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { visualizeInputProblem } from "./visualizeInputProblem"
import { TraceLabelOverlapAvoidanceSolver } from "../TraceLabelOverlapAvoidanceSolver/TraceLabelOverlapAvoidanceSolver"
import { correctPinsInsideChips } from "./correctPinsInsideChip"
import { expandChipsToFitPins } from "./expandChipsToFitPins"
import { LongDistancePairSolver } from "../LongDistancePairSolver/LongDistancePairSolver"
import { TraceCleanupSolver } from "../TraceCleanupSolver/TraceCleanupSolver"

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
  T extends new (...args: any[]) => BaseSolver,
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

export class SchematicTracePipelineSolver extends BaseSolver {
  mspConnectionPairSolver?: MspConnectionPairSolver
  schematicTraceLinesSolver?: SchematicTraceLinesSolver
  longDistancePairSolver?: LongDistancePairSolver
  traceOverlapShiftSolver?: TraceOverlapShiftSolver
  netLabelPlacementSolver?: NetLabelPlacementSolver
  traceLabelOverlapAvoidanceSolver?: TraceLabelOverlapAvoidanceSolver
  traceCleanupSolver?: TraceCleanupSolver

  startTimeOfPhase: Record<string, number> = {}
  endTimeOfPhase: Record<string, number> = {}
  timeSpentOnPhase: Record<string, number> = {}
  firstIterationOfPhase: Record<string, number> = {}

  inputProblem: InputProblem

  pipelineDef = [
    definePipelineStep(
      "mspConnectionPairSolver",
      MspConnectionPairSolver,
      () => [{ inputProblem: this.inputProblem }],
    ),
    definePipelineStep(
      "schematicTraceLinesSolver",
      SchematicTraceLinesSolver,
      () => [
        {
          mspConnectionPairs: this.mspConnectionPairSolver!.mspConnectionPairs,
          dcConnMap: this.mspConnectionPairSolver!.dcConnMap,
          globalConnMap: this.mspConnectionPairSolver!.globalConnMap,
          inputProblem: this.inputProblem,
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
              (this.longDistancePairSolver!.getOutput().allTracesMerged || []).map(
                (p: any) => [p.mspPairId, p],
              ),
            ),
        },
      ],
    ),
    definePipelineStep(
      "traceLabelOverlapAvoidanceSolver",
      TraceLabelOverlapAvoidanceSolver,
      (instance) => {
        const traceMap =
          instance.traceOverlapShiftSolver?.correctedTraceMap ??
          Object.fromEntries(
            (instance.longDistancePairSolver!.getOutput().allTracesMerged || []).map(
              (p: any) => [p.mspPairId, p],
            ),
          )
        const traces = Object.values(traceMap) as SolvedTracePath[]
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
      const traces = prevSolverOutput.traces || []
      const labelMergingOutput =
        instance.traceLabelOverlapAvoidanceSolver!.labelMergingSolver!.getOutput()

      return [
        {
          inputProblem: instance.inputProblem,
          allTraces: traces,
          allLabelPlacements: labelMergingOutput.netLabelPlacements || [],
          mergedLabelNetIdMap: labelMergingOutput.mergedLabelNetIdMap || {},
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
          instance.traceLabelOverlapAvoidanceSolver!.getOutput().traces ?? []

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
  ]

  constructor(inputProblem: InputProblem) {
    super()
    this.inputProblem = this.cloneAndCorrectInputProblem(inputProblem)
  }

  override getConstructorParams() {
    return [this.inputProblem]
  }

  currentPipelineStepIndex = 0

  private cloneAndCorrectInputProblem(original: InputProblem): InputProblem {
    const cloned: InputProblem = structuredClone({
      ...original,
      _chipObstacleSpatialIndex: undefined,
    })

    expandChipsToFitPins(cloned)
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

  /**
   * Returns the final solver output with cleanup applied to traces.
   * Gracefully handles empty or null results.
   */
  override getOutput() {
    if (!this.solved) return null

    const finalSolver = this.netLabelPlacementSolver
    if (!finalSolver) return null

    // Safe handling of empty or missing inputTraceMap
    const traceMap = finalSolver.inputTraceMap || {}
    const traces = Object.values(traceMap) as SolvedTracePath[]

    if (traces.length === 0) {
      return {
        traces: [],
        netLabelPlacements: finalSolver.netLabelPlacements || [],
      }
    }

    // Apply cleanup: merge collinear points
    const cleanedTraces = traces.map((trace) => ({
      ...trace,
      points: this.mergeCollinearSegments(trace.points || []),
    }))

    return {
      traces: cleanedTraces,
      netLabelPlacements: finalSolver.netLabelPlacements || [],
    }
  }

  /**
   * Merges multiple points on the same line into a single segment.
   * e.g. (10,10) -> (20,10) -> (30,10) becomes (10,10) -> (30,10)
   */
  private mergeCollinearSegments(
    points: Array<{ x: number; y: number }>,
  ): Array<{ x: number; y: number }> {
    if (points.length <= 2) return points

    const result: Array<{ x: number; y: number }> = [points[0]]
    for (let i = 1; i < points.length - 1; i++) {
      const prev = result[result.length - 1]!
      const curr = points[i]!
      const next = points[i + 1]!

      // Schematic traces are usually orthogonal, so we check for same X or same Y
      const isCollinear =
        (Math.abs(prev.x - curr.x) < 0.001 && Math.abs(curr.x - next.x) < 0.001) ||
        (Math.abs(prev.y - curr.y) < 0.001 && Math.abs(curr.y - next.y) < 0.001)

      if (!isCollinear) {
        result.push(curr)
      }
    }
    result.push(points[points.length - 1]!)
    return result
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
    return visualizeInputProblem(this.inputProblem)
  }
}
