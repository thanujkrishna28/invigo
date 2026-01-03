import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import api from '../../utils/api'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Fade,
  Grow,
  useTheme,
} from '@mui/material'
import {
  CalendarToday as CalendarIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Warning as WarningIcon,
  Business as BusinessIcon,
  AccessTime as ClockIcon,
} from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import { Link } from 'react-router-dom'

const StatCard = styled(Card)(({ theme, gradient }) => ({
  position: 'relative',
  overflow: 'hidden',
  height: '100%',
  borderRadius: 16,
  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
  border: '1px solid rgba(226, 232, 240, 0.8)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'block',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
    borderColor: theme.palette.primary.light,
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    right: 0,
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: gradient || 'linear-gradient(135deg, rgba(26, 86, 219, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
    filter: 'blur(40px)',
    transform: 'translate(30%, -30%)',
    transition: 'all 0.3s ease',
  },
  '&:hover::before': {
    width: '160px',
    height: '160px',
    opacity: 0.8,
  },
}))

const IconContainer = styled(Box)(({ theme, bgcolor }) => ({
  width: 56,
  height: 56,
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: bgcolor || 'linear-gradient(135deg, #1a56db 0%, #1e40af 100%)',
  boxShadow: '0 4px 12px rgba(26, 86, 219, 0.3)',
  transition: 'all 0.3s ease',
  [theme.breakpoints.down('sm')]: {
    width: 48,
    height: 48,
  },
}))

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
  padding: theme.spacing(2),
}))

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a56db 0%, #1e40af 100%)',
  '& .MuiTableCell-root': {
    color: 'white',
    fontWeight: 700,
    fontSize: '0.875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
}))

const AdminDashboard = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ campus: '', department: '' })
  const theme = useTheme()

  useEffect(() => {
    fetchDashboard()
  }, [filters])

  const fetchDashboard = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await api.get(`/admin/dashboard?${params}`)
      setStats(response.data.data)
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={48} />
        </Box>
      </Layout>
    )
  }

  const statCards = [
    {
      title: 'Total Exams',
      value: stats?.statistics?.totalExams || 0,
      icon: DescriptionIcon,
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
      iconBg: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
      link: '/admin/schedule',
    },
    {
      title: 'Scheduled',
      value: stats?.statistics?.scheduledExams || 0,
      icon: CalendarIcon,
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 146, 60, 0.15) 100%)',
      iconBg: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)',
      link: '/admin/schedule',
    },
    {
      title: 'Allocated',
      value: stats?.statistics?.allocatedExams || 0,
      icon: ClockIcon,
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
      iconBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      link: '/admin/schedule',
    },
    {
      title: 'Total Faculty',
      value: stats?.statistics?.totalFaculty || 0,
      icon: PeopleIcon,
      gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
      iconBg: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      link: '/admin/manage',
    },
    {
      title: 'Active Conflicts',
      value: stats?.statistics?.activeConflicts || 0,
      icon: WarningIcon,
      gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
      iconBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      link: '/admin/schedule',
    },
    {
      title: 'Classrooms',
      value: stats?.statistics?.totalClassrooms || 0,
      icon: BusinessIcon,
      gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
      iconBg: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
      link: '/admin/schedule',
    },
  ]

  return (
    <Layout>
      <Fade in timeout={600}>
        <Box>
          {/* Header */}
          <Box mb={4}>
            <Typography
              variant="h5"
              fontWeight={700}
              gutterBottom
              sx={{
                background: 'linear-gradient(135deg, #1a56db 0%, #6366f1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Admin Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Overview of your campus scheduling system
            </Typography>
          </Box>

          {/* Filters Removed */}{" "}

          {/* Statistics Grid */}
          <Grid container spacing={3} mb={4}>
            {statCards.map((stat, index) => (
              <Grid item xs={6} sm={6} md={4} key={index}>
                <Grow in timeout={800} style={{ transitionDelay: `${index * 100}ms` }}>
                  <StatCard component={Link} to={stat.link} gradient={stat.gradient}>
                    <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom sx={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {stat.title}
                          </Typography>
                          <Typography variant="h5" fontWeight={800} color="text.primary">
                            {stat.value}
                          </Typography>
                        </Box>
                        <IconContainer bgcolor={stat.iconBg} sx={{ flexShrink: 0 }}>
                          <stat.icon sx={{ color: 'white', fontSize: 28 }} />
                        </IconContainer>
                      </Box>
                    </CardContent>
                  </StatCard>
                </Grow>
              </Grid>
            ))}
          </Grid>

          {/* Recent Allocations */}
          <Grow in timeout={1000}>
            <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <CardContent>
                <Box mb={3}>
                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    Recent Allocations
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Latest invigilation assignments
                  </Typography>
                </Box>
                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Table>
                    <StyledTableHead>
                      <TableRow>
                        <StyledTableCell>Date</StyledTableCell>
                        <StyledTableCell>Time</StyledTableCell>
                        <StyledTableCell>Faculty</StyledTableCell>
                        <StyledTableCell>Exam</StyledTableCell>
                        <StyledTableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Campus</StyledTableCell>
                      </TableRow>
                    </StyledTableHead>
                    <TableBody>
                      {stats?.recentAllocations?.length > 0 ? (
                        stats.recentAllocations.map((allocation) => (
                          <TableRow
                            key={allocation._id}
                            sx={{
                              transition: 'background-color 0.2s ease',
                              '&:hover': {
                                backgroundColor: 'rgba(26, 86, 219, 0.04)',
                              },
                            }}
                          >
                            <StyledTableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {new Date(allocation.date).toLocaleDateString()}
                              </Typography>
                            </StyledTableCell>
                            <StyledTableCell>
                              <Chip
                                label={`${allocation.startTime} - ${allocation.endTime}`}
                                size="small"
                                sx={{
                                  background: 'linear-gradient(135deg, rgba(26, 86, 219, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
                                  color: 'primary.main',
                                  fontWeight: 600,
                                }}
                              />
                            </StyledTableCell>
                            <StyledTableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {allocation.faculty?.name}
                              </Typography>
                            </StyledTableCell>
                            <StyledTableCell>
                              <Typography variant="body2">{allocation.exam?.examName}</Typography>
                            </StyledTableCell>
                            <StyledTableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                              <Typography variant="body2">{allocation.campus}</Typography>
                            </StyledTableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <StyledTableCell colSpan={5} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              No recent allocations
                            </Typography>
                          </StyledTableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grow>
        </Box>
      </Fade>
    </Layout>
  )
}

export default AdminDashboard
