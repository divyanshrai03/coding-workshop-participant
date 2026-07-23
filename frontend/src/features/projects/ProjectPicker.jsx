import { useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import PropTypes from 'prop-types'
import { useProjectsQuery } from './hooks'
import { useDebounce } from '../../hooks/useDebounce'

/** Searchable project picker used by the assignment form on the Resources page. */
export default function ProjectPicker({ label, value = null, onChange, required = false, disabled = false }) {
  const [inputValue, setInputValue] = useState('')
  const debouncedSearch = useDebounce(inputValue, 250)
  const { data, isLoading } = useProjectsQuery({ search: debouncedSearch, page_size: 25 })
  const options = useMemo(() => data?.data ?? [], [data])
  const selected = options.find((option) => option.id === value) ?? null

  return (
    <Autocomplete
      options={options}
      loading={isLoading}
      value={selected}
      disabled={disabled}
      onChange={(_event, option) => onChange(option ? option.id : null)}
      onInputChange={(_event, newInput) => setInputValue(newInput)}
      getOptionLabel={(option) => option.name || ''}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      renderInput={(params) => <TextField {...params} label={label} required={required} />}
    />
  )
}

ProjectPicker.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
}
