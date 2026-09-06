import test from "ava";

test("Wave 10: PCB multi-layer trace via transition cost heuristic", (t) => {
  const baseSegmentCost = 10;
  const viaTransitionCost = 50;

  const calculateRouteCost = (segmentCount: number, viaCount: number) => {
    return (segmentCount * baseSegmentCost) + (viaCount * viaTransitionCost);
  };

  const directCost = calculateRouteCost(5, 0); // 50
  const multiLayerCost = calculateRouteCost(2, 1); // 20 + 50 = 70

  t.true(directCost < multiLayerCost);
  t.is(directCost, 50);
  t.is(multiLayerCost, 70);
});

test("Wave 10: Segment orthogonal routing collision avoidance", (t) => {
  const isOverlapping = (x1: number, x2: number, targetX: number) => {
    const min = Math.min(x1, x2);
    const max = Math.max(x1, x2);
    return targetX >= min && targetX <= max;
  };

  t.true(isOverlapping(0, 10, 5));
  t.false(isOverlapping(0, 10, 15));
});
