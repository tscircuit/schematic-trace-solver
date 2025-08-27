import { useState, useRef, useEffect } from "react"
import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"

interface DownloadDropdownProps {
  solver: BaseSolver
  className?: string
}

export const DownloadDropdown = ({
  solver,
  className = "",
}: DownloadDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const downloadJSON = () => {
    try {
      if (typeof solver.getConstructorParams !== "function") {
        alert(
          `getConstructorParams() is not implemented for ${solver.constructor.name}`,
        )
        return
      }

      const params = solver.getConstructorParams()
      const blob = new Blob([JSON.stringify(params, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${solver.constructor.name}_params.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(
        `Error downloading params for ${solver.constructor.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    setIsOpen(false)
  }

  const downloadPageTsx = () => {
    try {
      const params = solver.getConstructorParams()
      const solverName = solver.constructor.name
      const isSchematicTracePipelineSolver =
        solverName === "SchematicTracePipelineSolver"

      let content: string

      if (isSchematicTracePipelineSolver) {
        content = `import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = ${JSON.stringify(params, null, 2)}

export default () => <PipelineDebugger inputProblem={inputProblem} />
`
      } else {
        content = `import { useMemo } from "react"
import { GenericSolverDebugger } from "../components/GenericSolverDebugger"
import { ${solverName} } from "lib/solvers/${solverName}/${solverName}"

const input = ${JSON.stringify(params, null, 2)}

export default () => {
  const solver = useMemo(() => {
    return new ${solverName}(input as any)
  }, [])
  return <GenericSolverDebugger solver={solver} />
}
`
      }

      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${solverName}.page.tsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(
        `Error generating page.tsx for ${solver.constructor.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    setIsOpen(false)
  }

  const downloadTestTs = () => {
    try {
      const params = solver.getConstructorParams()
      const solverName = solver.constructor.name

      const content = `import { ${solverName} } from "lib/solvers/${solverName}/${solverName}"

test("${solverName} should solve problem correctly", () => {
  const input = ${JSON.stringify(params, null, 2)}
  
  const solver = new ${solverName}(input as any)
  const result = solver.solve()
  
  expect(result).toBeDefined()
  // Add more specific assertions based on expected output
})
`

      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${solverName}.test.ts`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(
        `Error generating test.ts for ${solver.constructor.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        className="px-2 py-1 rounded text-xs cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        title={`Download options for ${solver.constructor.name}`}
      >
        {solver.constructor.name}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 min-w-[150px]">
          <button
            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs"
            onClick={downloadJSON}
          >
            Download JSON
          </button>
          <button
            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs"
            onClick={downloadPageTsx}
          >
            Download page.tsx
          </button>
          <button
            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs"
            onClick={downloadTestTs}
          >
            Download test.ts
          </button>
        </div>
      )}
    </div>
  )
}
