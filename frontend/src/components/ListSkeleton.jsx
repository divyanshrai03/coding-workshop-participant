import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import PropTypes from 'prop-types'

/** Row-shaped loading placeholder shown while a list query is in flight. */
export default function ListSkeleton({ rows = 5, height = 64 }) {
  return (
    <Stack spacing={1.5}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} variant="rounded" height={height} />
      ))}
    </Stack>
  )
}

ListSkeleton.propTypes = {
  rows: PropTypes.number,
  height: PropTypes.number,
}
