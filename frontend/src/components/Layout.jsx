import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Typography,
  Button,
  IconButton,
  Divider,
  useMediaQuery,
  useTheme,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  CalendarToday as CalendarIcon,
  Settings as SettingsIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonChecked as LiveIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Event as EventIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  ExpandLess,
  ExpandMore,
  People as PeopleIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  AssignmentInd as BadgeIcon,
} from '@mui/icons-material'
import { styled } from '@mui/material/styles'

const drawerWidth = 280

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    borderRight: '1px solid rgba(226, 232, 240, 0.8)',
  },
}))

const LogoBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  textDecoration: 'none',
  color: 'inherit',
  transition: 'transform 0.3s ease',
  '&:hover': {
    transform: 'scale(1.02)',
  },
}))

const LogoIcon = styled(Box)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: 12,
  background: 'linear-gradient(135deg, #1a56db 0%, #6366f1 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontWeight: 700,
  fontSize: '1.25rem',
  boxShadow: '0 4px 12px rgba(26, 86, 219, 0.3)',
  transition: 'transform 0.3s ease',
  '&:hover': {
    transform: 'scale(1.1)',
  },
}))

const NavItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== 'active',
})(({ theme, active }) => ({
  borderRadius: 12,
  margin: theme.spacing(0.5, 1),
  minHeight: 44,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  ...(active && {
    background: 'linear-gradient(135deg, #1a56db 0%, #1e40af 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(26, 86, 219, 0.3)',
    '&:hover': {
      background: 'linear-gradient(135deg, #2563eb 0%, #1a56db 100%)',
      transform: 'translateX(4px)',
    },
  }),
  ...(!active && {
    color: theme.palette.text.primary,
    '&:hover': {
      backgroundColor: 'rgba(26, 86, 219, 0.08)',
      transform: 'translateX(4px)',
      color: theme.palette.primary.main,
    },
  }),
}))

const GroupHeaderButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'active',
})(({ theme, active }) => ({
  width: '100%',
  justifyContent: 'space-between',
  padding: theme.spacing(1.25, 2),
  margin: theme.spacing(0.5, 1),
  minHeight: 44,
  borderRadius: 12,
  textTransform: 'none',
  fontWeight: 600,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  ...(active && {
    backgroundColor: 'rgba(26, 86, 219, 0.1)',
    color: theme.palette.primary.main,
  }),
  '&:hover': {
    backgroundColor: 'rgba(26, 86, 219, 0.12)',
    transform: 'translateX(2px)',
  },
}))

const MainContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  transition: 'all 0.3s ease',
  width: '100%',
  [theme.breakpoints.up('md')]: {
    marginLeft: `${drawerWidth}px`,
    width: `calc(100% - ${drawerWidth}px)`,
  },
}))

const ContentBox = styled(Box)(({ theme }) => ({
  flex: 1,
  width: '100%',
  padding: theme.spacing(3, 2),
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(4, 3),
  },
  [theme.breakpoints.up('lg')]: {
    padding: theme.spacing(5, 4),
    maxWidth: '1400px',
    margin: '0 auto',
  },
}))

const iconMap = {
  '📊': DashboardIcon,
  '📅': CalendarIcon,
  '⚙️': SettingsIcon,
  '📋': AssignmentIcon,
  '✅': CheckCircleIcon,
  '🟢': LiveIcon,
  '📈': AnalyticsIcon,
  '📝': HistoryIcon,
  '📆': EventIcon,
  '👥': PeopleIcon,
}

const Layout = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({
    'Planning & Setup': true,
    'Monitoring': true,
    'Archive & Reports': true,
  })
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'
  const isHOD = user?.role === 'hod'

  const adminNavGroups = [
    {
      items: [{ path: '/admin', label: 'Dashboard', icon: '📊' }],
    },
    {
      title: 'Planning & Setup',
      items: [
        { path: '/admin/schedule', label: 'Schedule', icon: '📅' },
        { path: '/admin/manage', label: 'Manage', icon: '⚙️' },
        { path: '/admin/timetable', label: 'Exam Timetable', icon: '📋' },
      ],
    },
    {
      title: 'Monitoring',
      items: [
        { path: '/admin/acknowledgments', label: 'Acknowledgments', icon: '✅' },
        { path: '/admin/live-status', label: 'Live Status', icon: '🟢' },
        { path: '/admin/analytics', label: 'Analytics', icon: '📈' },
      ],
    },
    {
      title: 'Archive & Reports',
      items: [
        { path: '/admin/allocation-logs', label: 'Allocation Logs', icon: '📝' },
        { path: '/admin/calendar', label: 'Calendar', icon: '📆' },
      ],
    },
  ]

  const hodNavItems = [
    { path: '/hod', label: 'Dashboard', icon: '📊' },
    { path: '/hod/schedule', label: 'Schedule', icon: '📅' },
    { path: '/hod/faculty', label: 'Faculty', icon: '👥' },
  ]

  const facultyNavItems = [
    { path: '/faculty', label: 'Dashboard', icon: '📊' },
    { path: '/faculty/duties', label: 'My Duties', icon: '📅' },
    { path: '/faculty/calendar', label: 'Calendar', icon: '📆' },
    { path: '/faculty/analytics', label: 'Analytics', icon: '📈' },
  ]

  const navItems = isAdmin ? adminNavGroups.flatMap((group) => group.items) : isHOD ? hodNavItems : facultyNavItems
  const homePath = isAdmin ? '/admin' : isHOD ? '/hod' : '/faculty'

  const getIcon = (iconEmoji) => {
    const IconComponent = iconMap[iconEmoji] || DashboardIcon
    return <IconComponent />
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <LogoBox component={Link} to={homePath}>
        <LogoIcon>S</LogoIcon>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #1a56db 0%, #6366f1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Schedulo
        </Typography>
      </LogoBox>

      <Divider />

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {isAdmin ? (
          <List sx={{ px: 1 }}>
            {adminNavGroups.map((group, groupIndex) => {
              const isExpanded = !group.title || expandedGroups[group.title]
              const hasActiveItem = group.items.some((item) => location.pathname === item.path)

              return (
                <Box key={groupIndex}>
                  {group.title ? (
                    <>
                      <GroupHeaderButton
                        active={hasActiveItem}
                        onClick={() => {
                          setExpandedGroups((prev) => ({
                            ...prev,
                            [group.title]: !prev[group.title],
                          }))
                        }}
                        endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getIcon(group.title.includes('Planning') ? '📋' : group.title.includes('Monitoring') ? '📊' : '📚')}
                          <Typography variant="body2" fontWeight={600}>
                            {group.title}
                          </Typography>
                        </Box>
                      </GroupHeaderButton>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                          {group.items.map((item) => {
                            const Icon = iconMap[item.icon] || DashboardIcon
                            const isActive = location.pathname === item.path
                            return (
                              <ListItem key={item.path} disablePadding>
                                <NavItemButton
                                  component={Link}
                                  to={item.path}
                                  onClick={() => setMobileMenuOpen(false)}
                                  active={isActive}
                                  sx={{ pl: 4 }}
                                >
                                  <ListItemIcon sx={{ minWidth: 40, color: isActive ? 'inherit' : 'inherit' }}>
                                    <Icon />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={item.label}
                                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                                  />
                                </NavItemButton>
                              </ListItem>
                            )
                          })}
                        </List>
                      </Collapse>
                    </>
                  ) : (
                    group.items.map((item) => {
                      const Icon = iconMap[item.icon] || DashboardIcon
                      const isActive = location.pathname === item.path
                      return (
                        <ListItem key={item.path} disablePadding>
                          <NavItemButton
                            component={Link}
                            to={item.path}
                            onClick={() => setMobileMenuOpen(false)}
                            active={isActive}
                          >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                              <Icon />
                            </ListItemIcon>
                            <ListItemText
                              primary={item.label}
                              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                            />
                          </NavItemButton>
                        </ListItem>
                      )
                    })
                  )}
                </Box>
              )
            })}
          </List>
        ) : (
          <List sx={{ px: 1 }}>
            {navItems.map((item) => {
              const Icon = iconMap[item.icon] || DashboardIcon
              const isActive = location.pathname === item.path
              return (
                <ListItem key={item.path} disablePadding>
                  <NavItemButton component={Link} to={item.path} onClick={() => setMobileMenuOpen(false)} active={isActive}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Icon />
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </NavItemButton>
                </ListItem>
              )
            })}
          </List>
        )}
      </Box>

      <Divider />

      {/* User Info & Logout */}
      {/* User Info & Logout */}
      <Box sx={{ p: 1.5 }}>
        <Box
          onClick={() => setProfileOpen(true)}
          sx={{
            mb: 2,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            cursor: 'pointer',
            borderRadius: 3,
            border: '1px solid transparent',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: 'rgba(26, 86, 219, 0.04)',
              borderColor: 'rgba(26, 86, 219, 0.1)',
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'primary.main',
              background: 'linear-gradient(135deg, #1a56db 0%, #6366f1 100%)',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(26, 86, 219, 0.25)',
              fontSize: '1rem'
            }}
          >
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" fontWeight={700} noWrap color="text.primary" sx={{ fontSize: '0.8125rem' }}>
              {user?.name || 'User'}
            </Typography>
            <Chip
              label={user?.role?.toUpperCase() || 'USER'}
              size="small"
              sx={{
                mt: 0.25,
                height: 18,
                fontSize: '0.65rem',
                fontWeight: 700,
                width: 'fit-content',
                backgroundColor: 'rgba(26, 86, 219, 0.08)',
                color: 'primary.main',
                border: '1px solid rgba(26, 86, 219, 0.1)'
              }}
            />
          </Box>
        </Box>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{
            borderRadius: 3,
            py: 0.75,
            fontSize: '0.875rem',
            textTransform: 'none',
            fontWeight: 600,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: 'error.main',
            '&:hover': {
              borderColor: 'error.main',
              backgroundColor: 'error.lighter',
              color: 'error.dark',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
            },
          }}
        >
          Logout
        </Button>

        {/* Profile Dialog */}
        <Dialog
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 4, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }
          }}
        >
          <Box sx={{
            height: 120,
            background: 'linear-gradient(135deg, #1a56db 0%, #6366f1 100%)',
            position: 'relative',
            mb: 6
          }}>
            <Box sx={{
              position: 'absolute',
              bottom: -40,
              left: '50%',
              transform: 'translateX(-50%)',
              p: 0.75,
              bgcolor: 'background.paper',
              borderRadius: '50%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              <Avatar sx={{
                width: 80,
                height: 80,
                bgcolor: 'primary.main',
                background: 'linear-gradient(135deg, #1a56db 0%, #6366f1 100%)',
                fontSize: '2.5rem',
                fontWeight: 800
              }}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </Avatar>
            </Box>
          </Box>
          <DialogContent sx={{ px: 4, pb: 4 }}>
            <Box textAlign="center" mb={4}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                {user?.name || 'User'}
              </Typography>
              <Chip
                label={user?.role?.toUpperCase() || 'USER'}
                sx={{
                  bgcolor: 'rgba(26, 86, 219, 0.08)',
                  color: 'primary.main',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  height: 24
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box display="flex" alignItems="center" gap={2.5}>
                <Box sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(26, 86, 219, 0.08)', color: 'primary.main', display: 'flex' }}>
                  <BadgeIcon />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Employee ID</Typography>
                  <Typography variant="body1" fontWeight={600} color="text.primary">{user?.employeeId || 'N/A'}</Typography>
                </Box>
              </Box>
              <Box display="flex" alignItems="center" gap={2.5}>
                <Box sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(26, 86, 219, 0.08)', color: 'primary.main', display: 'flex' }}>
                  <EmailIcon />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Email Address</Typography>
                  <Typography variant="body1" fontWeight={600} color="text.primary" sx={{ wordBreak: 'break-all' }}>{user?.email || 'N/A'}</Typography>
                </Box>
              </Box>
              <Box display="flex" alignItems="center" gap={2.5}>
                <Box sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(26, 86, 219, 0.08)', color: 'primary.main', display: 'flex' }}>
                  <BusinessIcon />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Department</Typography>
                  <Typography variant="body1" fontWeight={600} color="text.primary">{user?.department || 'N/A'}</Typography>
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0, justifyContent: 'center' }}>
            <Button
              onClick={() => setProfileOpen(false)}
              variant="outlined"
              fullWidth
              sx={{
                borderRadius: 3,
                py: 1.25,
                textTransform: 'none',
                fontWeight: 600,
                borderWidth: 2,
                '&:hover': { borderWidth: 2 }
              }}
            >
              Close Profile
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile AppBar */}
      {isMobile && (
        <AppBar
          position="fixed"
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              sx={{ color: 'text.primary', mr: 2 }}
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
            <LogoBox component={Link} to={homePath} sx={{ flex: 1, justifyContent: 'flex-start', padding: 0 }}>
              <LogoIcon sx={{ width: 32, height: 32, fontSize: '1rem' }}>S</LogoIcon>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #1a56db 0%, #6366f1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Schedulo
              </Typography>
            </LogoBox>
          </Toolbar>
        </AppBar>
      )}

      {/* Drawer */}
      <StyledDrawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileMenuOpen : true}
        onClose={() => setMobileMenuOpen(false)}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
      >
        {drawerContent}
      </StyledDrawer>

      {/* Main Content */}
      <MainContent component="main">
        {isMobile && <Toolbar />}
        <ContentBox>{children}</ContentBox>
      </MainContent>
    </Box>
  )
}

export default Layout
