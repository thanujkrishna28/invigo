import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import api from '../../utils/api'
import Calendar from 'react-calendar'
import moment from 'moment'
import toast from 'react-hot-toast'
import 'react-calendar/dist/Calendar.css'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
  Stack,
  useTheme,
  Avatar,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress
} from '@mui/material'
import { styled, alpha } from '@mui/material/styles'
import {
  CalendarMonth,
  Event as EventIcon,
  FilterList,
  Close,
  AccessTime,
  LocationOn,
  Group,
  Business,
  School,
  ChevronRight,
  ChevronLeft,
  Circle
} from '@mui/icons-material'

// Styled Calendar Wrapper
const CalendarWrapper = styled(Box)(({ theme }) => ({
  '.react-calendar': {
    width: '100%',
    border: 'none',
    fontFamily: theme.typography.fontFamily,
    background: 'none',
  },
  '.react-calendar__navigation': {
    marginBottom: theme.spacing(2),
    button: {
      minWidth: 36,
      background: 'none',
      fontSize: '0.9rem',
      fontWeight: 700,
      color: theme.palette.text.primary,
      borderRadius: 8,
      '&:hover': {
        background: theme.palette.action.hover,
      },
      '&:disabled': {
        background: 'none',
        color: theme.palette.text.disabled,
      },
    },
  },
  '.react-calendar__month-view__weekdays': {
    textAlign: 'center',
    textTransform: 'uppercase',
    fontWeight: 700,
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  '.react-calendar__month-view__days__day': {
    padding: 0,
  },
  '.react-calendar__tile': {
    maxWidth: '100%',
    padding: '6px 4px',
    background: 'none',
    textAlign: 'center',
    borderRadius: 8,
    position: 'relative',
    height: 56,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    transition: 'all 0.2s',
    border: '1px solid transparent',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  '.react-calendar__tile--now': {
    background: alpha(theme.palette.warning.light, 0.2),
    color: theme.palette.warning.dark,
    fontWeight: 700,
    borderColor: alpha(theme.palette.warning.main, 0.5),
  },
  '.react-calendar__tile--active': {
    background: `${theme.palette.primary.main} !important`,
    color: `${theme.palette.primary.contrastText} !important`,
    boxShadow: theme.shadows[4],
  },
  '.has-events': {
    fontWeight: 600,
  },
  '.day-events-dots': {
    display: 'flex',
    gap: 1.5,
    marginTop: 2,
  }
}))

const AdminCalendar = () => {
  const theme = useTheme()
  const [events, setEvents] = useState([])
  const [filteredEvents, setFilteredEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [campuses, setCampuses] = useState([])
  const [departments, setDepartments] = useState([])
  const [stats, setStats] = useState({ total: 0, today: 0, upcoming: 0 })
  const [filters, setFilters] = useState({
    campus: '',
    department: '',
    examType: ''
  })

  useEffect(() => {
    fetchCampuses()
    fetchCalendarData()
  }, [])

  useEffect(() => {
    fetchCalendarData()
  }, [filters])

  useEffect(() => {
    filterEvents()
    calculateStats()
  }, [events, selectedDate])

  const fetchCampuses = async () => {
    try {
      const response = await api.get('/admin/campuses')
      setCampuses(response.data.data || [])
    } catch (error) {
      console.error('Error fetching campuses:', error)
    }
  }

  const fetchDepartments = async () => {
    if (!filters.campus) return
    try {
      const response = await api.get(`/api/admin/departments?campus=${filters.campus}`)
      setDepartments(response.data.data || [])
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [filters.campus])

  const fetchCalendarData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)
      if (filters.examType) params.append('examType', filters.examType)

      const response = await api.get(`/admin/calendar?${params}`)
      setEvents(response.data.events || [])
    } catch (error) {
      toast.error('Error fetching calendar data')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterEvents = () => {
    const dateStr = moment(selectedDate).format('YYYY-MM-DD')
    const filtered = events.filter(event => {
      const eventDate = moment(event.start).format('YYYY-MM-DD')
      return eventDate === dateStr
    })
    setFilteredEvents(filtered)
  }

  const calculateStats = () => {
    const today = moment().format('YYYY-MM-DD')
    const total = events.length
    const todayCount = events.filter(e => moment(e.start).format('YYYY-MM-DD') === today).length
    const upcoming = events.filter(e => moment(e.start).isAfter(moment())).length

    setStats({ total, today: todayCount, upcoming })
  }

  const getEventTypeColor = (examType) => {
    switch (examType?.toLowerCase()) {
      case 'mid-term': return theme.palette.secondary.main
      case 'semester': return theme.palette.primary.main
      case 'labs': return theme.palette.success.main
      default: return theme.palette.grey[500]
    }
  }

  const getEventTypeLabel = (examType) => {
    switch (examType?.toLowerCase()) {
      case 'mid-term': return 'Mid-Term'
      case 'semester': return 'Semester'
      case 'labs': return 'Labs'
      default: return 'Other'
    }
  }

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return ''
    const dateStr = moment(date).format('YYYY-MM-DD')
    const hasEvents = events.some(event =>
      moment(event.start).format('YYYY-MM-DD') === dateStr
    )
    return hasEvents ? 'has-events' : ''
  }

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null

    const dateStr = moment(date).format('YYYY-MM-DD')
    const dayEvents = events.filter(event =>
      moment(event.start).format('YYYY-MM-DD') === dateStr
    )

    if (dayEvents.length === 0) return null

    // Group events by type
    const eventTypes = {}
    dayEvents.forEach(event => {
      const type = event.resource?.examType || 'other'
      eventTypes[type] = (eventTypes[type] || 0) + 1
    })

    return (
      <Box className="day-events-dots" sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 1 }}>
        {Object.entries(eventTypes).slice(0, 3).map(([type, count]) => (
          <Box
            key={type}
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: getEventTypeColor(type),
            }}
          />
        ))}
        {dayEvents.length > 3 && (
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
            +
          </Typography>
        )}
      </Box>
    )
  }

  const clearFilters = () => {
    setFilters({ campus: '', department: '', examType: '' })
    setDepartments([])
  }

  const StatCard = ({ title, count, icon: Icon, color }) => (
    <Card sx={{ height: '100%', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          p: 3,
          opacity: 0.1,
          transform: 'scale(1.5) translate(10%, -10%)',
        }}
      >
        <Icon sx={{ fontSize: 64, color }} />
      </Box>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(color, 0.1) }}>
            <Icon sx={{ color }} />
          </Box>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
            {title}
          </Typography>
        </Stack>
        <Typography variant="h5" fontWeight={700}>
          {count}
        </Typography>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  return (
    <Layout>
      <Box maxWidth="xl" sx={{ width: '100%', mx: 'auto' }}>
        {/* Header */}
        <Box mb={4}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Calendar
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View and manage examination schedules
          </Typography>
        </Box>

        {/* Stats */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={4}>
            <StatCard title="Total Events" count={stats.total} icon={CalendarMonth} color={theme.palette.primary.main} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <StatCard title="Today's Events" count={stats.today} icon={AccessTime} color={theme.palette.success.main} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <StatCard title="Upcoming" count={stats.upcoming} icon={ChevronRight} color={theme.palette.secondary.main} />
          </Grid>
        </Grid>

        {/* Filters */}
        <Grid container spacing={2} alignItems="center" mb={4}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Campus</InputLabel>
              <Select
                value={filters.campus}
                label="Campus"
                onChange={(e) => setFilters({ ...filters, campus: e.target.value, department: '' })}
              >
                <MenuItem value="">All Campuses</MenuItem>
                {campuses.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" disabled={!filters.campus}>
              <InputLabel>Department</InputLabel>
              <Select
                value={filters.department}
                label="Department"
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              >
                <MenuItem value="">All Departments</MenuItem>
                {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Exam Type</InputLabel>
              <Select
                value={filters.examType}
                label="Exam Type"
                onChange={(e) => setFilters({ ...filters, examType: e.target.value })}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="mid-term">Mid-Term</MenuItem>
                <MenuItem value="semester">Semester</MenuItem>
                <MenuItem value="labs">Labs</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Close />}
              onClick={clearFilters}
              disabled={!filters.campus && !filters.department && !filters.examType}
              fullWidth
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* Calendar View */}
          <Grid item xs={12} lg={8}>
            <Card sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent>
                <CalendarWrapper>
                  <Calendar
                    onChange={setSelectedDate}
                    value={selectedDate}
                    tileClassName={tileClassName}
                    tileContent={tileContent}
                    next2Label={null}
                    prev2Label={null}
                    formatMonthYear={(locale, date) => moment(date).format('MMMM YYYY')}
                  />
                </CalendarWrapper>
              </CardContent>
            </Card>
          </Grid>

          {/* Events List */}
          <Grid item xs={12} lg={4}>
            <Card sx={{ borderRadius: 3, height: '100%', maxHeight: 800, overflow: 'auto' }}>
              <CardContent>
                <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      {moment(selectedDate).format('MMMM DD, YYYY')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {moment(selectedDate).format('dddd')}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${filteredEvents.length} Events`}
                    size="small"
                    color="primary"
                    variant="soft"
                  />
                </Box>

                {filteredEvents.length === 0 ? (
                  <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={8}>
                    <EventIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary">No events scheduled</Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {filteredEvents.map((event, index) => {
                      const examType = event.resource?.examType || 'other'
                      return (
                        <Card
                          key={index}
                          variant="outlined"
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                            borderLeft: `4px solid ${getEventTypeColor(examType)}`
                          }}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <CardContent sx={{ p: '16px !important' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                              <Chip
                                label={getEventTypeLabel(examType)}
                                size="small"
                                sx={{
                                  bgcolor: alpha(getEventTypeColor(examType), 0.1),
                                  color: getEventTypeColor(examType),
                                  fontWeight: 600,
                                  height: 24
                                }}
                              />
                            </Box>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                              {event.title}
                            </Typography>
                            <Stack spacing={1} direction="row" flexWrap="wrap">
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                  {moment(event.start).format('HH:mm')} - {moment(event.end).format('HH:mm')}
                                </Typography>
                              </Box>
                              {event.resource?.classroom && (
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <School sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {event.resource.classroom.roomNumber}
                                  </Typography>
                                </Box>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Event Detail Modal */}
        <Dialog
          open={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          maxWidth="sm"
          fullWidth
        >
          {selectedEvent && (
            <>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight={700}>{selectedEvent.title}</Typography>
                <IconButton onClick={() => setSelectedEvent(null)}><Close /></IconButton>
              </DialogTitle>
              <DialogContent dividers>
                <Stack spacing={3} py={1}>
                  <Box display="flex" gap={2}>
                    <Chip
                      label={getEventTypeLabel(selectedEvent.resource?.examType)}
                      sx={{ bgcolor: getEventTypeColor(selectedEvent.resource?.examType), color: 'white' }}
                    />
                    {selectedEvent.resource?.courseCode && (
                      <Chip label={selectedEvent.resource?.courseCode} variant="outlined" />
                    )}
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">Time</Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {moment(selectedEvent.start).format('MMMM DD, YYYY')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {moment(selectedEvent.start).format('HH:mm')} - {moment(selectedEvent.end).format('HH:mm')}
                      </Typography>
                    </Grid>
                    {selectedEvent.resource?.classroom && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Location</Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {selectedEvent.resource.classroom.roomNumber}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedEvent.resource.classroom.block}
                        </Typography>
                      </Grid>
                    )}
                    {selectedEvent.resource?.campus && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Campus</Typography>
                        <Typography variant="body2">{selectedEvent.resource.campus}</Typography>
                      </Grid>
                    )}
                    {selectedEvent.resource?.department && (
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Department</Typography>
                        <Typography variant="body2">{selectedEvent.resource.department}</Typography>
                      </Grid>
                    )}
                  </Grid>

                  {selectedEvent.resource?.allocatedFaculty && selectedEvent.resource.allocatedFaculty.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>Assigned Faculty</Typography>
                      <Stack spacing={1}>
                        {selectedEvent.resource.allocatedFaculty.map((faculty, idx) => (
                          <Box key={idx} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                            <Typography variant="subtitle2">{faculty.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{faculty.email}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </DialogContent>
            </>
          )}
        </Dialog>
      </Box>
    </Layout>
  )
}

export default AdminCalendar
