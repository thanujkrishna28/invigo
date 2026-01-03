import { useState, useEffect, useMemo } from 'react'
import Layout from '../../components/Layout'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  TextField,
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
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Fade,
  Grow,
  useTheme,
  alpha,
} from '@mui/material'
import {
  Search as SearchIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
import { styled } from '@mui/material/styles'

const StyledTabs = styled(Tabs)(({ theme }) => ({
  minHeight: 48,
  '& .MuiTabs-indicator': {
    height: 4,
    borderRadius: '4px 4px 0 0',
    background: 'linear-gradient(90deg, #1a56db 0%, #6366f1 100%)',
  },
}))

const StyledTab = styled(Tab)(({ theme }) => ({
  minHeight: 48,
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.9375rem',
  color: theme.palette.text.secondary,
  '&.Mui-selected': {
    color: theme.palette.primary.main,
    fontWeight: 700,
  },
}))

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  padding: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5),
    fontSize: '0.875rem',
  },
}))

const StyledHeaderCell = styled(TableCell)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a56db 0%, #1e40af 100%) !important',
  color: 'white !important',
  fontWeight: '700 !important',
  fontSize: '0.875rem !important',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: 'none !important',
  padding: `${theme.spacing(2)} !important`,
  [theme.breakpoints.down('sm')]: {
    padding: `${theme.spacing(1.5)} !important`,
    fontSize: '0.75rem !important',
  },
}))

const StyledTableHead = styled(TableHead)(({ theme }) => ({}))

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
  '&:last-child td': {
    borderBottom: 'none',
  },
}))

const StatusChip = styled(Chip)(({ theme, status }) => {
  const colors = {
    allocated: {
      bg: alpha(theme.palette.success.main, 0.1),
      color: theme.palette.success.dark,
      border: theme.palette.success.main,
    },
    scheduled: {
      bg: alpha(theme.palette.warning.main, 0.1),
      color: theme.palette.warning.dark,
      border: theme.palette.warning.main,
    },
    completed: {
      bg: alpha(theme.palette.info.main, 0.1),
      color: theme.palette.info.dark,
      border: theme.palette.info.main,
    },
    default: {
      bg: alpha(theme.palette.primary.main, 0.1),
      color: theme.palette.primary.dark,
      border: theme.palette.primary.main,
    },
  }
  const color = colors[status] || colors.default
  return {
    backgroundColor: color.bg,
    color: color.color,
    border: `1px solid ${alpha(color.border, 0.3)}`,
    fontWeight: 600,
    fontSize: '0.75rem',
    height: 28,
  }
})

const ConflictCard = styled(Card)(({ theme, severity }) => {
  const colors = {
    high: {
      border: theme.palette.error.main,
      bg: alpha(theme.palette.error.main, 0.05),
    },
    medium: {
      border: theme.palette.warning.main,
      bg: alpha(theme.palette.warning.main, 0.05),
    },
    low: {
      border: theme.palette.info.main,
      bg: alpha(theme.palette.info.main, 0.05),
    },
  }
  const color = colors[severity] || colors.low
  return {
    borderLeft: `4px solid ${color.border}`,
    backgroundColor: color.bg,
    borderRadius: 12,
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: theme.shadows[4],
      transform: 'translateX(4px)',
    },
  }
})

const AdminSchedule = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [exams, setExams] = useState([])
  const [faculty, setFaculty] = useState([])
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState({ exams: true, faculty: true, conflicts: true })
  const [filters, setFilters] = useState({
    campus: '',
    department: '',
    status: '',
    search: '',
  })
  const theme = useTheme()

  const tabs = [
    { id: 'exams', label: 'Exams', icon: <AssignmentIcon /> },
    { id: 'faculty', label: 'Faculty', icon: <PeopleIcon /> },
    { id: 'conflicts', label: 'Conflicts', icon: <WarningIcon /> },
  ]

  useEffect(() => {
    const { search, ...otherFilters } = filters
    if (activeTab === 0) fetchExams(otherFilters)
    if (activeTab === 1) fetchFaculty(otherFilters)
    if (activeTab === 2) fetchConflicts()
  }, [activeTab, filters.campus, filters.department, filters.status])

  const fetchExams = async (currentFilters) => {
    try {
      setLoading((prev) => ({ ...prev, exams: true }))
      const params = new URLSearchParams()
      if (currentFilters.campus) params.append('campus', currentFilters.campus)
      if (currentFilters.department) params.append('department', currentFilters.department)
      if (currentFilters.status) params.append('status', currentFilters.status)

      const response = await api.get(`/admin/exams?${params}`)
      setExams(response.data.data || [])
    } catch (error) {
      toast.error('Error fetching exams')
    } finally {
      setLoading((prev) => ({ ...prev, exams: false }))
    }
  }

  const fetchFaculty = async (currentFilters) => {
    try {
      setLoading((prev) => ({ ...prev, faculty: true }))
      const params = new URLSearchParams()
      if (currentFilters.campus) params.append('campus', currentFilters.campus)
      if (currentFilters.department) params.append('department', currentFilters.department)

      const response = await api.get(`/admin/faculty?${params}`)
      setFaculty(response.data.data || [])
    } catch (error) {
      toast.error('Error fetching faculty')
    } finally {
      setLoading((prev) => ({ ...prev, faculty: false }))
    }
  }

  const filteredExams = useMemo(() => {
    if (!filters.search) return exams
    const searchLower = filters.search.toLowerCase()
    return exams.filter(
      (exam) =>
        exam.examName?.toLowerCase().includes(searchLower) ||
        exam.courseCode?.toLowerCase().includes(searchLower) ||
        exam.examId?.toLowerCase().includes(searchLower) ||
        exam.department?.toLowerCase().includes(searchLower)
    )
  }, [exams, filters.search])

  const filteredFaculty = useMemo(() => {
    if (!filters.search) return faculty
    const searchLower = filters.search.toLowerCase()
    return faculty.filter(
      (f) =>
        f.name?.toLowerCase().includes(searchLower) ||
        f.email?.toLowerCase().includes(searchLower) ||
        f.employeeId?.toLowerCase().includes(searchLower) ||
        f.department?.toLowerCase().includes(searchLower)
    )
  }, [faculty, filters.search])

  const fetchConflicts = async () => {
    try {
      setLoading((prev) => ({ ...prev, conflicts: true }))
      const response = await api.get('/conflicts')
      setConflicts(response.data.data || [])
    } catch (error) {
      toast.error('Error fetching conflicts')
    } finally {
      setLoading((prev) => ({ ...prev, conflicts: false }))
    }
  }

  const handleAllocate = async (examId) => {
    try {
      const response = await api.post('/admin/allocate', { examIds: [examId] })
      toast.success('Allocation completed')
      fetchExams()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Allocation failed')
    }
  }

  const handleDetectConflicts = async () => {
    try {
      const response = await api.post('/conflicts/detect')
      toast.success(response.data.message)
      fetchConflicts()
    } catch (error) {
      toast.error('Error detecting conflicts')
    }
  }

  const handleResolveConflict = async (conflictId) => {
    try {
      await api.patch(`/conflicts/${conflictId}/resolve`)
      toast.success('Conflict marked as resolved')
      fetchConflicts()
    } catch (error) {
      toast.error('Error resolving conflict')
    }
  }

  return (
    <Layout>
      <Fade in timeout={600}>
        <Box>
          {/* Header */}
          <Box mb={4}>
            <Typography
              variant="h4"
              fontWeight={700}
              gutterBottom
              sx={{
                background: 'linear-gradient(135deg, #1a56db 0%, #6366f1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Schedule Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage exams, allocations, and conflicts
            </Typography>
          </Box>

          {/* Tabs */}
          <Card sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent sx={{ p: '8px !important' }}>
              <StyledTabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                {tabs.map((tab, index) => (
                  <StyledTab
                    key={tab.id}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {tab.icon}
                        <span>{tab.label}</span>
                      </Box>
                    }
                  />
                ))}
              </StyledTabs>
            </CardContent>
          </Card>

          {/* Tab Content */}
          <Grow in timeout={600}>
            <Box>
              {/* Exams Tab */}
              {activeTab === 0 && (
                <Box>
                  {/* Filters */}
                  <Card sx={{ mb: 3, borderRadius: 3 }}>
                    <CardContent>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, 1fr)',
                            lg: '2fr 1fr 1fr 1fr',
                          },
                          gap: 2,
                        }}
                      >
                        <TextField
                          fullWidth
                          placeholder="Search exams..."
                          value={filters.search}
                          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                          size="small"
                        />
                        <FormControl size="small" fullWidth>
                          <InputLabel>Campus</InputLabel>
                          <Select
                            value={filters.campus}
                            label="Campus"
                            onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
                          >
                            <MenuItem value="">All Campuses</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Department</InputLabel>
                          <Select
                            value={filters.department}
                            label="Department"
                            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                          >
                            <MenuItem value="">All Departments</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Status</InputLabel>
                          <Select
                            value={filters.status}
                            label="Status"
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                          >
                            <MenuItem value="">All Status</MenuItem>
                            <MenuItem value="scheduled">Scheduled</MenuItem>
                            <MenuItem value="allocated">Allocated</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Exams Table */}
                  <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <TableContainer>
                      <Table>
                        <StyledTableHead>
                          <TableRow>
                            <StyledHeaderCell>Exam ID</StyledHeaderCell>
                            <StyledHeaderCell>Exam Name</StyledHeaderCell>
                            <StyledHeaderCell>Course</StyledHeaderCell>
                            <StyledHeaderCell>Date</StyledHeaderCell>
                            <StyledHeaderCell>Time</StyledHeaderCell>
                            <StyledHeaderCell>Status</StyledHeaderCell>
                            <StyledHeaderCell align="center">Actions</StyledHeaderCell>
                          </TableRow>
                        </StyledTableHead>
                        <TableBody>
                          {loading.exams ? (
                            <TableRow>
                              <StyledTableCell colSpan={7} align="center" sx={{ py: 8 }}>
                                <CircularProgress />
                              </StyledTableCell>
                            </TableRow>
                          ) : filteredExams.length === 0 ? (
                            <TableRow>
                              <StyledTableCell colSpan={7} align="center" sx={{ py: 8 }}>
                                <Typography variant="body2" color="text.secondary">
                                  No exams found
                                </Typography>
                              </StyledTableCell>
                            </TableRow>
                          ) : (
                            filteredExams.map((exam) => (
                              <StyledTableRow key={exam._id}>
                                <StyledTableCell>
                                  <Typography variant="body2" fontWeight={600}>
                                    {exam.examId}
                                  </Typography>
                                </StyledTableCell>
                                <StyledTableCell>{exam.examName}</StyledTableCell>
                                <StyledTableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {exam.courseCode}
                                  </Typography>
                                </StyledTableCell>
                                <StyledTableCell>
                                  {new Date(exam.date).toLocaleDateString()}
                                </StyledTableCell>
                                <StyledTableCell>
                                  <Typography variant="body2" fontFamily="monospace">
                                    {exam.startTime} - {exam.endTime}
                                  </Typography>
                                </StyledTableCell>
                                <StyledTableCell>
                                  <StatusChip
                                    label={exam.status}
                                    status={exam.status}
                                    size="small"
                                  />
                                </StyledTableCell>
                                <StyledTableCell align="center">
                                  {exam.status === 'scheduled' && (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      onClick={() => handleAllocate(exam._id)}
                                      sx={{
                                        textTransform: 'none',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Allocate
                                    </Button>
                                  )}
                                </StyledTableCell>
                              </StyledTableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Card>
                </Box>
              )}

              {/* Faculty Tab */}
              {activeTab === 1 && (
                <Box>
                  {/* Filters */}
                  <Card sx={{ mb: 3, borderRadius: 3 }}>
                    <CardContent>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: '1fr',
                            sm: '2fr 1fr 1fr',
                          },
                          gap: 2,
                        }}
                      >
                        <TextField
                          fullWidth
                          placeholder="Search faculty..."
                          value={filters.search}
                          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                          size="small"
                        />
                        <FormControl size="small" fullWidth>
                          <InputLabel>Campus</InputLabel>
                          <Select
                            value={filters.campus}
                            label="Campus"
                            onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
                          >
                            <MenuItem value="">All Campuses</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Department</InputLabel>
                          <Select
                            value={filters.department}
                            label="Department"
                            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                          >
                            <MenuItem value="">All Departments</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Faculty Table */}
                  <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <TableContainer>
                      <Table>
                        <StyledTableHead>
                          <TableRow>
                            <StyledHeaderCell>Name</StyledHeaderCell>
                            <StyledHeaderCell>Email</StyledHeaderCell>
                            <StyledHeaderCell>Employee ID</StyledHeaderCell>
                            <StyledHeaderCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                              Department
                            </StyledHeaderCell>
                            <StyledHeaderCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                              Campus
                            </StyledHeaderCell>
                            <StyledHeaderCell align="right">Workload</StyledHeaderCell>
                          </TableRow>
                        </StyledTableHead>
                        <TableBody>
                          {loading.faculty ? (
                            <TableRow>
                              <StyledTableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                <CircularProgress />
                              </StyledTableCell>
                            </TableRow>
                          ) : filteredFaculty.length === 0 ? (
                            <TableRow>
                              <StyledTableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                <Typography variant="body2" color="text.secondary">
                                  No faculty found
                                </Typography>
                              </StyledTableCell>
                            </TableRow>
                          ) : (
                            filteredFaculty.map((f) => (
                              <StyledTableRow key={f._id}>
                                <StyledTableCell>
                                  <Typography variant="body2" fontWeight={600}>
                                    {f.name}
                                  </Typography>
                                </StyledTableCell>
                                <StyledTableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {f.email}
                                  </Typography>
                                </StyledTableCell>
                                <StyledTableCell>
                                  <Typography variant="body2" fontFamily="monospace">
                                    {f.employeeId || '-'}
                                  </Typography>
                                </StyledTableCell>
                                <StyledTableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                  {f.department || '-'}
                                </StyledTableCell>
                                <StyledTableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                  {f.campus}
                                </StyledTableCell>
                                <StyledTableCell align="right">
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>
                                      {f.workload?.totalDuties || 0} duties
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {f.workload?.totalHours || 0} hours
                                    </Typography>
                                  </Box>
                                </StyledTableCell>
                              </StyledTableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Card>
                </Box>
              )}

              {/* Conflicts Tab */}
              {activeTab === 2 && (
                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h5" fontWeight={700}>
                      Conflicts
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<RefreshIcon />}
                      onClick={handleDetectConflicts}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      Detect Conflicts
                    </Button>
                  </Box>

                  {loading.conflicts ? (
                    <Card sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Box display="flex" justifyContent="center" py={8}>
                          <CircularProgress />
                        </Box>
                      </CardContent>
                    </Card>
                  ) : conflicts.length === 0 ? (
                    <Card sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Box textAlign="center" py={8}>
                          <CheckCircleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No Conflicts Detected
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            All schedules are conflict-free
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {conflicts.map((conflict, index) => (
                        <Grow in timeout={600} style={{ transitionDelay: `${index * 50}ms` }} key={conflict._id}>
                          <ConflictCard severity={conflict.severity || 'low'}>
                            <CardContent>
                              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                <Box flex={1}>
                                  <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                                    <Chip
                                      label={conflict.severity?.toUpperCase() || 'LOW'}
                                      size="small"
                                      color={
                                        conflict.severity === 'high'
                                          ? 'error'
                                          : conflict.severity === 'medium'
                                            ? 'warning'
                                            : 'info'
                                      }
                                      sx={{ fontWeight: 700 }}
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                      {conflict.type}
                                    </Typography>
                                  </Box>
                                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    {conflict.faculty?.name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" paragraph>
                                    {conflict.description}
                                  </Typography>
                                  {conflict.resolution?.suggestedActions && (
                                    <Box mt={2}>
                                      <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" mb={0.5}>
                                        Suggested Actions:
                                      </Typography>
                                      <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                        {conflict.resolution.suggestedActions.map((action, idx) => (
                                          <Typography
                                            key={idx}
                                            component="li"
                                            variant="caption"
                                            color="text.secondary"
                                          >
                                            {action}
                                          </Typography>
                                        ))}
                                      </Box>
                                    </Box>
                                  )}
                                </Box>
                                {conflict.status === 'detected' && (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => handleResolveConflict(conflict._id)}
                                    sx={{ ml: 2, textTransform: 'none', fontWeight: 600 }}
                                  >
                                    Mark Resolved
                                  </Button>
                                )}
                              </Box>
                            </CardContent>
                          </ConflictCard>
                        </Grow>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Grow>
        </Box>
      </Fade>
    </Layout>
  )
}

export default AdminSchedule
