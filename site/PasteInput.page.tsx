import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import { useState } from "

export default () => {
  const [inputText, setInputText] = useState("")
  const [inputProblem, setInputProblem] = useState<InputProblem | null>(null)
  const [error, setError] = useState<string | null>(null)

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


