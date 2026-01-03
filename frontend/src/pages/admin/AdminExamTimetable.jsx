import { useState, useEffect, useMemo } from 'react'
import Layout from '../../components/Layout'
import api from '../../utils/api'
import { Download, Send, Calendar, Search, Upload, FileText, AlertCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

const AdminExamTimetable = () => {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [filters, setFilters] = useState({
    campus: '',
    department: '',
    semester: '',
    search: ''
  })
  const [campuses, setCampuses] = useState([])
  const [departments, setDepartments] = useState([])

  const [uploading, setUploading] = useState(false)
  const [uploadErrors, setUploadErrors] = useState(null)
  const [examType, setExamType] = useState('') // Empty by default - no selection
  const [displayExamType, setDisplayExamType] = useState(null) // For displaying in timetable

  useEffect(() => {
    fetchCampuses()
    fetchDepartments()
  }, [])

  useEffect(() => {
    if (filters.campus) {
      fetchDepartments()
    }
  }, [filters.campus])

  useEffect(() => {
    fetchExams()
  }, [filters.campus, filters.department, examType]) // Add examType to dependencies

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

  const fetchExams = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)
      if (examType) params.append('examType', examType)

      const response = await api.get(`/admin/timetable?${params}`)
      const examsData = response.data.data || []

      if (examsData.length > 0 && examsData[0].examType) {
        setDisplayExamType(examsData[0].examType)
      } else {
        setDisplayExamType(null)
      }

      setExams(examsData)
    } catch (error) {
      toast.error('Error fetching exams')
    } finally {
      setLoading(false)
    }
  }

  const filteredExams = useMemo(() => {
    if (!filters.search) return exams
    const searchLower = filters.search.toLowerCase()
    return exams.filter(exam =>
      exam.examName?.toLowerCase().includes(searchLower) ||
      exam.courseCode?.toLowerCase().includes(searchLower) ||
      exam.courseName?.toLowerCase().includes(searchLower) ||
      exam.department?.toLowerCase().includes(searchLower)
    )
  }, [exams, filters.search])

  const groupedExams = useMemo(() => {
    const grouped = {}

    filteredExams.forEach(exam => {
      const date = new Date(exam.date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      const dept = exam.department || 'Other'

      if (!grouped[date]) {
        grouped[date] = {}
      }

      if (!grouped[date][dept]) {
        grouped[date][dept] = []
      }

      grouped[date][dept].push(exam)
    })

    return grouped
  }, [filteredExams])

  const getUniqueDates = () => {
    return Object.keys(groupedExams).sort((a, b) => {
      const dateA = new Date(a.split('/').reverse().join('-'))
      const dateB = new Date(b.split('/').reverse().join('-'))
      return dateA - dateB
    })
  }

  const getUniqueDepartments = () => {
    const depts = new Set()
    Object.values(groupedExams).forEach(dateExams => {
      Object.keys(dateExams).forEach(dept => depts.add(dept))
    })
    return Array.from(depts).sort()
  }

  const formatDateHeader = (dateStr) => {
    const date = new Date(dateStr.split('/').reverse().join('-'))
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
    return `${dateStr} (${dayName})`
  }

  const handleDownloadPDF = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await api.get(`/admin/timetable/pdf?${params}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'exam-timetable.pdf')
      document.body.appendChild(link)
      link.click()
      toast.success('Timetable PDF downloaded successfully')
    } catch (error) {
      toast.error('Failed to download PDF')
    }
  }

  const handleDownloadImage = async () => {
    try {
      // Use html2canvas to capture the timetable table as image
      let html2canvas
      try {
        html2canvas = (await import('html2canvas')).default
      } catch (importError) {
        toast.error('html2canvas not installed. Please run: npm install html2canvas')
        return
      }

      // Find the timetable card container by ID
      const timetableContainer = document.getElementById('timetable-container')
      const tableElement = document.querySelector('table.min-w-full')

      const elementToCapture = timetableContainer || tableElement

      if (!elementToCapture) {
        toast.error('Timetable not found')
        return
      }

      toast.loading('Generating image...', { id: 'image-gen' })

      const canvas = await html2canvas(elementToCapture, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        windowWidth: elementToCapture.scrollWidth,
        windowHeight: elementToCapture.scrollHeight
      })

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', 'exam-timetable.jpg')
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          toast.success('Timetable image downloaded successfully', { id: 'image-gen' })
        } else {
          toast.error('Failed to generate image', { id: 'image-gen' })
        }
      }, 'image/jpeg', 0.9)
    } catch (error) {
      console.error('Image generation error:', error)
      toast.error(`Failed to download image: ${error.message}`, { id: 'image-gen' })
    }
  }

  const handleNotifyFaculty = async () => {
    try {
      setSending(true)
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await api.post(`/admin/timetable/notify?${params}`)
      toast.success(response.data.message || 'Timetable sent to all faculty successfully')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send notifications')
    } finally {
      setSending(false)
    }
  }

  const handleUpload = async (file) => {
    if (!file) {
      toast.error('Please select a file')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('examType', examType)

    setUploading(true)
    setUploadErrors(null)

    try {
      const response = await api.post('/upload/exam-timetable-prep', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      toast.success(response.data.message)

      if (response.data.warnings && response.data.warnings.length > 0) {
        setUploadErrors({
          count: response.data.warnings.length,
          errors: response.data.warnings,
          message: response.data.message
        })
      } else {
        setUploadErrors(null)
      }

      // Refresh the timetable and update exam type
      setDisplayExamType(examType) // Set from selected exam type
      fetchExams()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const dates = getUniqueDates()
  const timetableDepartments = getUniqueDepartments() // Renamed to avoid conflict with state variable

  // Get exam type label for display
  const getExamTypeLabel = () => {
    if (displayExamType === 'mid-term') {
      return 'MID-TERM EXAMINATIONS'
    } else if (displayExamType === 'semester') {
      return 'SEMESTER EXAMINATIONS'
    }
    return 'EXAM TIMETABLE'
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="section-title text-2xl sm:text-3xl">Exam Timetable Preparation</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Prepare examination schedules for all courses and semesters department wise</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <button
              onClick={handleNotifyFaculty}
              disabled={sending || dates.length === 0}
              className="btn-primary flex items-center justify-center space-x-2 min-h-[44px] text-sm sm:text-base px-3 sm:px-4"
            >
              <Send className="w-4 h-4" />
              <span className="hidden xs:inline">{sending ? 'Sending...' : 'Notify All Faculty'}</span>
              <span className="xs:hidden">Notify</span>
            </button>
            <button onClick={handleDownloadPDF} className="btn-secondary flex items-center justify-center space-x-2 min-h-[44px] text-sm sm:text-base px-3 sm:px-4">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button onClick={handleDownloadImage} className="btn-secondary flex items-center justify-center space-x-2 min-h-[44px] text-sm sm:text-base px-3 sm:px-4">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download Image</span>
              <span className="sm:hidden">Image</span>
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Upload Exam Timetable</h3>
              <p className="text-sm text-gray-600">Upload CSV or Excel file containing exam timetable schedule</p>
            </div>
          </div>

          {/* Exam Type Selection */}
          <div className="mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Select Exam Type</h4>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
              <label className="flex items-center space-x-2 cursor-pointer min-h-[44px] py-2">
                <input
                  type="radio"
                  name="examType"
                  value="mid-term"
                  checked={examType === 'mid-term'}
                  onChange={(e) => {
                    setExamType(e.target.value)
                    setDisplayExamType(null) // Clear display until data loads
                  }}
                  className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm sm:text-base font-medium text-gray-700">Mid-Term Examinations</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer min-h-[44px] py-2">
                <input
                  type="radio"
                  name="examType"
                  value="semester"
                  checked={examType === 'semester'}
                  onChange={(e) => {
                    setExamType(e.target.value)
                    setDisplayExamType(null) // Clear display until data loads
                  }}
                  className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm sm:text-base font-medium text-gray-700">Semester Examination</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer min-h-[44px] py-2">
                <input
                  type="radio"
                  name="examType"
                  value=""
                  checked={examType === ''}
                  onChange={(e) => {
                    setExamType('')
                    setDisplayExamType(null)
                  }}
                  className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm sm:text-base font-medium text-gray-700">None (Clear Selection)</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Note: No same subjects allowed for any department on the same date/time to avoid conflicts.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files[0]
                if (file) handleUpload(file)
              }}
              className="hidden"
              id="timetable-upload"
              disabled={uploading}
            />
            <label
              htmlFor="timetable-upload"
              className={`btn-primary flex items-center space-x-2 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Uploading...' : 'Choose File'}</span>
            </label>
            <div className="text-xs text-gray-500">
              <p className="font-medium mb-1">Required Fields:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>examName (Exam Name)</li>
                <li>courseCode (Exam Code)</li>
                <li>startTime, endTime (Time)</li>
                <li>date (Date)</li>
                <li>department (Branch)</li>
              </ul>
            </div>
          </div>

          {/* Upload Errors */}
          {uploadErrors && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-semibold text-yellow-900">
                    {uploadErrors.message} - {uploadErrors.count} error(s) found
                  </h3>
                </div>
                <button
                  onClick={() => setUploadErrors(null)}
                  className="text-yellow-600 hover:text-yellow-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="bg-white rounded p-3 max-h-48 overflow-y-auto">
                <ul className="space-y-1 text-sm">
                  {uploadErrors.errors.map((error, index) => (
                    <li key={index} className="text-gray-700 font-mono text-xs">
                      <span className="text-yellow-600 font-semibold">•</span> {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
              <input
                type="text"
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input-field pl-10 min-h-[44px] text-base"
              />
            </div>
            <select
              value={filters.campus}
              onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
              className="input-field min-h-[44px] text-base"
            >
              <option value="">All Campuses</option>
              {campuses.map((campus) => (
                <option key={campus} value={campus}>
                  {campus}
                </option>
              ))}
            </select>
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="input-field min-h-[44px] text-base"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timetable Table */}
        <div className="card" id="timetable-container">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner w-8 h-8"></div>
            </div>
          ) : dates.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No exams scheduled. Upload exam timetable to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Exam Type Heading */}
              {displayExamType && (
                <div className="mb-6 text-center pb-4 border-b-2 border-primary-200">
                  <h2 className="text-3xl font-bold text-primary-600 uppercase tracking-wide">
                    {getExamTypeLabel()}
                  </h2>
                </div>
              )}

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-primary-500 to-primary-600">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-white uppercase tracking-wider sticky left-0 bg-primary-600 z-10">
                          <span className="hidden sm:inline">Date & Branch</span>
                          <span className="sm:hidden">Branch</span>
                        </th>
                        {dates.map((date) => (
                          <th
                            key={date}
                            className="px-2 sm:px-6 py-3 sm:py-4 text-center text-xs font-bold text-white uppercase tracking-wider min-w-[140px] sm:min-w-[180px]"
                          >
                            <div className="flex flex-col">
                              <span className="text-xs sm:text-sm">{formatDateHeader(date).split(' ')[0]}</span>
                              <span className="text-[10px] sm:text-xs opacity-90 hidden sm:inline">{formatDateHeader(date).split(' ')[1]}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {timetableDepartments.map((dept) => (
                        <tr key={dept} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200">
                            {dept}
                          </td>
                          {dates.map((date) => {
                            const deptExams = groupedExams[date]?.[dept] || []
                            return (
                              <td key={`${dept}-${date}`} className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700">
                                {deptExams.length === 0 ? (
                                  <span className="text-gray-400 text-xs">--</span>
                                ) : (
                                  <div className="space-y-1.5 sm:space-y-2">
                                    {deptExams.map((exam, idx) => (
                                      <div
                                        key={exam._id || idx}
                                        className="p-1.5 sm:p-2 bg-primary-50 rounded-lg border border-primary-200"
                                      >
                                        <p className="font-semibold text-gray-900 text-[10px] sm:text-xs leading-tight">
                                          {exam.examName || exam.courseName}
                                        </p>
                                        <p className="text-[10px] sm:text-xs text-gray-600">
                                          ({exam.courseCode})
                                        </p>
                                        <p className="text-[10px] sm:text-xs text-primary-600 mt-0.5 sm:mt-1">
                                          {exam.startTime} - {exam.endTime}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default AdminExamTimetable

