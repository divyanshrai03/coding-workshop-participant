import { useEffect, useState } from 'react'

/** Delays reflecting `value` until it has stopped changing for `delayMs` - used for search inputs. */
export function useDebounce(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
