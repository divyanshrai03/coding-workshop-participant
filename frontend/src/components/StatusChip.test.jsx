import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusChip from './StatusChip'

const OPTIONS = [
  { value: 'active', label: 'Active', color: 'info' },
  { value: 'completed', label: 'Completed', color: 'success' },
]

describe('StatusChip', () => {
  it('renders the matching label for a known value', () => {
    render(<StatusChip value="completed" options={OPTIONS} />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('falls back to the raw value for an unrecognized option', () => {
    render(<StatusChip value="mystery_status" options={OPTIONS} />)
    expect(screen.getByText('mystery_status')).toBeInTheDocument()
  })
})
