import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useMediaQuery } from 'react-responsive'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined'
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined'
import { useAuth } from '../features/auth/useAuth'
import { useThemeMode } from '../theme/useThemeMode'
import { roleLabel } from '../lib/roles'

const DRAWER_WIDTH = 248
const RAIL_WIDTH = 76

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: SpaceDashboardOutlinedIcon },
  { label: 'Projects', to: '/projects', icon: FolderOutlinedIcon },
  { label: 'Resources', to: '/resources', icon: GroupsOutlinedIcon },
  { label: 'Budgets', to: '/budgets', icon: PaidOutlinedIcon },
]

export default function AppLayout() {
  // Matches theme breakpoints (sm=600, md=900): mobile <600 gets a slide-out
  // drawer, tablet 600-899 gets a persistent-but-collapsible icon rail,
  // desktop 900+ gets the full permanent sidebar.
  const isMobile = useMediaQuery({ maxWidth: 599 })
  const isTablet = useMediaQuery({ minWidth: 600, maxWidth: 899 })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tabletExpanded, setTabletExpanded] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState(null)
  const { user, logout } = useAuth()
  const { resolvedMode, toggleMode } = useThemeMode()
  const navigate = useNavigate()

  const collapsed = isTablet && !tabletExpanded
  const drawerWidth = isTablet ? (tabletExpanded ? DRAWER_WIDTH : RAIL_WIDTH) : DRAWER_WIDTH

  const handleLogout = () => {
    setMenuAnchor(null)
    logout()
    navigate('/login', { replace: true })
  }

  const navList = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: collapsed ? 2 : 3, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        {!collapsed && (
          <Typography variant="h6" fontWeight={700} noWrap>
            ACME Projects
          </Typography>
        )}
      </Toolbar>
      <List sx={{ px: collapsed ? 1 : 1.5, flex: 1 }}>
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => {
          const item = (
            <ListItemButton
              key={to}
              component={NavLink}
              to={to}
              onClick={() => isMobile && setMobileOpen(false)}
              sx={{
                mb: 0.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1.5 : 2,
                '&.active': { bgcolor: 'action.selected', color: 'primary.main' },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36 }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              {/* Text stays in the DOM (not conditionally unmounted) at every
                  breakpoint so the link's accessible name never depends on
                  viewport width - only visually clipped when collapsed. */}
              <ListItemText
                primary={label}
                sx={
                  collapsed
                    ? { width: 0, overflow: 'hidden', whiteSpace: 'nowrap', opacity: 0, ml: 0 }
                    : undefined
                }
              />
            </ListItemButton>
          )
          return collapsed ? (
            <Tooltip key={to} title={label} placement="right">
              {item}
            </Tooltip>
          ) : (
            item
          )
        })}
      </List>
      {isTablet && (
        <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Tooltip title={tabletExpanded ? 'Collapse sidebar' : 'Expand sidebar'} placement="right">
            <IconButton
              onClick={() => setTabletExpanded((prev) => !prev)}
              aria-label={tabletExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              sx={{ width: '100%', borderRadius: 2 }}
            >
              {tabletExpanded ? <ChevronLeftOutlinedIcon fontSize="small" /> : <ChevronRightOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Constrained to start after the sidebar (standard MUI permanent-drawer
          recipe) so it doesn't overlap - and hide - the sidebar's own logo. */}
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: isMobile ? '100%' : `calc(100% - ${drawerWidth}px)`,
          ml: isMobile ? 0 : `${drawerWidth}px`,
          transition: (theme) => theme.transitions.create(['width', 'margin']),
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Tooltip title={resolvedMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton onClick={toggleMode} aria-label="Toggle color mode">
                {resolvedMode === 'dark' ? (
                  <LightModeOutlinedIcon fontSize="small" />
                ) : (
                  <DarkModeOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <IconButton
              onClick={(event) => setMenuAnchor(event.currentTarget)}
              sx={{ ml: 0.5 }}
              aria-label="Account menu"
            >
              <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                {user?.full_name?.[0]?.toUpperCase() || '?'}
              </Avatar>
            </IconButton>
          </Stack>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9375rem' }}>
                {user?.full_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
              <Box sx={{ mt: 0.75 }}>
                <Chip label={roleLabel(user?.role)} size="small" />
              </Box>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutOutlinedIcon fontSize="small" />
              </ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {navList}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            transition: (theme) => theme.transitions.create('width'),
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderColor: 'divider',
              overflowX: 'hidden',
              transition: (theme) => theme.transitions.create('width'),
            },
          }}
          open
        >
          {navList}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 4 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}
