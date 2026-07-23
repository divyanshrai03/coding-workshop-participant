import Chip from '@mui/material/Chip'
import PropTypes from 'prop-types'

/** Renders a Chip for a value found in an { value, label, color } options array (see feature constants files). */
export default function StatusChip({ value = undefined, options, size = 'small' }) {
  const option = options.find((candidate) => candidate.value === value) || { label: value, color: 'default' }
  return (
    <Chip
      label={option.label}
      color={option.color}
      size={size}
      variant={option.color === 'default' ? 'outlined' : 'filled'}
    />
  )
}

StatusChip.propTypes = {
  value: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.string, label: PropTypes.string, color: PropTypes.string }),
  ).isRequired,
  size: PropTypes.oneOf(['small', 'medium']),
}
