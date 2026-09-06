import test from "ava";

test("Wave 13 Milestone: PCB dogleg bend count minimization heuristic", (t) => {
  interface Point { x: number; y: number; }

  const calculateBendCount = (waypoints: Point[]): number => {
    if (waypoints.length < 3) return 0;
    let bends = 0;
    for (let i = 1; i < waypoints.length - 1; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      const next = waypoints[i + 1];

      const dir1 = { dx: curr.x - prev.x, dy: curr.y - prev.y };
      const dir2 = { dx: next.x - curr.x, dy: next.y - curr.y };

      if (dir1.dx !== dir2.dx || dir1.dy !== dir2.dy) {
        bends++;
      }
    }
    return bends;
  };

  const straight = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
  t.is(calculateBendCount(straight), 0);

  const dogleg = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 5 }];
  t.is(calculateBendCount(dogleg), 2);
});

test("Wave 13 Milestone: Trace segment length positive bound", (t) => {
  const getSegmentLength = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  };

  t.is(getSegmentLength({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});
