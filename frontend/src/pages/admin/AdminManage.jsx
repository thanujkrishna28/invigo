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
  Button,
  Grid,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Fade,
  Grow,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  alpha,
} from '@mui/material'
import {
  Search as SearchIcon,
  Upload as UploadIcon,
  Description as FileTextIcon,
  Download as DownloadIcon,
  Bolt as ZapIcon,
  Mail as MailIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  CloudUpload as CloudUploadIcon,
  Refresh as RefreshIcon,
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

const AllocationCard = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
  '&:hover': {
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    transform: 'translateY(-2px)',
    borderColor: theme.palette.primary.light,
  },
}))

const StatusChip = styled(Chip)(({ theme, status }) => {
  const colors = {
    confirmed: {
      bg: alpha(theme.palette.success.main, 0.1),
      color: theme.palette.success.dark,
      border: theme.palette.success.main,
    },
    requested_change: {
      bg: alpha(theme.palette.warning.main, 0.1),
      color: theme.palette.warning.dark,
      border: theme.palette.warning.main,
    },
    default: {
      bg: alpha(theme.palette.info.main, 0.1),
      color: theme.palette.info.dark,
      border: theme.palette.info.main,
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

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  padding: theme.spacing(1.5),
  fontSize: '0.875rem',
}))

const StyledHeaderCell = styled(TableCell)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a56db 0%, #1e40af 100%) !important',
  color: 'white !important',
  fontWeight: '700 !important',
  fontSize: '0.875rem !important',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: 'none !important',
  padding: `${theme.spacing(1.5)} !important`,
}))

const StyledTableHead = styled(TableHead)(({ theme }) => ({}))

const StyledTableRow = styled(TableRow)(({ theme, error }) => ({
  transition: 'background-color 0.2s ease',
  backgroundColor: error ? alpha(theme.palette.error.main, 0.05) : 'transparent',
  '&:hover': {
    backgroundColor: error ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.primary.main, 0.04),
  },
  '&:last-child td': {
    borderBottom: 'none',
  },
}))

const AdminManage = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState({ allocations: true })
  const [notifying, setNotifying] = useState(false)
  const [campuses, setCampuses] = useState([])
  const [departments, setDepartments] = useState([])
  const [uploading, setUploading] = useState({
    exam: false,
    classroom: false,
    faculty: false,
  })
  const [previewData, setPreviewData] = useState({
    exam: null,
    classroom: null,
    faculty: null,
  })
  const [editingRow, setEditingRow] = useState(null)
  const [examType, setExamType] = useState('semester')
  const [filters, setFilters] = useState({
    campus: '',
    department: '',
    search: '',
  })
  const [confirmDialog, setConfirmDialog] = useState({ open: false, message: '', onConfirm: null })

  const tabs = [
    { id: 'uploads', label: 'Uploads', icon: <CloudUploadIcon /> },
    { id: 'allocations', label: 'Allocations', icon: <DownloadIcon /> },
  ]

  useEffect(() => {
    if (activeTab === 1) {
      fetchCampuses()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 1) {
      fetchAllocations()
    }
  }, [activeTab, filters.campus, filters.department])

  useEffect(() => {
    if (activeTab === 1 && filters.campus) {
      fetchDepartments()
    } else if (activeTab === 1 && !filters.campus) {
      setDepartments([])
    }
  }, [filters.campus, activeTab])

  const fetchCampuses = async () => {
    try {
      const response = await api.get('/admin/campuses')
      setCampuses(response.data.data || [])
    } catch (error) {
      console.error('Error fetching campuses:', error)
    }
  }

  const fetchDepartments = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      const response = await api.get(`/admin/departments?${params}`)
      setDepartments(response.data.data || [])
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchAllocations = async () => {
    try {
      setLoading((prev) => ({ ...prev, allocations: true }))
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await api.get(`/admin/allocations?${params}`)
      setAllocations(response.data.data || [])
    } catch (error) {
      toast.error('Error fetching allocations')
    } finally {
      setLoading((prev) => ({ ...prev, allocations: false }))
    }
  }

  const handleAutoAllocate = async () => {
    try {
      const response = await api.post('/admin/allocate', {})
      toast.success(response.data.message || 'Allocation completed')
      fetchAllocations()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Allocation failed')
    }
  }

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await api.get(`/reports/pdf?${params}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'allocations-report.pdf')
      document.body.appendChild(link)
      link.click()
      toast.success('PDF exported successfully')
    } catch (error) {
      toast.error('Export failed')
    }
  }

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await api.get(`/reports/excel?${params}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'allocations-report.xlsx')
      document.body.appendChild(link)
      link.click()
      toast.success('Excel exported successfully')
    } catch (error) {
      toast.error('Export failed')
    }
  }

  const filteredAllocations = useMemo(() => {
    if (!filters.search) return allocations
    const searchLower = filters.search.toLowerCase()
    return allocations.filter((alloc) => {
      const roomNumber = alloc.classroom?.roomNumber || alloc.exam?.classroom?.roomNumber || ''
      const block = alloc.classroom?.block || alloc.exam?.classroom?.block || ''

      return (
        alloc.faculty?.name?.toLowerCase().includes(searchLower) ||
        alloc.faculty?.employeeId?.toLowerCase().includes(searchLower) ||
        roomNumber.toLowerCase().includes(searchLower) ||
        block.toLowerCase().includes(searchLower)
      )
    })
  }, [allocations, filters.search])

  const groupedAllocations = useMemo(() => {
    const grouped = {}

    filteredAllocations.forEach((alloc) => {
      let classroom = null

      if (alloc.classroom) {
        if (typeof alloc.classroom === 'object' && alloc.classroom !== null && !Array.isArray(alloc.classroom)) {
          if (alloc.classroom.roomNumber || alloc.classroom._id) {
            classroom = alloc.classroom
          }
        }
      }

      if (!classroom && alloc.exam && alloc.exam.classroom) {
        if (typeof alloc.exam.classroom === 'object' && alloc.exam.classroom !== null && !Array.isArray(alloc.exam.classroom)) {
          if (alloc.exam.classroom.roomNumber || alloc.exam.classroom._id) {
            classroom = alloc.exam.classroom
          }
        }
      }

      if (!classroom) return

      const roomId = classroom._id?.toString() || (typeof classroom === 'string' ? classroom : null)
      if (!roomId) return

      const dateKey = new Date(alloc.date).toISOString().split('T')[0]
      const timeKey = `${alloc.startTime}-${alloc.endTime}`
      const key = `${roomId}-${dateKey}-${timeKey}`

      if (!grouped[key]) {
        grouped[key] = {
          exam: alloc.exam,
          date: alloc.date,
          startTime: alloc.startTime,
          endTime: alloc.endTime,
          classroom: classroom,
          faculty: [],
          status: alloc.status,
        }
      }

      if (alloc.faculty) {
        grouped[key].faculty.push(alloc.faculty)
      }
    })

    return Object.values(grouped).sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB
      }
      const timeA = a.startTime.split(':').map(Number)
      const timeB = b.startTime.split(':').map(Number)
      const timeCompare = timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1])
      if (timeCompare !== 0) {
        return timeCompare
      }
      const blockA = a.classroom?.block || ''
      const blockB = b.classroom?.block || ''
      if (blockA !== blockB) {
        return blockA.localeCompare(blockB)
      }
      const roomA = a.classroom?.roomNumber || ''
      const roomB = b.classroom?.roomNumber || ''
      return roomA.localeCompare(roomB)
    })
  }, [filteredAllocations])

  const handleNotifyAll = async () => {
    const totalFaculty = groupedAllocations.reduce((sum, group) => sum + group.faculty.length, 0)

    if (totalFaculty === 0) {
      toast.error('No allocations to notify')
      return
    }

    setConfirmDialog({
      open: true,
      message: `Are you sure you want to send email notifications to ${totalFaculty} faculty member(s) across ${groupedAllocations.length} room(s)?`,
      onConfirm: async () => {
        setNotifying(true)
        setConfirmDialog({ open: false, message: '', onConfirm: null })
        try {
          const params = new URLSearchParams()
          if (filters.campus) params.append('campus', filters.campus)
          if (filters.department) params.append('department', filters.department)

          toast.loading('Sending notifications...', { id: 'notify-all' })
          const response = await api.post(`/admin/allocations/notify-all?${params}`)

          if (response.data.success) {
            toast.success(response.data.message || 'Notifications sent successfully', { id: 'notify-all' })
          } else {
            toast.error(response.data.message || 'Failed to send notifications', { id: 'notify-all' })
          }

          fetchAllocations()
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to send notifications', { id: 'notify-all' })
        } finally {
          setNotifying(false)
        }
      },
    })
  }

  const handleFileSelect = async (type, file) => {
    if (!file) return

    try {
      toast.loading('Parsing file...', { id: 'preview-loading' })

      const formData = new FormData()
      formData.append('file', file)

      if (type === 'exam') {
        formData.append('examType', examType)
      }

      const endpoint = `/${type === 'exam' ? 'upload/exam-timetable' : type === 'classroom' ? 'upload/classrooms' : 'upload/faculty'}/preview`

      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      toast.dismiss('preview-loading')

      if (response.data.success && response.data.data) {
        const editableData =
          response.data.data.previewData?.map((item, index) => {
            const row = item.parsedData || item.rawData || {}
            const flatRow = {}
            Object.keys(row).forEach((key) => {
              if (typeof row[key] === 'object' && row[key] !== null && !Array.isArray(row[key])) {
                Object.keys(row[key]).forEach((nestedKey) => {
                  flatRow[nestedKey] = row[key][nestedKey]
                })
              } else {
                flatRow[key] = row[key]
              }
            })
            return {
              ...flatRow,
              _rowIndex: index,
              _isValid: item.isValid !== false,
              _errors: item.errors || [],
              _warnings: item.warnings || [],
            }
          }) || []

        setPreviewData((prev) => ({
          ...prev,
          [type]: {
            file,
            data: editableData,
            originalData: JSON.parse(JSON.stringify(editableData)),
          },
        }))
        toast.success(
          `Preview: ${response.data.data.validRows || editableData.length} valid, ${response.data.data.invalidRows || 0} invalid rows`
        )
      } else {
        toast.error('Failed to parse file')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error parsing file')
      console.error('Preview error:', error)
    }
  }

  const handleEdit = (type, index) => {
    setEditingRow({ type, index })
  }

  const handleSaveEdit = (type, index, updatedRow) => {
    setPreviewData((prev) => {
      const newData = { ...prev }
      if (newData[type]) {
        const updated = [...newData[type].data]
        updated[index] = { ...updated[index], ...updatedRow }
        newData[type] = { ...newData[type], data: updated }
      }
      return newData
    })
    setEditingRow(null)
    toast.success('Row updated')
  }

  const handleDelete = (type, index) => {
    setConfirmDialog({
      open: true,
      message: 'Are you sure you want to delete this row?',
      onConfirm: () => {
        setPreviewData((prev) => {
          const newData = { ...prev }
          if (newData[type]) {
            const updated = newData[type].data.filter((_, i) => i !== index)
            newData[type] = { ...newData[type], data: updated }
          }
          return newData
        })
        setConfirmDialog({ open: false, message: '', onConfirm: null })
        toast.success('Row deleted')
      },
    })
  }

  const handleSave = async (type) => {
    const preview = previewData[type]
    if (!preview || preview.data.length === 0) {
      toast.error('No data to save')
      return
    }

    const validData = preview.data.filter((row) => row._isValid !== false)
    if (validData.length === 0) {
      toast.error('No valid rows to save')
      return
    }

    setUploading({ ...uploading, [type]: true })

    try {
      const formData = new FormData()
      formData.append('file', preview.file)

      if (type === 'exam') {
        formData.append('examType', examType)
      }

      const endpoint = `/${type === 'exam' ? 'upload/exam-timetable' : type === 'classroom' ? 'upload/classrooms' : 'upload/faculty'}`
      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      toast.success(response.data.message)
      setPreviewData((prev) => ({ ...prev, [type]: null }))
      setEditingRow(null)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Save failed')
      console.error('Save error:', error)
    } finally {
      setUploading({ ...uploading, [type]: false })
    }
  }

  const handleCancelPreview = (type) => {
    setPreviewData((prev) => ({ ...prev, [type]: null }))
    setEditingRow(null)
  }

  const getTableHeaders = (type) => {
    if (type === 'exam') {
      return ['examId', 'examName', 'courseCode', 'courseName', 'date', 'startTime', 'endTime', 'examType', 'campus', 'department', 'roomNumber']
    } else if (type === 'classroom') {
      return ['roomNumber', 'block', 'floor', 'building', 'campus', 'capacity', 'department']
    } else {
      return ['name', 'email', 'employeeId', 'campus', 'department', 'subject', 'phone']
    }
  }

  const uploadSections = [
    {
      type: 'exam',
      title: 'Upload Exam Timetable',
      description: 'Upload CSV or Excel file containing exam schedule',
      accept: '.csv,.xlsx,.xls',
    },
    {
      type: 'classroom',
      title: 'Upload Classroom Details',
      description: 'Upload CSV or Excel file containing classroom information',
      accept: '.csv,.xlsx,.xls',
    },
    {
      type: 'faculty',
      title: 'Upload Faculty Details',
      description: 'Upload CSV or Excel file containing faculty information',
      accept: '.csv,.xlsx,.xls',
    },
  ]

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
              Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage allocations and upload files
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
              {/* Allocations Tab */}
              {activeTab === 1 && (
                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                    <Typography variant="h5" fontWeight={700}>
                      Allocations
                    </Typography>
                    <Box
                      sx={{
                        display: { xs: 'grid', md: 'flex' },
                        gridTemplateColumns: { xs: '1fr 1fr', md: 'none' },
                        gap: 1.5,
                        width: { xs: '100%', md: 'auto' },
                        '& > button': { width: { xs: '100%', md: 'auto' } }
                      }}
                    >
                      <Button
                        variant="contained"
                        startIcon={<ZapIcon />}
                        onClick={handleAutoAllocate}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Auto Allocate
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<MailIcon />}
                        onClick={handleNotifyAll}
                        disabled={notifying || groupedAllocations.length === 0}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        {notifying ? 'Sending...' : 'Notify All'}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleExportPDF}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Export PDF
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleExportExcel}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Export Excel
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchAllocations}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Refresh
                      </Button>
                    </Box>
                  </Box>

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
                          placeholder="Search allocations..."
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
                            onChange={(e) => setFilters({ ...filters, campus: e.target.value, department: '' })}
                          >
                            <MenuItem value="">All Campuses</MenuItem>
                            {campuses.map((campus) => (
                              <MenuItem key={campus} value={campus}>
                                {campus}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Department</InputLabel>
                          <Select
                            value={filters.department}
                            label="Department"
                            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                            disabled={!filters.campus}
                          >
                            <MenuItem value="">All Departments</MenuItem>
                            {departments.map((dept) => (
                              <MenuItem key={dept} value={dept}>
                                {dept}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Allocations Grid */}
                  {loading.allocations ? (
                    <Card sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Box display="flex" justifyContent="center" py={8}>
                          <CircularProgress />
                        </Box>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: 'repeat(2, 1fr)', // Force 2 columns on mobile
                            sm: 'repeat(2, 1fr)',
                            md: 'repeat(3, 1fr)', // Force 3 columns on laptop
                            lg: 'repeat(3, 1fr)',
                            xl: 'repeat(4, 1fr)'
                          },
                          gap: { xs: 1, sm: 2, md: 3 },
                          width: '100%'
                        }}
                      >
                        {groupedAllocations.map((group, index) => (
                          <Box key={index} sx={{ minWidth: 0 }}>
                            <Grow in timeout={600} style={{ transitionDelay: `${index * 30}ms`, width: '100%', display: 'flex' }}>
                              <AllocationCard sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                                <CardContent sx={{ p: { xs: 1, sm: 2 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={{ xs: 1, sm: 2 }}>
                                    <Box>
                                      <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '0.75rem', sm: '1.125rem' }, mb: 0.5, lineHeight: 1.2 }}>
                                        {group.classroom?.block || 'N/A'} - {group.classroom?.roomNumber || 'N/A'}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                                        {new Date(group.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                      </Typography>
                                    </Box>
                                    <StatusChip
                                      label={group.status}
                                      status={group.status}
                                      size="small"
                                      sx={{
                                        height: { xs: 20, sm: 28 },
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        '& .MuiChip-label': { px: { xs: 1, sm: 1.5 } }
                                      }}
                                    />
                                  </Box>

                                  <Box
                                    sx={{
                                      bgcolor: alpha('#1a56db', 0.05),
                                      p: { xs: 0.75, sm: 1.5 },
                                      borderRadius: 2,
                                      mb: { xs: 1, sm: 2 },
                                    }}
                                  >
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={{ xs: 0.5, sm: 1 }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                                        Time Slot
                                      </Typography>
                                      <Typography variant="body2" fontWeight={700} fontFamily="monospace" sx={{ fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>
                                        {group.startTime} - {group.endTime}
                                      </Typography>
                                    </Box>
                                    <Box display="flex" gap={{ xs: 1, sm: 2 }}>
                                      <Box>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                                          Block
                                        </Typography>
                                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}>
                                          {group.classroom?.block || 'N/A'}
                                        </Typography>
                                      </Box>
                                      <Box>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
                                          Room
                                        </Typography>
                                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}>
                                          {group.classroom?.roomNumber || 'N/A'}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </Box>

                                  <Box sx={{ borderTop: `1px solid ${alpha('#e2e8f0', 0.5)}`, pt: { xs: 1, sm: 1.5 } }}>
                                    <Typography variant="caption" fontWeight={700} display="block" mb={1} sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      Assigned Faculty ({group.faculty.length})
                                    </Typography>
                                    {group.faculty.length > 0 ? (
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                        {group.faculty.map((faculty, idx) => (
                                          <Box
                                            key={idx}
                                            sx={{
                                              bgcolor: 'background.paper',
                                              border: `1px solid ${alpha('#e2e8f0', 0.5)}`,
                                              px: { xs: 1, sm: 1.25 },
                                              py: { xs: 0.5, sm: 0.75 },
                                              borderRadius: 1.5,
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              minWidth: 0
                                            }}
                                          >
                                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem' }, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                              {faculty.name || 'N/A'}
                                            </Typography>
                                            {faculty.employeeId && (
                                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, ml: 1, flexShrink: 0 }}>
                                                {faculty.employeeId}
                                              </Typography>
                                            )}
                                          </Box>
                                        ))}
                                      </Box>
                                    ) : (
                                      <Typography variant="caption" color="text.secondary" fontStyle="italic" sx={{ fontSize: '0.75rem' }}>
                                        No faculty assigned
                                      </Typography>
                                    )}
                                  </Box>
                                </CardContent>
                              </AllocationCard>
                            </Grow>
                          </Box>
                        ))}
                      </Box>

                      {groupedAllocations.length === 0 && allocations.length > 0 && (
                        <Card sx={{ mt: 3, borderRadius: 3 }}>
                          <CardContent>
                            <Box textAlign="center" py={4}>
                              <Typography variant="body1" color="text.secondary" gutterBottom>
                                No allocations with room information found
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Total allocations: {allocations.length}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      )}

                      {allocations.length === 0 && (
                        <Card sx={{ mt: 3, borderRadius: 3 }}>
                          <CardContent>
                            <Box textAlign="center" py={8}>
                              <Typography variant="body1" color="text.secondary">
                                No allocations found
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </Box>
              )}

              {/* Uploads Tab */}
              {activeTab === 0 && (
                <Box>
                  {/* Exam Type Selection */}
                  <Card sx={{ mb: 3, borderRadius: 3 }}>
                    <CardContent>
                      <Typography variant="h6" fontWeight={700} gutterBottom>
                        Select Exam Type for Upload
                      </Typography>
                      <FormControl component="fieldset" sx={{ mb: 3 }}>
                        <RadioGroup
                          row
                          value={examType}
                          onChange={(e) => setExamType(e.target.value)}
                          sx={{ gap: 3 }}
                        >
                          <FormControlLabel value="mid-term" control={<Radio />} label="Mid-Term Examinations" />
                          <FormControlLabel value="semester" control={<Radio />} label="Semester Examination" />
                          <FormControlLabel value="labs" control={<Radio />} label="Labs (External/Internal)" />
                        </RadioGroup>
                      </FormControl>
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                          Auto Allocation Logic:
                        </Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                          <li>
                            <Typography variant="body2">
                              <strong>Mid-Term & Semester:</strong> Any 2 faculties per class
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2">
                              <strong>Labs:</strong> 1 same subject teacher + 1 any faculty per class
                            </Typography>
                          </li>
                        </Box>
                      </Alert>
                    </CardContent>
                  </Card>

                  {/* Upload Sections */}
                  <Box sx={{ display: 'flex', gap: 2.5, mb: 3, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                    {uploadSections.map((section) => (
                      <Box key={section.type} sx={{ flex: { xs: '1 1 100%', md: '1 1 0' }, minWidth: 0, display: 'flex' }}>
                        <Card sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
                          <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <Box display="flex" alignItems="flex-start" gap={1.5} mb={1.5}>
                              <Box
                                sx={{
                                  p: 1,
                                  bgcolor: alpha('#1a56db', 0.1),
                                  borderRadius: 1.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: 40,
                                  height: 40,
                                  flexShrink: 0,
                                }}
                              >
                                <FileTextIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                              </Box>
                              <Box flex={1}>
                                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, fontSize: '0.9375rem' }}>
                                  {section.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
                                  {section.description}
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                              {previewData[section.type] && (
                                <Box
                                  sx={{
                                    bgcolor: alpha('#06b6d4', 0.1),
                                    p: 1,
                                    borderRadius: 1.5,
                                    mb: 1.5,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
                                    {previewData[section.type].data.length} row(s)
                                  </Typography>
                                  <Box display="flex" gap={0.5}>
                                    <Button
                                      size="small"
                                      onClick={() => handleCancelPreview(section.type)}
                                      sx={{ textTransform: 'none', minWidth: 'auto', px: 1, py: 0.5, fontSize: '0.75rem' }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="success"
                                      onClick={() => handleSave(section.type)}
                                      disabled={uploading[section.type]}
                                      sx={{ textTransform: 'none', minWidth: 'auto', px: 1, py: 0.5, fontSize: '0.75rem' }}
                                    >
                                      {uploading[section.type] ? 'Saving...' : 'Save'}
                                    </Button>
                                  </Box>
                                </Box>
                              )}
                            </Box>

                            <Box>
                              <input
                                type="file"
                                accept={section.accept}
                                onChange={(e) => {
                                  const file = e.target.files[0]
                                  if (file) handleFileSelect(section.type, file)
                                  e.target.value = ''
                                }}
                                style={{ display: 'none' }}
                                id={`upload-${section.type}`}
                                disabled={uploading[section.type]}
                              />
                              <label htmlFor={`upload-${section.type}`}>
                                <Button
                                  variant="contained"
                                  component="span"
                                  fullWidth
                                  size="small"
                                  startIcon={<UploadIcon />}
                                  disabled={uploading[section.type]}
                                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8125rem', py: 0.75 }}
                                >
                                  Choose File
                                </Button>
                              </label>
                            </Box>

                            <Box mt={1.5} sx={{ minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                              <Typography variant="caption" fontWeight={600} display="block" mb={0.5} sx={{ fontSize: '0.7rem' }}>
                                Required Fields:
                              </Typography>
                              {section.type === 'exam' && (
                                <Typography variant="caption" color="text.secondary" component="div" sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}>
                                  examId, examName, courseCode, courseName, date, startTime, endTime, examType, campus, department
                                </Typography>
                              )}
                              {section.type === 'classroom' && (
                                <Typography variant="caption" color="text.secondary" component="div" sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}>
                                  roomNumber, block, floor, campus, capacity
                                </Typography>
                              )}
                              {section.type === 'faculty' && (
                                <Typography variant="caption" color="text.secondary" component="div" sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}>
                                  name, email, campus, subject
                                </Typography>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Box>
                    ))}
                  </Box>

                  {/* Preview Tables */}
                  {Object.entries(previewData).map(([type, preview]) => {
                    if (!preview) return null

                    const headers = getTableHeaders(type)
                    const isEditing = editingRow?.type === type

                    return (
                      <Card key={type} sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6" fontWeight={700}>
                              Preview: {uploadSections.find((s) => s.type === type)?.title}
                            </Typography>
                            <Box display="flex" gap={1}>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleCancelPreview(type)}
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleSave(type)}
                                disabled={uploading[type]}
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                              >
                                {uploading[type] ? 'Saving...' : 'Save All'}
                              </Button>
                            </Box>
                          </Box>
                          <TableContainer>
                            <Table size="small">
                              <StyledTableHead>
                                <TableRow>
                                  <StyledTableCell>Actions</StyledTableCell>
                                  {headers.map((header) => (
                                    <StyledTableCell key={header}>{header}</StyledTableCell>
                                  ))}
                                </TableRow>
                              </StyledTableHead>
                              <TableBody>
                                {preview.data.map((row, index) => {
                                  const isRowEditing = isEditing && editingRow.index === index

                                  return (
                                    <StyledTableRow key={index} error={row._isValid === false}>
                                      <StyledTableCell>
                                        {isRowEditing ? (
                                          <Box display="flex" gap={0.5}>
                                            <IconButton
                                              size="small"
                                              color="success"
                                              onClick={() => {
                                                const updated = {}
                                                headers.forEach((header) => {
                                                  const input = document.getElementById(`${type}-${index}-${header}`)
                                                  if (input) updated[header] = input.value
                                                })
                                                handleSaveEdit(type, index, updated)
                                              }}
                                            >
                                              <CheckIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() => setEditingRow(null)}
                                            >
                                              <CancelIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        ) : (
                                          <Box display="flex" gap={0.5}>
                                            <IconButton
                                              size="small"
                                              color="primary"
                                              onClick={() => handleEdit(type, index)}
                                            >
                                              <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() => handleDelete(type, index)}
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        )}
                                      </StyledTableCell>
                                      {headers.map((header) => {
                                        const value = row[header]
                                        const displayValue = value !== null && value !== undefined ? String(value) : '-'
                                        return (
                                          <StyledTableCell key={header}>
                                            {isRowEditing ? (
                                              <TextField
                                                id={`${type}-${index}-${header}`}
                                                defaultValue={displayValue}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.875rem' } }}
                                              />
                                            ) : (
                                              <Typography
                                                variant="body2"
                                                color={row._isValid === false ? 'error' : 'text.primary'}
                                              >
                                                {displayValue}
                                                {row._errors && row._errors.length > 0 && (
                                                  <Typography component="span" color="error.main" title={row._errors.join(', ')}>
                                                    {' '}
                                                    ⚠
                                                  </Typography>
                                                )}
                                              </Typography>
                                            )}
                                          </StyledTableCell>
                                        )
                                      })}
                                    </StyledTableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </CardContent>
                      </Card>
                    )
                  })}
                </Box>
              )}
            </Box>
          </Grow>

          {/* Confirm Dialog */}
          <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, message: '', onConfirm: null })}>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogContent>
              <DialogContentText>{confirmDialog.message}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmDialog({ open: false, message: '', onConfirm: null })} sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (confirmDialog.onConfirm) confirmDialog.onConfirm()
                }}
                variant="contained"
                sx={{ textTransform: 'none' }}
              >
                Confirm
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Fade>
    </Layout>
  )
}

export default AdminManage
