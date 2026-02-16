import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type {
  InputProblem,
  InputPin,
  PinId,
  InputChip,
} from "lib/types/InputProblem"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import { SchematicTraceSingleLineSolver2 } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import { doesTraceOverlapWithExistingTraces } from "lib/utils/does-trace-overlap-with-existing-traces"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { ConnectivityMap } from "connectivity-map"

const NEAREST_NEIGHBOR_COUNT = 3

const distance = (p1: InputPin, p2: InputPin) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
}

export class LongDistancePairSolver extends BaseSolver {
  public solvedLongDistanceTraces: SolvedTracePath[] = []
  private queuedCandidatePairs: Array<
    [InputPin & { chipId: string }, InputPin & { chipId: string }]
  > = []
  private currentCandidatePair:
    | [InputPin & { chipId: string }, InputPin & { chipId: string }]
    | null = null
  private subSolver: SchematicTraceSingleLineSolver2 | null = null
  private chipMap: Record<string, InputChip> = {}
  private inputProblem: InputProblem
  private netConnMap: ConnectivityMap
  private newlyConnectedPinIds = new Set<PinId>()
  private allSolvedTraces: SolvedTracePath[] = []

  constructor(
    private params: {
      inputProblem: InputProblem
      alreadySolvedTraces: SolvedTracePath[]
      mergeThreshold: number
    },
  ) {
    super();
    this.inputProblem = params.inputProblem;
    this.netConnMap = getConnectivityMapsFromInputProblem(this.inputProblem);
    this.mergeThreshold = params.mergeThreshold;
  }

  private shouldMerge(trace1: SolvedTracePath, trace2: SolvedTracePath): boolean {
    const dist = distance(trace1.path[0], trace2.path[trace2.path.length - 1]);
    return dist < this.mergeThreshold;
  }

  public solve(): void {
    // Your existing solve logic here
  }
}