const stringifyError = (value) => {
  if (!value) return null
  if (typeof value === "string") return value
  if (typeof value.message === "string") return value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const extractBodyMessage = (body) => {
  if (!body) return null
  if (typeof body === "string") return body
  return (
    stringifyError(body.error) ||
    stringifyError(body.message) ||
    stringifyError(body.reason) ||
    stringifyError(body)
  )
}

export async function getFunctionErrorMessage(error, data) {
  const dataMessage = extractBodyMessage(data)
  if (dataMessage) return dataMessage

  const response = error?.context
  if (response) {
    if (typeof response.clone === "function") {
      try {
        const body = await response.clone().json()
        const message = extractBodyMessage(body)
        if (message) return message
      } catch {
        // Fall through to text response handling.
      }
    }

    try {
      const text = await response.text()
      if (text) return text
    } catch {
      // Fall through to the Supabase error object.
    }
  }

  return stringifyError(error) || "Unknown edge function error"
}

export async function throwFunctionError(error, data) {
  throw new Error(await getFunctionErrorMessage(error, data))
}
