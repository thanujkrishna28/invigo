import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import api from '../../utils/api'
import { Calendar, FileText, Filter, ChevronDown, ChevronUp, Clock, MapPin, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import moment from 'moment'

const AdminAllocationLogs = () => {
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    examType: '',
    campus: '',
    department: ''
  })

  useEffect(() => {
    fetchAllocations()
  }, [filters])

  const fetchAllocations = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await api.get(`/admin/allocations?${params}`)
      let filtered = response.data.data || []

      // Filter by exam type if selected
      if (filters.examType) {
        filtered = filtered.filter(alloc =>
          alloc.exam?.examType === filters.examType
        )
      }

      setAllocations(filtered)
    } catch (error) {
      console.error('Error fetching allocations:', error)
      toast.error('Error fetching allocation logs')
    } finally {
      setLoading(false)
    }
  }

  // Group allocations by date and exam type
  const groupAllocations = () => {
    const grouped = {}

    allocations.forEach(alloc => {
      const date = moment(alloc.date).format('YYYY-MM-DD')
      const examType = alloc.exam?.examType || 'semester'
      const key = `${date}_${examType}`

      if (!grouped[key]) {
        grouped[key] = {
          date,
          examType,
          allocations: []
        }
      }

      grouped[key].allocations.push(alloc)
    })

    // Sort by date (newest first) and exam type
    return Object.values(grouped).sort((a, b) => {
      const dateCompare = moment(b.date).diff(moment(a.date))
      if (dateCompare !== 0) return dateCompare

      const typeOrder = { 'mid-term': 1, 'semester': 2, 'labs': 3 }
      return (typeOrder[a.examType] || 99) - (typeOrder[b.examType] || 99)
    })
  }

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const getExamTypeLabel = (type) => {
    const labels = {
      'mid-term': 'Mid-Term',
      'semester': 'Semester',
      'labs': 'Labs'
    }
    return labels[type] || type
  }

  const getExamTypeColor = (type) => {
    const colors = {
      'mid-term': 'bg-blue-100 text-blue-800 border-blue-300',
      'semester': 'bg-purple-100 text-purple-800 border-purple-300',
      'labs': 'bg-green-100 text-green-800 border-green-300'
    }
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const groupedAllocations = groupAllocations()

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-12 h-12"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="section-title">Allocation Logs</h1>
          <p className="page-subtitle mt-1">View all allocations organized by date and exam type</p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exam Type
              </label>
              <select
                value={filters.examType}
                onChange={(e) => setFilters({ ...filters, examType: e.target.value })}
                className="input-field"
              >
                <option value="">All Types</option>
                <option value="mid-term">Mid-Term</option>
                <option value="semester">Semester</option>
                <option value="labs">Labs</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campus
              </label>
              <input
                type="text"
                value={filters.campus}
                onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
                placeholder="Filter by campus"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                placeholder="Filter by department"
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Allocations</p>
                <p className="text-2xl font-bold text-blue-900">{allocations.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Date Groups</p>
                <p className="text-2xl font-bold text-purple-900">{groupedAllocations.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Mid-Term Exams</p>
                <p className="text-2xl font-bold text-green-900">
                  {allocations.filter(a => a.exam?.examType === 'mid-term').length}
                </p>
              </div>
              <FileText className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Semester Exams</p>
                <p className="text-2xl font-bold text-orange-900">
                  {allocations.filter(a => a.exam?.examType === 'semester').length}
                </p>
              </div>
              <FileText className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Allocations by Date and Exam Type */}
        <div className="space-y-4">
          {groupedAllocations.length === 0 ? (
            <div className="card text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No allocations found</p>
              <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            groupedAllocations.map((group, index) => {
              const groupKey = `${group.date}_${group.examType}`
              const isExpanded = expandedGroups[groupKey] !== false // Default to expanded

              return (
                <div key={groupKey} className="card">
                  {/* Group Header */}
                  <div
                    className="flex items-center justify-between cursor-pointer hover:bg-primary-50/60 p-4 rounded-xl transition-colors"
                    onClick={() => toggleGroup(groupKey)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-full border text-sm font-semibold ${getExamTypeColor(group.examType)}`}>
                        {getExamTypeLabel(group.examType)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {moment(group.date).format('DD MMMM YYYY')}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {moment(group.date).format('dddd')} • {group.allocations.length} allocation{group.allocations.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {isExpanded ? 'Hide' : 'Show'} Details
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  </div>

                  {/* Group Content */}
                  {isExpanded && (
                    <div className="mt-4 border-t pt-4">
                      <div className="grid grid-cols-1 gap-3">
                        {group.allocations.map((alloc, idx) => {
                          const classroom = alloc.classroom || alloc.exam?.classroom
                          return (
                            <div
                              key={alloc._id || idx}
                              className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Exam Info */}
                                <div className="flex items-start gap-3">
                                  <FileText className="w-5 h-5 text-primary-600 mt-0.5" />
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      {alloc.exam?.examName || 'N/A'}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {alloc.exam?.courseCode || 'N/A'}
                                    </p>
                                  </div>
                                </div>

                                {/* Time & Location */}
                                <div className="flex items-start gap-3">
                                  <Clock className="w-5 h-5 text-primary-600 mt-0.5" />
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      {alloc.startTime} - {alloc.endTime}
                                    </p>
                                    {classroom && (
                                      <p className="text-sm text-gray-600 flex items-center gap-1">
                                        <MapPin className="w-4 h-4" />
                                        {classroom.block} - Room {classroom.roomNumber}
                                        {classroom.floor && ` (Floor ${classroom.floor})`}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Faculty */}
                                <div className="flex items-start gap-3">
                                  <Users className="w-5 h-5 text-primary-600 mt-0.5" />
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      {alloc.faculty?.name || 'N/A'}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {alloc.faculty?.employeeId || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Additional Info */}
                              <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-500">Campus:</span>
                                  <span className="ml-2 font-medium text-gray-900">{alloc.campus || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Department:</span>
                                  <span className="ml-2 font-medium text-gray-900">{alloc.department || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Status:</span>
                                  <span className={`ml-2 font-medium ${alloc.status === 'assigned' ? 'text-green-600' :
                                    alloc.status === 'cancelled' ? 'text-red-600' :
                                      'text-gray-600'
                                    }`}>
                                    {alloc.status || 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Notified:</span>
                                  <span className={`ml-2 font-medium ${alloc.notified ? 'text-green-600' : 'text-gray-600'}`}>
                                    {alloc.notified ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </Layout>
  )
}

export default AdminAllocationLogs

