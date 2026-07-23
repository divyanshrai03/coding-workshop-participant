import { useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import PropTypes from 'prop-types'
import { useResourcesQuery } from './hooks'
import { useDebounce } from '../../hooks/useDebounce'

/** Searchable user picker backed by GET /resources - available to every role, unlike auth-service's admin-only /users. */
export default function ResourcePicker({
  label,
  value = null,
  onChange,
  required = false,
  helperText = '',
  disabled = false,
}) {
  const [inputValue, setInputValue] = useState('')
  const debouncedSearch = useDebounce(inputValue, 250)
  const { data, isLoading } = useResourcesQuery({ search: debouncedSearch, page_size: 25 })
  const options = useMemo(() => data?.data ?? [], [data])
  const selected = options.find((option) => option.id === value) ?? null

  return (
    <Autocomplete
      options={options}
      loading={isLoading}
      value={selected}
      disabled={disabled}
      onChange={(_event, option) => onChange(option ? option.id : null)}
      onInputChange={(_event, newInput, reason) => {
        // MUI fires this on every text sync, not just real typing: 'selectOption'
        // when it writes the selected option's label into the input after a pick,
        // 'reset' on blur-close/value-prop sync, 'blur' on losing focus. Treating
        // those like a keystroke re-triggered the debounced search with the full
        // "Name (email)" label, refetching and flickering the list on every
        // selection. Only 'input' is a real keystroke; 'clear' is the (x) button.
        if (reason === 'input') {
          setInputValue(newInput)
        } else if (reason === 'clear') {
          setInputValue('')
        }
      }}
      getOptionLabel={(option) => `${option.full_name} (${option.email})`}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      renderInput={(params) => (
        <TextField {...params} label={label} required={required} helperText={helperText} />
      )}
    />
  )
}

ResourcePicker.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  helperText: PropTypes.string,
  disabled: PropTypes.bool,
}
