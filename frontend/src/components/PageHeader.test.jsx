import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PageHeader from './PageHeader'

describe('PageHeader', () => {
  it('renders the title and optional description', () => {
    render(<PageHeader title="Projects" description="Track every project in one place." />)

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
    expect(screen.getByText('Track every project in one place.')).toBeInTheDocument()
  })

  it('renders action content when provided', () => {
    render(<PageHeader title="Projects" actions={<button type="button">New Project</button>} />)

    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
  })
})
