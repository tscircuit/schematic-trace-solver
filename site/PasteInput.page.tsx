import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import { useEffect, useState } from "react"

export default () => {
  const [inputText, setInputText] = useState("")
  const [inputProblem, setInputProblem] = useState<InputProblem | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const existing = params.get("input")
    if (existing) setInputText(existing)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (inputText.trim()) {
      params.set("input", inputText)
    } else {
      params.delete("input")
    }
    const newQuery = params.toString()
    const newUrl = newQuery
      ? `${window.location.pathname}?${newQuery}`
      : window.location.pathname
    window.history.replaceState(null, "", newUrl)
  }, [inputText])

  const handleOpenDebugger = () => {
    try {
      setError(null)
      let parsed: InputProblem

      const trimmedInput = inputText.trim()
      if (trimmedInput.startsWith("{") || trimmedInput.startsWith("[")) {
        parsed = JSON.parse(trimmedInput)
      } else {
        parsed = eval(`(${trimmedInput})`)
      }

      setInputProblem(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid input format")
    }
  }

  if (inputProblem) {
    return <PipelineDebugger inputProblem={inputProblem} />
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Paste Input Problem</h1>
      <p>Paste a JSON or JavaScript object representing an InputProblem:</p>

      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Paste your InputProblem here..."
        style={{
          width: "100%",
          height: "400px",
          fontFamily: "monospace",
          padding: "10px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          marginBottom: "10px",
        }}
      />

      {error && (
        <div
          style={{
            color: "red",
            marginBottom: "10px",
            padding: "10px",
            backgroundColor: "#fee",
            borderRadius: "4px",
          }}
        >
          Error: {error}
        </div>
      )}

      <button
        onClick={handleOpenDebugger}
        disabled={!inputText.trim()}
        style={{
          padding: "10px 20px",
          backgroundColor: inputText.trim() ? "#007bff" : "#ccc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: inputText.trim() ? "pointer" : "not-allowed",
          fontSize: "16px",
        }}
      >
        Open Debugger
      </button>
    </div>
  )
}
