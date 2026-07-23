import PropTypes from 'prop-types'
import { useAuth } from '../features/auth/useAuth'

/** Conditionally renders children based on the current user's role rank. See lib/roles.js. */
export default function RoleGuard({ minRole, children, fallback = null }) {
  const { hasMinRole } = useAuth()
  return hasMinRole(minRole) ? children : fallback
}

RoleGuard.propTypes = {
  minRole: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
}
