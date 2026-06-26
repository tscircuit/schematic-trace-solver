import React, { useState, useEffect, useRef, useCallback } from "react"
import { createRoot } from "react-dom/client"
import { calculateElbow, type ElbowPoint } from "../lib"

const SVG_WIDTH = 600
const SVG_HEIGHT = 400
const POINT_RADIUS = 8
const ARROW_LENGTH = 20
const GRID_SIZE = 50
const OVERSHOOT_AMOUNT = 50

type FacingDirectionOption = ElbowPoint["facingDirection"] | "none"

const STORAGE_KEY = "elbow-points"

const loadPointsFromStorage = (): {
  point1: ElbowPoint
  point2: ElbowPoint
} | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.warn("Failed to load points from localStorage:", error)
  }
  return null
}

const savePointsToStorage = (point1: ElbowPoint, point2: ElbowPoint) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ point1, point2 }))
  } catch (error) {
    console.warn("Failed to save points to localStorage:", error)
  }
}

const clearPointsFromStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn("Failed to clear points from localStorage:", error)
  }
}

const App: React.FC = () => {
  const storedPoints = loadPointsFromStorage()

  const [point1, setPoint1] = useState<ElbowPoint>(
    storedPoints?.point1 || {
      x: 100,
      y: 100,
      facingDirection: "x+",
    },
  )
  const [point2, setPoint2] = useState<ElbowPoint>(
    storedPoints?.point2 || {
      x: 300,
      y: 200,
      facingDirection: "y-",
    },
  )
  const [calculatedElbowPath, setCalculatedElbowPath] = useState<
    Array<{ x: number; y: number }>
  >([])
  const [userLoadedPath, setUserLoadedPath] = useState<Array<{
    x: number
    y: number
  }> | null>(null)
  const [draggingPoint, setDraggingPoint] = useState<
    "point1" | "point2" | null
  >(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [sceneJsonInput, setSceneJsonInput] = useState("")
  const [pathJsonForTextarea, setPathJsonForTextarea] = useState<string>("")

  const clearStoredPoints = useCallback(() => {
    clearPointsFromStorage()
    setPoint1({
      x: 100,
      y: 100,
      facingDirection: "x+",
    })
    setPoint2({
      x: 300,
      y: 200,
      facingDirection: "y-",
    })
  }, [])

  useEffect(() => {
    // If point1 or point2 changes, it means user interacted, so clear any loaded path override.
    setUserLoadedPath(null)

    const p1ToUse = { ...point1 }
    const p2ToUse = { ...point2 }
    const newCalculatedPath = calculateElbow(p1ToUse, p2ToUse, {
      overshoot: OVERSHOOT_AMOUNT,
    })
    setCalculatedElbowPath(newCalculatedPath)

    // Update scene JSON input when points change
    setSceneJsonInput(
      JSON.stringify(
        {
          point1: {
            x: point1.x,
            y: point1.y,
            facingDirection: point1.facingDirection,
          },
          point2: {
            x: point2.x,
            y: point2.y,
            facingDirection: point2.facingDirection,
          },
        },
        null,
        2,
      ),
    )
  }, [point1, point2])

  // Determine the path to display in SVG and to use for the output textarea
  const finalDisplayPath = userLoadedPath || calculatedElbowPath

  // Effect to update the path JSON in the textarea whenever finalDisplayPath changes
  useEffect(() => {
    setPathJsonForTextarea(JSON.stringify(finalDisplayPath, null, 2))
  }, [finalDisplayPath])

  const getSVGCoordinates = (
    event: React.MouseEvent,
  ): { x: number; y: number } => {
    if (svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect()
      return {
        x: event.clientX - svgRect.left,
        y: SVG_HEIGHT - (event.clientY - svgRect.top), // Invert Y for Cartesian
      }
    }
    return { x: 0, y: 0 }
  }

  const handleMouseDown = (
    pointId: "point1" | "point2",
    event: React.MouseEvent,
  ) => {
    event.preventDefault()
    setDraggingPoint(pointId)
  }

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingPoint || !svgRef.current) return
      let { x, y } = getSVGCoordinates(event as unknown as React.MouseEvent) // Cast needed for global MouseEvent

      // Snap to grid
      x = Math.round(x / GRID_SIZE) * GRID_SIZE
      y = Math.round(y / GRID_SIZE) * GRID_SIZE

      // Ensure points stay within SVG bounds (optional, but good practice with snapping)
      x = Math.max(POINT_RADIUS, Math.min(SVG_WIDTH - POINT_RADIUS, x))
      y = Math.max(POINT_RADIUS, Math.min(SVG_HEIGHT - POINT_RADIUS, y))

      const updateFn = draggingPoint === "point1" ? setPoint1 : setPoint2
      updateFn((prevPoint) => ({ ...prevPoint, x, y }))
    },
    [draggingPoint],
  )

  const handleMouseUp = useCallback(() => {
    setDraggingPoint(null)
  }, [])

  useEffect(() => {
    if (draggingPoint) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    } else {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [draggingPoint, handleMouseMove, handleMouseUp])

  const handleDirectionChange = (
    pointId: "point1" | "point2",
    direction: FacingDirectionOption,
  ) => {
    const updateFn = pointId === "point1" ? setPoint1 : setPoint2
    updateFn((prevPoint) => ({
      ...prevPoint,
      facingDirection: direction === "none" ? undefined : direction,
    }))
  }

  const handleLoadScene = () => {
    try {
      // IMPORTANT: Using eval can be a security risk if the input is from an untrusted source.
      // Here, we assume the user is pasting their own, known object literals.
      // Wrap with parentheses to ensure it's evaluated as an expression.
      const parsedScene = eval(`(${sceneJsonInput})`)

      if (
        parsedScene &&
        parsedScene.point1 &&
        typeof parsedScene.point1.x === "number" &&
        typeof parsedScene.point1.y === "number" &&
        parsedScene.point2 &&
        typeof parsedScene.point2.x === "number" &&
        typeof parsedScene.point2.y === "number"
      ) {
        const newPoint1: ElbowPoint = {
          x: parsedScene.point1.x,
          y: parsedScene.point1.y,
          facingDirection: parsedScene.point1.facingDirection || undefined,
        }
        const newPoint2: ElbowPoint = {
          x: parsedScene.point2.x,
          y: parsedScene.point2.y,
          facingDirection: parsedScene.point2.facingDirection || undefined,
        }

        // Basic validation for facingDirection if present
        const validDirections: Array<
          ElbowPoint["facingDirection"] | undefined
        > = ["x+", "x-", "y+", "y-", undefined]
        if (!validDirections.includes(newPoint1.facingDirection)) {
          alert(
            "Invalid facingDirection for point1. Allowed values: x+, x-, y+, y- or empty.",
          )
          return
        }
        if (!validDirections.includes(newPoint2.facingDirection)) {
          alert(
            "Invalid facingDirection for point2. Allowed values: x+, x-, y+, y- or empty.",
          )
          return
        }

        setPoint1(newPoint1)
        setPoint2(newPoint2)
      } else {
        alert(
          "Invalid JSON structure. Expected { point1: {x, y, facingDirection?}, point2: {x, y, facingDirection?} }",
        )
      }
    } catch (error) {
      alert("Error parsing JSON: " + (error as Error).message)
    }
  }

  const handleLoadPathFromJson = () => {
    try {
      // IMPORTANT: Using eval can be a security risk if the input is from an untrusted source.
      // Here, we assume the user is pasting their own, known object literals.
      // Wrap with parentheses to ensure it's evaluated as an expression.
      const parsedPath = eval(`(${pathJsonForTextarea})`)

      if (
        Array.isArray(parsedPath) &&
        parsedPath.every(
          (p) =>
            typeof p === "object" &&
            p !== null &&
            typeof p.x === "number" &&
            typeof p.y === "number",
        )
      ) {
        setUserLoadedPath(parsedPath)
      } else {
        alert(
          "Invalid path JSON structure. Expected an array of objects with x and y properties (e.g., [{x:0,y:0},{x:10,y:10}]).",
        )
      }
    } catch (error) {
      alert("Error parsing path JSON: " + (error as Error).message)
    }
  }

  const renderArrow = (point: ElbowPoint) => {
    if (!point.facingDirection) return null
    let x2 = point.x
    let y2 = point.y
    switch (point.facingDirection) {
      case "x+":
        x2 += ARROW_LENGTH
        break
      case "x-":
        x2 -= ARROW_LENGTH
        break
      case "y+":
        y2 += ARROW_LENGTH
        break
      case "y-":
        y2 -= ARROW_LENGTH
        break
    }
    return (
      <line
        x1={point.x}
        y1={point.y}
        x2={x2}
        y2={y2}
        stroke="blue"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
    )
  }

  const directionOptions: FacingDirectionOption[] = [
    "none",
    "x+",
    "x-",
    "y+",
    "y-",
  ]

  return (
    <div>
      <div className="controls">
        <div className="control-group">
          <label htmlFor="p1-direction">Point 1 Direction:</label>
          <select
            id="p1-direction"
            value={point1.facingDirection || "none"}
            onChange={(e) =>
              handleDirectionChange(
                "point1",
                (e.target as HTMLSelectElement).value as FacingDirectionOption,
              )
            }
          >
            {directionOptions.map((dir) => (
              <option key={dir} value={dir}>
                {dir}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="p2-direction">Point 2 Direction:</label>
          <select
            id="p2-direction"
            value={point2.facingDirection || "none"}
            onChange={(e) =>
              handleDirectionChange(
                "point2",
                (e.target as HTMLSelectElement).value as FacingDirectionOption,
              )
            }
          >
            {directionOptions.map((dir) => (
              <option key={dir} value={dir}>
                {dir}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          case: {globalThis.__DEBUG_CALCULATE_ELBOW_CASE}
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={clearStoredPoints}>Clear</button>
            <button onClick={() => savePointsToStorage(point1, point2)}>
              Save
            </button>
          </div>
        </div>
      </div>

      <svg ref={svgRef} width={SVG_WIDTH} height={SVG_HEIGHT}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="0"
            refY="3.5"
            orient="auto"
            preserveAspectRatio="none"
          >
            {/* preserveAspectRatio="none" might be needed if marker scales unexpectedly due to parent transform */}
            <polygon points="0 0, 10 3.5, 0 7" fill="blue" />
          </marker>
        </defs>
        {/* Apply Cartesian coordinate system transform */}
        <g transform={`translate(0, ${SVG_HEIGHT}) scale(1, -1)`}>
          {/* Grid Lines */}
          {Array.from({ length: Math.floor(SVG_WIDTH / GRID_SIZE) - 1 }).map(
            (_, i) => (
              <line
                key={`v-line-${i}`}
                x1={(i + 1) * GRID_SIZE}
                y1="0"
                x2={(i + 1) * GRID_SIZE}
                y2={SVG_HEIGHT}
                stroke="#e0e0e0" // Faded gray
                strokeWidth="1"
              />
            ),
          )}
          {Array.from({ length: Math.floor(SVG_HEIGHT / GRID_SIZE) - 1 }).map(
            (_, i) => (
              <line
                key={`h-line-${i}`}
                x1="0"
                y1={(i + 1) * GRID_SIZE}
                x2={SVG_WIDTH}
                y2={(i + 1) * GRID_SIZE}
                stroke="#e0e0e0" // Faded gray
                strokeWidth="1"
              />
            ),
          )}

          {/* Path */}
          {finalDisplayPath.length > 1 && (
            <polyline
              points={finalDisplayPath.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="black"
              strokeWidth="2"
            />
          )}

          {/* Points */}
          {[point1, point2].map((p, index) => (
            <g key={index}>
              <circle
                cx={p.x}
                cy={p.y}
                r={POINT_RADIUS}
                fill={
                  draggingPoint === (index === 0 ? "point1" : "point2")
                    ? "red"
                    : "orange"
                }
                onMouseDown={(e) =>
                  handleMouseDown(index === 0 ? "point1" : "point2", e)
                }
                style={{ cursor: "grab" }}
                // Vector-effect non-scaling-stroke might be useful if stroke width is affected by scale
                // vectorEffect="non-scaling-stroke"
              />
              {renderArrow(p)}
            </g>
          ))}
        </g>
      </svg>

      <div
        style={{ marginTop: "20px", width: "100%", maxWidth: `${SVG_WIDTH}px` }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "5px",
          }}
        >
          <label htmlFor="scene-json" style={{ fontWeight: "bold" }}>
            Scene JSON:
          </label>
          <button onClick={handleLoadScene} style={{ padding: "3px 8px" }}>
            Load
          </button>
        </div>
        <textarea
          id="scene-json"
          value={sceneJsonInput}
          onChange={(e) =>
            setSceneJsonInput((e.target as HTMLTextAreaElement).value)
          }
          style={{
            width: "100%",
            height: "150px",
            fontFamily: "monospace",
            fontSize: "12px",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div
        style={{ marginTop: "20px", width: "100%", maxWidth: `${SVG_WIDTH}px` }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "5px",
          }}
        >
          <label htmlFor="path-output" style={{ fontWeight: "bold" }}>
            Elbow Path Output:
          </label>
          <button
            onClick={handleLoadPathFromJson}
            style={{ padding: "3px 8px" }}
          >
            Load
          </button>
        </div>
        <textarea
          id="path-output"
          value={pathJsonForTextarea}
          onChange={(e) =>
            setPathJsonForTextarea((e.target as HTMLTextAreaElement).value)
          }
          style={{
            width: "100%",
            height: "150px",
            fontFamily: "monospace",
            fontSize: "12px",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  )
}

const container = document.getElementById("root")
if (container) {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
