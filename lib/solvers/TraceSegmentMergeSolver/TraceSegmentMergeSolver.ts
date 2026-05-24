import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentRef {
  trace: SolvedTracePath
  sourceTrace: SolvedTracePath
  segmentIndex: number
  orientation: SegmentOrientation
  fixedCoord: number
  rangeStart: number
  rangeEnd: number
}

interface SegmentCluster {
  segments: SegmentRef[]
  sourceTraces: SolvedTracePath[]
  fixedCoord: number
  changedSegments?: SegmentRef[]
}

interface MergeCandidate {
  aIndex: number
  bIndex: number
  distance: number
}

interface IndexedSegment {
  index: number
  segment: SegmentRef
}

interface ClusterSimulation {
  segments: SegmentRef[]
  changedSegments: SegmentRef[]
  originalSegmentsByTrace: Map<SolvedTracePath, SegmentRef[]>
}

interface SegmentSimulationContext {
  baseSegments: SegmentRef[]
  segmentsBySourceTrace: Map<SolvedTracePath, SegmentRef[]>
  collisionIndex: SegmentCollisionIndex
}

interface SegmentCollisionIndex {
  fixedBuckets: Map<string, SegmentCollisionBucket>
}

interface SegmentCollisionBucket {
  segments: SegmentRef[]
  rangeBuckets?: Map<number, SegmentRef[]>
}

export class TraceSegmentMergeSolver extends BaseSolver {
  inputTracePaths: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  MERGE_DISTANCE = 0.12
  MIN_OVERLAP = 0.02
  EPS = 1e-6
  COLLISION_RANGE_INDEX_THRESHOLD = 32

  constructor(params: { inputTracePaths: SolvedTracePath[] }) {
    super()
    this.inputTracePaths = params.inputTracePaths
    this.outputTraces = params.inputTracePaths.map(cloneTrace)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceSegmentMergeSolver
  >[0] {
    return {
      inputTracePaths: this.inputTracePaths,
    }
  }

  override _step() {
    const clusters = this.findMergeClusters()
    this.applyMergeClusters(clusters)
    this.outputTraces = this.outputTraces.map((trace) => ({
      ...trace,
      tracePath: simplifyPath(trace.tracePath, this.EPS),
    }))
    this.solved = true
  }

  private findMergeClusters(): SegmentCluster[] {
    const segments = this.getSegments()
    const simulationContext = this.createSegmentSimulationContext(segments)
    const clusters = this.buildInitialCollisionFreeClusters(
      segments,
      simulationContext,
    )

    return this.filterGreedyCollisionFreeClusters(clusters, simulationContext)
  }

  private buildInitialCollisionFreeClusters(
    segments: SegmentRef[],
    simulationContext: SegmentSimulationContext,
  ): SegmentCluster[] {
    const disjointSet = new DisjointSet(segments.length)
    const clusterSegments = segments.map((_, index) => new Set([index]))
    const validatedClusterByRoot = new Map<number, SegmentCluster>()
    const candidates = this.getMergeCandidates(segments)

    for (const candidate of candidates) {
      const rootA = disjointSet.find(candidate.aIndex)
      const rootB = disjointSet.find(candidate.bIndex)
      if (rootA === rootB) continue

      const mergedSegmentIndexes = new Set([
        ...clusterSegments[rootA]!,
        ...clusterSegments[rootB]!,
      ])
      const mergedSegments = Array.from(mergedSegmentIndexes).map(
        (segmentIndex) => segments[segmentIndex]!,
      )
      if (!hasUniqueTraceIds(mergedSegments)) continue
      const mergedCluster = this.createCluster(mergedSegments)
      const simulation = this.simulateClusters(
        [mergedCluster],
        simulationContext,
        false,
      )
      if (
        this.changedSegmentsWouldCollideWithOtherNet(
          simulation.changedSegments,
          simulation.segments,
          simulationContext.collisionIndex,
        )
      ) {
        continue
      }

      mergedCluster.changedSegments = simulation.changedSegments
      const mergedRoot = disjointSet.union(rootA, rootB)
      clusterSegments[mergedRoot] = mergedSegmentIndexes
      validatedClusterByRoot.set(mergedRoot, mergedCluster)
    }

    const clustersByRoot = new Map<number, Set<number>>()
    for (let index = 0; index < segments.length; index++) {
      const root = disjointSet.find(index)
      clustersByRoot.set(root, clusterSegments[root]!)
    }

    return Array.from(clustersByRoot)
      .filter(([, clusterIndexes]) => clusterIndexes.size > 1)
      .map(([root, clusterIndexes]) => {
        const cachedCluster = validatedClusterByRoot.get(root)
        if (cachedCluster) return cachedCluster

        return this.createCluster(
          Array.from(clusterIndexes).map(
            (segmentIndex) => segments[segmentIndex]!,
          ),
        )
      })
  }

  private createCluster(segments: SegmentRef[]): SegmentCluster {
    return {
      segments,
      sourceTraces: getUniqueSourceTraces(segments),
      fixedCoord:
        segments.reduce((sum, segment) => sum + segment.fixedCoord, 0) /
        segments.length,
    }
  }

  private filterGreedyCollisionFreeClusters(
    clusters: SegmentCluster[],
    simulationContext: SegmentSimulationContext,
  ): SegmentCluster[] {
    const acceptedClusters: SegmentCluster[] = []
    const acceptedSourceTraces = new Set<SolvedTracePath>()
    let acceptedChangedSegments: SegmentRef[] = []
    let acceptedCollisionIndex = this.createSegmentCollisionIndex(
      acceptedChangedSegments,
    )

    for (const cluster of clusters) {
      const clusterSourceTraces = cluster.sourceTraces
      const sharesAcceptedTrace = clusterSourceTraces.some((sourceTrace) =>
        acceptedSourceTraces.has(sourceTrace),
      )

      if (sharesAcceptedTrace) {
        const candidateClusters = [...acceptedClusters, cluster]
        if (
          this.simulatedClustersWouldCollideWithOtherNet(
            candidateClusters,
            simulationContext,
          )
        ) {
          continue
        }
        acceptedClusters.push(cluster)
        acceptedChangedSegments = this.simulateClusters(
          acceptedClusters,
          simulationContext,
          false,
        ).changedSegments
        acceptedCollisionIndex = this.createSegmentCollisionIndex(
          acceptedChangedSegments,
        )
        for (const sourceTrace of clusterSourceTraces) {
          acceptedSourceTraces.add(sourceTrace)
        }
        continue
      }

      const candidateChangedSegments =
        cluster.changedSegments ??
        this.simulateClusters([cluster], simulationContext, false)
          .changedSegments
      if (
        this.changedSegmentsWouldCollideWithOtherNet(
          candidateChangedSegments,
          acceptedChangedSegments,
          acceptedCollisionIndex,
        )
      ) {
        continue
      }

      acceptedClusters.push(cluster)
      acceptedChangedSegments.push(...candidateChangedSegments)
      for (const segment of candidateChangedSegments) {
        this.addSegmentToCollisionIndex(segment, acceptedCollisionIndex)
      }
      for (const sourceTrace of clusterSourceTraces) {
        acceptedSourceTraces.add(sourceTrace)
      }
    }

    return acceptedClusters
  }

  private getMergeCandidates(segments: SegmentRef[]): MergeCandidate[] {
    const candidates: MergeCandidate[] = []
    const segmentGroups = new Map<string, IndexedSegment[]>()

    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index]!
      const groupKey = `${segment.trace.globalConnNetId}\0${segment.orientation}`
      const segmentGroup = segmentGroups.get(groupKey) ?? []
      segmentGroup.push({ index, segment })
      segmentGroups.set(groupKey, segmentGroup)
    }

    for (const segmentGroup of segmentGroups.values()) {
      segmentGroup.sort((a, b) => {
        if (a.segment.fixedCoord !== b.segment.fixedCoord) {
          return a.segment.fixedCoord - b.segment.fixedCoord
        }
        return a.index - b.index
      })

      for (let i = 0; i < segmentGroup.length; i++) {
        const a = segmentGroup[i]!
        for (let j = i + 1; j < segmentGroup.length; j++) {
          const b = segmentGroup[j]!
          const distance = Math.abs(a.segment.fixedCoord - b.segment.fixedCoord)
          if (distance > this.MERGE_DISTANCE) break
          if (distance < this.EPS) continue
          if (a.segment.trace.mspPairId === b.segment.trace.mspPairId) continue
          if (!this.rangesOverlapEnough(a.segment, b.segment)) continue

          candidates.push({
            aIndex: Math.min(a.index, b.index),
            bIndex: Math.max(a.index, b.index),
            distance,
          })
        }
      }
    }

    return candidates.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance
      if (a.aIndex !== b.aIndex) return a.aIndex - b.aIndex
      return a.bIndex - b.bIndex
    })
  }

  private getSegments(): SegmentRef[] {
    return this.getSegmentsForTraces(this.outputTraces)
  }

  private createSegmentSimulationContext(
    baseSegments: SegmentRef[],
  ): SegmentSimulationContext {
    return {
      baseSegments,
      segmentsBySourceTrace: this.getSegmentsBySourceTrace(baseSegments),
      collisionIndex: this.createSegmentCollisionIndex(baseSegments),
    }
  }

  private getSegmentsBySourceTrace(
    segments: SegmentRef[],
  ): Map<SolvedTracePath, SegmentRef[]> {
    const segmentsBySourceTrace = new Map<SolvedTracePath, SegmentRef[]>()

    for (const segment of segments) {
      const traceSegments = segmentsBySourceTrace.get(segment.sourceTrace) ?? []
      traceSegments.push(segment)
      segmentsBySourceTrace.set(segment.sourceTrace, traceSegments)
    }

    return segmentsBySourceTrace
  }

  private getSegmentsForTraces(
    traces: SolvedTracePath[],
    sourceTraceByTrace = new Map<SolvedTracePath, SolvedTracePath>(),
  ): SegmentRef[] {
    const segments: SegmentRef[] = []

    for (const trace of traces) {
      const sourceTrace = sourceTraceByTrace.get(trace) ?? trace
      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        const start = trace.tracePath[segmentIndex]!
        const end = trace.tracePath[segmentIndex + 1]!
        const orientation = getOrientation(start, end, this.EPS)
        if (!orientation) continue

        if (orientation === "horizontal") {
          segments.push({
            trace,
            sourceTrace,
            segmentIndex,
            orientation,
            fixedCoord: start.y,
            rangeStart: Math.min(start.x, end.x),
            rangeEnd: Math.max(start.x, end.x),
          })
        } else {
          segments.push({
            trace,
            sourceTrace,
            segmentIndex,
            orientation,
            fixedCoord: start.x,
            rangeStart: Math.min(start.y, end.y),
            rangeEnd: Math.max(start.y, end.y),
          })
        }
      }
    }

    return segments
  }

  private rangesOverlapEnough(a: SegmentRef, b: SegmentRef): boolean {
    const overlap =
      Math.min(a.rangeEnd, b.rangeEnd) - Math.max(a.rangeStart, b.rangeStart)
    return overlap >= this.MIN_OVERLAP
  }

  private simulatedClustersWouldCollideWithOtherNet(
    clusters: SegmentCluster[],
    simulationContext = this.createSegmentSimulationContext(this.getSegments()),
  ): boolean {
    const canUseBaseCollisionIndex = clusters.length === 1
    const simulation = this.simulateClusters(
      clusters,
      simulationContext,
      !canUseBaseCollisionIndex,
    )
    const collisionIndex = canUseBaseCollisionIndex
      ? simulationContext.collisionIndex
      : this.createSegmentCollisionIndex(simulation.segments)

    return this.changedSegmentsWouldCollideWithOtherNet(
      simulation.changedSegments,
      simulation.segments,
      collisionIndex,
    )
  }

  private simulateClusters(
    clusters: SegmentCluster[],
    simulationContext: SegmentSimulationContext,
    includeUnchangedSegments: boolean,
  ): ClusterSimulation {
    const affectedSourceTraces = new Set<SolvedTracePath>()
    for (const cluster of clusters) {
      for (const segment of cluster.segments) {
        affectedSourceTraces.add(segment.sourceTrace)
      }
    }

    const simulatedTraces = Array.from(affectedSourceTraces).map(cloneTrace)
    const simulatedTraceBySourceTrace = new Map(
      Array.from(affectedSourceTraces).map((trace, index) => [
        trace,
        simulatedTraces[index]!,
      ]),
    )
    const sourceTraceBySimulatedTrace = new Map(
      Array.from(affectedSourceTraces).map((trace, index) => [
        simulatedTraces[index]!,
        trace,
      ]),
    )
    const originalSegmentsByTrace = new Map<SolvedTracePath, SegmentRef[]>()

    for (const sourceTrace of affectedSourceTraces) {
      originalSegmentsByTrace.set(
        sourceTrace,
        simulationContext.segmentsBySourceTrace.get(sourceTrace) ?? [],
      )
    }

    this.applyMergeClustersToTraces(
      clusters,
      (sourceTrace) => simulatedTraceBySourceTrace.get(sourceTrace)!,
    )

    for (const trace of simulatedTraces) {
      trace.tracePath = simplifyPath(trace.tracePath, this.EPS)
    }

    const simulatedAffectedSegments = this.getSegmentsForTraces(
      simulatedTraces,
      sourceTraceBySimulatedTrace,
    )
    const segments = includeUnchangedSegments
      ? [
          ...simulationContext.baseSegments.filter(
            (segment) => !affectedSourceTraces.has(segment.sourceTrace),
          ),
          ...simulatedAffectedSegments,
        ]
      : simulatedAffectedSegments

    return {
      segments,
      changedSegments: this.getChangedSegments(
        simulatedAffectedSegments,
        originalSegmentsByTrace,
      ),
      originalSegmentsByTrace,
    }
  }

  private getChangedSegments(
    simulatedAffectedSegments: SegmentRef[],
    originalSegmentsByTrace: Map<SolvedTracePath, SegmentRef[]>,
  ): SegmentRef[] {
    const changedSegments: SegmentRef[] = []

    for (const segment of simulatedAffectedSegments) {
      const originalSegments =
        originalSegmentsByTrace.get(segment.sourceTrace) ?? []
      if (
        originalSegments.some((original) =>
          sameSegmentGeometry(original, segment, this.EPS),
        )
      ) {
        continue
      }

      changedSegments.push(segment)
    }

    return changedSegments
  }

  private changedSegmentsWouldCollideWithOtherNet(
    changedSegments: SegmentRef[],
    segments: SegmentRef[],
    collisionIndex = this.createSegmentCollisionIndex(segments),
  ): boolean {
    for (const segment of changedSegments) {
      for (const otherSegment of this.getCollisionCandidates(
        segment,
        collisionIndex,
      )) {
        if (this.segmentsOverlapDifferentNets(segment, otherSegment)) {
          return true
        }
      }
    }

    return false
  }

  private createSegmentCollisionIndex(
    segments: SegmentRef[],
  ): SegmentCollisionIndex {
    const collisionIndex: SegmentCollisionIndex = { fixedBuckets: new Map() }
    for (const segment of segments) {
      this.addSegmentToCollisionIndex(segment, collisionIndex)
    }
    return collisionIndex
  }

  private addSegmentToCollisionIndex(
    segment: SegmentRef,
    collisionIndex: SegmentCollisionIndex,
  ) {
    const fixedBucketId = this.getCollisionFixedBucketId(segment.fixedCoord)
    const bucketKey = this.getCollisionFixedBucketKey(segment, fixedBucketId)
    const bucket = collisionIndex.fixedBuckets.get(bucketKey) ?? {
      segments: [],
    }

    bucket.segments.push(segment)

    if (bucket.rangeBuckets) {
      this.addSegmentToRangeBuckets(segment, bucket.rangeBuckets)
    } else if (bucket.segments.length >= this.COLLISION_RANGE_INDEX_THRESHOLD) {
      bucket.rangeBuckets = this.createCollisionRangeBuckets(bucket.segments)
    }

    collisionIndex.fixedBuckets.set(bucketKey, bucket)
  }

  private getCollisionCandidates(
    segment: SegmentRef,
    collisionIndex: SegmentCollisionIndex,
  ): SegmentRef[] {
    const fixedBucketId = this.getCollisionFixedBucketId(segment.fixedCoord)
    const candidates: SegmentRef[] = []
    let seenCandidates: Set<SegmentRef> | undefined

    for (let fixedOffset = -1; fixedOffset <= 1; fixedOffset++) {
      const bucket = collisionIndex.fixedBuckets.get(
        this.getCollisionFixedBucketKey(segment, fixedBucketId + fixedOffset),
      )
      if (!bucket) continue

      if (!bucket.rangeBuckets) {
        candidates.push(...bucket.segments)
        continue
      }

      const { startBucketId, endBucketId } =
        this.getCollisionRangeBucketIds(segment)
      for (
        let rangeBucketId = startBucketId;
        rangeBucketId <= endBucketId;
        rangeBucketId++
      ) {
        const rangeBucket = bucket.rangeBuckets.get(rangeBucketId)
        if (!rangeBucket) continue
        seenCandidates ??= new Set()

        for (const candidate of rangeBucket) {
          if (seenCandidates.has(candidate)) continue
          seenCandidates.add(candidate)
          candidates.push(candidate)
        }
      }
    }

    return candidates
  }

  private createCollisionRangeBuckets(segments: SegmentRef[]) {
    const rangeBuckets = new Map<number, SegmentRef[]>()
    for (const segment of segments) {
      this.addSegmentToRangeBuckets(segment, rangeBuckets)
    }
    return rangeBuckets
  }

  private addSegmentToRangeBuckets(
    segment: SegmentRef,
    rangeBuckets: Map<number, SegmentRef[]>,
  ) {
    const { startBucketId, endBucketId } =
      this.getCollisionRangeBucketIds(segment)

    for (
      let rangeBucketId = startBucketId;
      rangeBucketId <= endBucketId;
      rangeBucketId++
    ) {
      const bucket = rangeBuckets.get(rangeBucketId) ?? []
      bucket.push(segment)
      rangeBuckets.set(rangeBucketId, bucket)
    }
  }

  private getCollisionFixedBucketKey(
    segment: SegmentRef,
    fixedBucketId: number,
  ) {
    return `${segment.orientation}\0${fixedBucketId}`
  }

  private getCollisionFixedBucketId(fixedCoord: number) {
    return Math.round(fixedCoord / this.EPS)
  }

  private getCollisionRangeBucketIds(segment: SegmentRef) {
    return {
      startBucketId: Math.floor(segment.rangeStart / this.MERGE_DISTANCE),
      endBucketId: Math.floor(segment.rangeEnd / this.MERGE_DISTANCE),
    }
  }

  private segmentsOverlapDifferentNets(
    segment: SegmentRef,
    otherSegment: SegmentRef,
  ): boolean {
    if (segment.sourceTrace === otherSegment.sourceTrace) return false
    if (segment.trace.globalConnNetId === otherSegment.trace.globalConnNetId) {
      return false
    }
    if (segment.orientation !== otherSegment.orientation) return false
    if (Math.abs(segment.fixedCoord - otherSegment.fixedCoord) >= this.EPS) {
      return false
    }

    return this.rangesOverlapEnough(segment, otherSegment)
  }

  private applyMergeClusters(clusters: SegmentCluster[]) {
    this.applyMergeClustersToTraces(clusters, (trace) => trace)
  }

  private applyMergeClustersToTraces(
    clusters: SegmentCluster[],
    resolveTrace: (sourceTrace: SolvedTracePath) => SolvedTracePath,
  ) {
    const mergeTargetByTrace = new Map<
      SolvedTracePath,
      Map<number, SegmentRef>
    >()

    for (const cluster of clusters) {
      for (const segment of cluster.segments) {
        const resolvedTrace = resolveTrace(segment.trace)
        const traceTargets =
          mergeTargetByTrace.get(resolvedTrace) ?? new Map<number, SegmentRef>()
        traceTargets.set(segment.segmentIndex, {
          ...segment,
          trace: resolvedTrace,
          sourceTrace: segment.sourceTrace,
          fixedCoord: cluster.fixedCoord,
        })
        mergeTargetByTrace.set(resolvedTrace, traceTargets)
      }
    }

    for (const [trace, targetMap] of mergeTargetByTrace) {
      const targets = Array.from(targetMap.values()).sort(
        (a, b) => b.segmentIndex - a.segmentIndex,
      )

      for (const target of targets) {
        this.setSegmentFixedCoord(target, target.fixedCoord)
      }
    }
  }

  private setSegmentFixedCoord(segment: SegmentRef, fixedCoord: number) {
    const path = segment.trace.tracePath
    const start = path[segment.segmentIndex]!
    const currentFixedCoord =
      segment.orientation === "horizontal" ? start.y : start.x
    if (Math.abs(currentFixedCoord - fixedCoord) < this.EPS) return

    if (segment.orientation === "horizontal") {
      setHorizontalSegmentY(path, segment.segmentIndex, fixedCoord)
    } else {
      setVerticalSegmentX(path, segment.segmentIndex, fixedCoord)
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.map((trace) => ({
        points: trace.tracePath,
        strokeColor: "purple",
      })),
      points: [],
      rects: [],
      circles: [],
    }
  }
}

const getOrientation = (
  start: Point,
  end: Point,
  epsilon: number,
): SegmentOrientation | null => {
  if (Math.abs(start.y - end.y) < epsilon) return "horizontal"
  if (Math.abs(start.x - end.x) < epsilon) return "vertical"
  return null
}

const simplifyPath = (path: Point[], epsilon: number): Point[] => {
  const withoutDuplicates: Point[] = []

  for (const point of path) {
    const previous = withoutDuplicates[withoutDuplicates.length - 1]
    if (!previous || !samePoint(previous, point, epsilon)) {
      withoutDuplicates.push({ ...point })
    }
  }

  const simplified: Point[] = []
  for (const point of withoutDuplicates) {
    const previous = simplified[simplified.length - 1]
    const beforePrevious = simplified[simplified.length - 2]
    if (
      previous &&
      beforePrevious &&
      getOrientation(beforePrevious, previous, epsilon) &&
      getOrientation(previous, point, epsilon) &&
      getOrientation(beforePrevious, previous, epsilon) ===
        getOrientation(previous, point, epsilon)
    ) {
      simplified[simplified.length - 1] = { ...point }
    } else {
      simplified.push({ ...point })
    }
  }

  return simplified
}

const samePoint = (a: Point, b: Point, epsilon: number) =>
  Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((point) => ({ ...point })),
  mspConnectionPairIds: [...trace.mspConnectionPairIds],
  pinIds: [...trace.pinIds],
})

const hasUniqueTraceIds = (segments: SegmentRef[]) =>
  new Set(segments.map((segment) => segment.trace.mspPairId)).size ===
  segments.length

const getUniqueSourceTraces = (segments: SegmentRef[]) =>
  Array.from(new Set(segments.map((segment) => segment.sourceTrace)))

const sameSegmentGeometry = (a: SegmentRef, b: SegmentRef, epsilon: number) =>
  a.orientation === b.orientation &&
  Math.abs(a.fixedCoord - b.fixedCoord) < epsilon &&
  Math.abs(a.rangeStart - b.rangeStart) < epsilon &&
  Math.abs(a.rangeEnd - b.rangeEnd) < epsilon

const setHorizontalSegmentY = (
  path: Point[],
  segmentIndex: number,
  y: number,
) => {
  const start = path[segmentIndex]!
  const end = path[segmentIndex + 1]!
  const isFirstSegment = segmentIndex === 0
  const isLastSegment = segmentIndex === path.length - 2

  if (isFirstSegment && isLastSegment) {
    path.splice(
      0,
      path.length,
      { ...start },
      { x: start.x, y },
      { x: end.x, y },
      { ...end },
    )
    return
  }

  if (isFirstSegment) {
    end.y = y
    path.splice(segmentIndex + 1, 0, { x: start.x, y })
    return
  }

  if (isLastSegment) {
    start.y = y
    path.splice(segmentIndex + 1, 0, { x: end.x, y })
    return
  }

  start.y = y
  end.y = y
}

const setVerticalSegmentX = (
  path: Point[],
  segmentIndex: number,
  x: number,
) => {
  const start = path[segmentIndex]!
  const end = path[segmentIndex + 1]!
  const isFirstSegment = segmentIndex === 0
  const isLastSegment = segmentIndex === path.length - 2

  if (isFirstSegment && isLastSegment) {
    path.splice(
      0,
      path.length,
      { ...start },
      { x, y: start.y },
      { x, y: end.y },
      { ...end },
    )
    return
  }

  if (isFirstSegment) {
    end.x = x
    path.splice(segmentIndex + 1, 0, { x, y: start.y })
    return
  }

  if (isLastSegment) {
    start.x = x
    path.splice(segmentIndex + 1, 0, { x, y: end.y })
    return
  }

  start.x = x
  end.x = x
}

class DisjointSet {
  private parents: number[]

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index)
  }

  find(index: number): number {
    const parent = this.parents[index]!
    if (parent === index) return index

    const root = this.find(parent)
    this.parents[index] = root
    return root
  }

  union(a: number, b: number): number {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) {
      this.parents[rootB] = rootA
    }
    return rootA
  }
}
