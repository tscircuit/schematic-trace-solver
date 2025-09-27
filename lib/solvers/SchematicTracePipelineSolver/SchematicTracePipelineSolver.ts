/**
 * Pipeline solver that runs a series of solvers to find the best schematic layout.
 * Coordinates the entire layout process fr      },
      {
        onSolved: (_solver) => {
          // TODO
        },
      },
    ),
    definePipelineStep(
      "netlabelTraceOverlapAvoidanceSolver",
      NetlabelTraceOverlapAvoidanceSolver,
      (instance) => {
        const traceMap =
          instance.traceOverlapShiftSolver?.correctedTraceMap ??
          Object.fromEntries(
            instance.schematicTraceLinesSolver!.solvedTracePaths.map((p) => [
              p.mspPairId,
              p,
            ]),
          )

        return [
          {
            inputProblem: instance.inputProblem,
            inputTraceMap: traceMap,
            failedNetlabelPlacements: instance.netLabelPlacementSolver!.failedPlacementAttempts,
          },
        ]
      },
      {
        onSolved: (instance) => {
          if (
            instance.netlabelTraceOverlapAvoidanceSolver &&
            instance.netLabelPlacementSolver
          ) {
            const { modifiedTraceMap, successfullyPlacedNetlabels } =
              instance.netlabelTraceOverlapAvoidanceSolver.getOutput()
            
            // Update traces if they were modified
            if (instance.traceOverlapShiftSolver) {
              instance.traceOverlapShiftSolver.correctedTraceMap = {
                ...instance.traceOverlapShiftSolver.correctedTraceMap,
                ...modifiedTraceMap
              }
            }
            
            // Add successfully placed netlabels
            instance.netLabelPlacementSolver.netLabelPlacements.push(...successfullyPlacedNetlabels)
          }
        },
      },
    ),
    definePipelineStep(partitioning through final packing.
 */

import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { MspConnectionPairSolver } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTraceLinesSolver } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceOverlapShiftSolver } from "../TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import { NetLabelPlacementSolver } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { visualizeInputProblem } from "./visualizeInputProblem"
import { GuidelinesSolver } from "../GuidelinesSolver/GuidelinesSolver"
import { TraceLabelOverlapAvoidanceSolver } from "../TraceLabelOverlapAvoidanceSolver/TraceLabelOverlapAvoidanceSolver"
import { NetlabelTraceOverlapAvoidanceSolver } from "../NetlabelTraceOverlapAvoidanceSolver/NetlabelTraceOverlapAvoidanceSolver"
import { getInputChipBounds } from "../GuidelinesSolver/getInputChipBounds"
import { correctPinsInsideChips } from "./correctPinsInsideChip"
import { expandChipsToFitPins } from "./expandChipsToFitPins"

type PipelineStep<T extends new (...args: any[]) => BaseSolver> = {
  solverName: string
  solverClass: T
  getConstructorParams: (
    instance: SchematicTracePipelineSolver,
  ) => ConstructorParameters<T>
  onSolved?: (instance: SchematicTracePipelineSolver) => void
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
  } = {},
): PipelineStep<T> {
  return {
    solverName,
    solverClass,
    getConstructorParams,
    onSolved: opts.onSolved,
  }
}

export class SchematicTracePipelineSolver extends BaseSolver {
  mspConnectionPairSolver?: MspConnectionPairSolver
  // guidelinesSolver?: GuidelinesSolver
  schematicTraceLinesSolver?: SchematicTraceLinesSolver
  traceOverlapShiftSolver?: TraceOverlapShiftSolver
  netLabelPlacementSolver?: NetLabelPlacementSolver
  netlabelTraceOverlapAvoidanceSolver?: NetlabelTraceOverlapAvoidanceSolver
  traceLabelOverlapAvoidanceSolver?: TraceLabelOverlapAvoidanceSolver

  startTimeOfPhase: Record<string, number>
  endTimeOfPhase: Record<string, number>
  timeSpentOnPhase: Record<string, number>
  firstIterationOfPhase: Record<string, number>

  inputProblem: InputProblem

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
          inputTracePaths: this.schematicTraceLinesSolver!.solvedTracePaths,
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
              this.schematicTraceLinesSolver!.solvedTracePaths.map((p) => [
                p.mspPairId,
                p,
              ]),
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
        // Use modified trace map if it exists, otherwise use the original
        const traceMap =
          instance.netlabelTraceOverlapAvoidanceSolver?.getOutput().modifiedTraceMap ??
          instance.traceOverlapShiftSolver?.correctedTraceMap ??
          Object.fromEntries(
            instance.schematicTraceLinesSolver!.solvedTracePaths.map((p) => [
              p.mspPairId,
              p,
            ]),
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
      {
        onSolved: (instance) => {
          if (
            instance.traceLabelOverlapAvoidanceSolver &&
            instance.netLabelPlacementSolver
          ) {
            const { netLabelPlacements } =
              instance.traceLabelOverlapAvoidanceSolver.getOutput()
            instance.netLabelPlacementSolver.netLabelPlacements =
              netLabelPlacements
          }
        },
      },
    ),
  ]

  constructor(inputProblem: InputProblem) {
    super()
    this.inputProblem = this.cloneAndCorrectInputProblem(inputProblem)
    this.MAX_ITERATIONS = 1e6
    this.startTimeOfPhase = {}
    this.endTimeOfPhase = {}
    this.timeSpentOnPhase = {}
    this.firstIterationOfPhase = {}
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicTracePipelineSolver
  >[0] {
    return this.inputProblem
  }

  currentPipelineStepIndex = 0

  private cloneAndCorrectInputProblem(original: InputProblem): InputProblem {
    const cloned: InputProblem = structuredClone({
      ...original,
      _chipObstacleSpatialIndex: undefined,
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
      visualizeInputProblem(this.inputProblem),
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

    if (visualizations.length === 1) return visualizations[0]!

    // Simple combination of visualizations
    return {
      points: visualizations.flatMap((v) => v.points || []),
      rects: visualizations.flatMap((v) => v.rects || []),
      lines: visualizations.flatMap((v) => v.lines || []),
      circles: visualizations.flatMap((v) => v.circles || []),
      texts: visualizations.flatMap((v) => v.texts || []),
    }
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
