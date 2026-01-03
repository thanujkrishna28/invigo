import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Download, Search, Zap, Mail, X, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const AdminAllocations = () => {
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [notifying, setNotifying] = useState(false)
  const [filters, setFilters] = useState({
    campus: '',
    department: '',
    search: ''
  })
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [facultySearch, setFacultySearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetchAllocations()
  }, [filters])

  const fetchAllocations = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await axios.get(`/api/admin/allocations?${params}`)
      let filtered = response.data.data

      if (filters.search) {
        filtered = filtered.filter(alloc =>
          alloc.faculty?.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          alloc.exam?.examName.toLowerCase().includes(filters.search.toLowerCase()) ||
          alloc.exam?.classroom?.roomNumber?.toLowerCase().includes(filters.search.toLowerCase()) ||
          alloc.exam?.classroom?.block?.toLowerCase().includes(filters.search.toLowerCase())
        )
      }

      setAllocations(filtered)

      // Debug: Log blocks distribution
      const blocksCount = {}
      filtered.forEach(alloc => {
        const block = alloc.classroom?.block || alloc.exam?.classroom?.block || 'Unknown'
        blocksCount[block] = (blocksCount[block] || 0) + 1
      })
      console.log('📊 Allocations by block:', blocksCount)
      console.log('📊 Total allocations:', filtered.length)
    } catch (error) {
      toast.error('Error fetching allocations')
    } finally {
      setLoading(false)
    }
  }

  // Group allocations by classroom (same room, date, time)
  const groupAllocationsByRoom = () => {
    const grouped = {}
    let skippedCount = 0
    const skippedByReason = { noClassroom: 0, noRoomId: 0, stringId: 0 }

    allocations.forEach(alloc => {
      // Get classroom - check allocation.classroom first (new way), then exam.classroom (old way)
      let classroom = null

      // Check allocation.classroom (direct reference)
      if (alloc.classroom) {
        if (typeof alloc.classroom === 'object' && alloc.classroom !== null && !Array.isArray(alloc.classroom)) {
          // Check if it has roomNumber or _id (populated or just ID)
          if (alloc.classroom.roomNumber || alloc.classroom._id) {
            classroom = alloc.classroom
          }
        } else if (typeof alloc.classroom === 'string') {
          // If it's a string ID, we can't use it for grouping (needs to be populated)
          skippedByReason.stringId++
          return
        }
      }

      // Fallback to exam.classroom (for backward compatibility)
      if (!classroom && alloc.exam && alloc.exam.classroom) {
        if (typeof alloc.exam.classroom === 'object' && alloc.exam.classroom !== null && !Array.isArray(alloc.exam.classroom)) {
          if (alloc.exam.classroom.roomNumber || alloc.exam.classroom._id) {
            classroom = alloc.exam.classroom
          }
        }
      }

      // If no classroom data, skip this allocation
      if (!classroom) {
        skippedByReason.noClassroom++
        return
      }

      // Use classroom ID for grouping (same room, date, time)
      const roomId = classroom._id?.toString() || (typeof classroom === 'string' ? classroom : null)
      if (!roomId) {
        skippedByReason.noRoomId++
        return
      }

      const dateKey = new Date(alloc.date).toISOString().split('T')[0]
      const timeKey = `${alloc.startTime}-${alloc.endTime}`

      // Create a unique key for each room-date-time combination
      const key = `${roomId}-${dateKey}-${timeKey}`

      if (!grouped[key]) {
        grouped[key] = {
          exam: alloc.exam || null,
          date: alloc.date,
          startTime: alloc.startTime,
          endTime: alloc.endTime,
          classroom: classroom,
          faculty: [],
          status: alloc.status
        }
      }

      if (alloc.faculty) {
        grouped[key].faculty.push(alloc.faculty)
      }
    })

    const groupedArray = Object.values(grouped)

    // Debug: Log grouped blocks
    const groupedBlocksCount = {}
    groupedArray.forEach(group => {
      const block = group.classroom?.block || 'Unknown'
      groupedBlocksCount[block] = (groupedBlocksCount[block] || 0) + 1
    })
    console.log('📊 Grouped allocations by block:', groupedBlocksCount)
    console.log('📊 Total grouped:', groupedArray.length)
    console.log('📊 Skipped allocations:', skippedByReason)

    return groupedArray.sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB
      }
      return a.startTime.localeCompare(b.startTime)
    })
  }

  const handleAutoAllocate = async () => {
    try {
      const response = await axios.post('/api/admin/allocate', {})
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

      const response = await axios.get(`/api/reports/pdf?${params}`, {
        responseType: 'blob'
      })

      // Create blob with proper MIME type
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'allocations-report.pdf')
      document.body.appendChild(link)
      link.click()

      // Clean up
      setTimeout(() => {
        link.remove()
        window.URL.revokeObjectURL(url)
      }, 100)

      toast.success('PDF exported successfully')
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error('Export failed: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await axios.get(`/api/reports/excel?${params}`, {
        responseType: 'blob'
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

  const handleNotifyAll = async () => {
    const groupedAllocations = groupAllocationsByRoom()
    const totalFaculty = groupedAllocations.reduce((sum, group) => sum + group.faculty.length, 0)

    if (totalFaculty === 0) {
      toast.error('No allocations to notify')
      return
    }

    if (!confirm(`Are you sure you want to send email notifications to ${totalFaculty} faculty member(s) across ${groupedAllocations.length} room(s)?`)) {
      return
    }

    setNotifying(true)
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      toast.loading('Sending notifications...', { id: 'notify-all' })
      const response = await axios.post(`/api/admin/allocations/notify-all?${params}`)

      if (response.data.success) {
        toast.success(response.data.message || 'Notifications sent successfully', { id: 'notify-all' })
      } else {
        toast.error(response.data.message || 'Failed to send notifications', { id: 'notify-all' })
      }

      fetchAllocations() // Refresh to update notified status
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send notifications', { id: 'notify-all' })
    } finally {
      setNotifying(false)
    }
  }

  const handleOpenAddFacultyModal = (group) => {
    setSelectedGroup(group)
    setShowAddFacultyModal(true)
    setFacultySearch('')
    setSearchResults([])
  }

  const handleCloseAddFacultyModal = () => {
    setShowAddFacultyModal(false)
    setSelectedGroup(null)
    setFacultySearch('')
    setSearchResults([])
  }

  const handleSearchFaculty = async () => {
    if (!facultySearch.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const params = new URLSearchParams()
      params.append('q', facultySearch.trim())
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await axios.get(`/api/admin/faculty/search?${params}`)
      setSearchResults(response.data.data || [])
    } catch (error) {
      toast.error('Error searching faculty')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleAddFacultyToAllocation = async (facultyId, facultyName) => {
    if (!selectedGroup || !selectedGroup.exam) {
      toast.error('Invalid allocation group')
      return
    }

    // Find the first allocation in this group to add faculty to
    const allocation = allocations.find(alloc => {
      const allocDate = new Date(alloc.date).toISOString().split('T')[0]
      const groupDate = new Date(selectedGroup.date).toISOString().split('T')[0]
      return (
        alloc.exam?._id?.toString() === selectedGroup.exam?._id?.toString() &&
        allocDate === groupDate &&
        alloc.startTime === selectedGroup.startTime &&
        alloc.endTime === selectedGroup.endTime
      )
    })

    if (!allocation) {
      toast.error('Allocation not found')
      return
    }

    try {
      await axios.post(`/api/admin/allocations/${allocation._id}/add-faculty`, {
        facultyId: facultyId
      })
      toast.success(`Added ${facultyName} to allocation`)
      handleCloseAddFacultyModal()
      fetchAllocations()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add faculty')
    }
  }

  // Debounce search
  useEffect(() => {
    if (!showAddFacultyModal) return

    const timer = setTimeout(() => {
      if (facultySearch.trim()) {
        handleSearchFaculty()
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [facultySearch, showAddFacultyModal])

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Allocations</h1>
          <div className="flex space-x-2">
            {allocations.length > 0 && (
              <button
                onClick={handleAutoAllocate}
                className="btn-secondary flex items-center space-x-2"
              >
                <Zap className="w-4 h-4" />
                <span>Do Another Allocation</span>
              </button>
            )}
            <button onClick={handleAutoAllocate} className="btn-primary flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Auto Allocate</span>
            </button>
            <button
              onClick={handleNotifyAll}
              disabled={notifying || groupAllocationsByRoom().length === 0}
              className="btn-secondary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mail className="w-4 h-4" />
              <span>{notifying ? 'Sending...' : 'Notify All'}</span>
            </button>
            <button onClick={handleExportPDF} className="btn-secondary flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            <button onClick={handleExportExcel} className="btn-secondary flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button onClick={fetchAllocations} className="btn-secondary flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search allocations..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input-field pl-10"
              />
            </div>
            <select
              value={filters.campus}
              onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
              className="input-field"
            >
              <option value="">All Campuses</option>
            </select>
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="input-field"
            >
              <option value="">All Departments</option>
            </select>
          </div>
        </div>

        {/* Allocations by Room */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupAllocationsByRoom().map((group, index) => (
            <div key={index} className="card border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                {/* Header Section */}
                <div className="border-b pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {group.classroom?.block || 'N/A'} - {group.classroom?.roomNumber || 'N/A'}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${group.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      group.status === 'requested_change' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                      {group.status}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Date:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(group.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Time:</span>
                    <span className="font-medium text-gray-900">
                      {group.startTime} - {group.endTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Block:</span>
                    <span className="font-medium text-gray-900">
                      {group.classroom?.block || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Room Number:</span>
                    <span className="font-medium text-gray-900">
                      {group.classroom?.roomNumber || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Faculty Section */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">Assigned Faculty:</p>
                    <button
                      onClick={() => handleOpenAddFacultyModal(group)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      + Add Faculty
                    </button>
                  </div>
                  <div className="space-y-1">
                    {group.faculty.length > 0 ? (
                      group.faculty.map((faculty, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                          <span className="text-sm font-medium text-gray-900">
                            {faculty.name || 'N/A'}
                          </span>
                          {faculty.employeeId && (
                            <span className="text-xs text-gray-500">
                              ({faculty.employeeId})
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No faculty assigned</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {groupAllocationsByRoom().length === 0 && allocations.length > 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500 mb-2">No allocations with room information found</p>
            <p className="text-sm text-gray-400">Total allocations: {allocations.length}</p>
            <p className="text-xs text-gray-400 mt-2">Note: Allocations need classroom data to be displayed in containers</p>
            <div className="mt-4 text-left max-w-2xl mx-auto">
              <p className="text-xs font-semibold mb-2">Debug Info (first 3 allocations):</p>
              {allocations.slice(0, 3).map((alloc, idx) => {
                const hasDirectClassroom = alloc.classroom && typeof alloc.classroom === 'object' && (alloc.classroom.roomNumber || alloc.classroom._id)
                const hasExamClassroom = alloc.exam?.classroom && typeof alloc.exam.classroom === 'object' && (alloc.exam.classroom.roomNumber || alloc.exam.classroom._id)
                return (
                  <div key={idx} className="text-xs bg-gray-50 p-2 mb-2 rounded">
                    <p className="font-semibold">Allocation {idx + 1}:</p>
                    <p>  - Allocation.classroom exists: {alloc.classroom ? 'Yes' : 'No'}</p>
                    <p>  - Allocation.classroom type: {alloc.classroom ? (typeof alloc.classroom) : 'N/A'}</p>
                    <p>  - Allocation.classroom.roomNumber: {alloc.classroom?.roomNumber || 'N/A'}</p>
                    <p>  - Allocation.classroom._id: {alloc.classroom?._id || 'N/A'}</p>
                    <p>  - Exam.classroom exists: {alloc.exam?.classroom ? 'Yes' : 'No'}</p>
                    <p>  - Exam.classroom.roomNumber: {alloc.exam?.classroom?.roomNumber || 'N/A'}</p>
                    <p>  - Can be grouped: {hasDirectClassroom || hasExamClassroom ? 'Yes' : 'No'}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {allocations.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500">No allocations found</p>
          </div>
        )}

        {/* Add Faculty Modal */}
        {showAddFacultyModal && selectedGroup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Add Faculty to Allocation</h2>
                <button
                  onClick={handleCloseAddFacultyModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Allocation Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Allocation Details:</p>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Exam:</span> {selectedGroup.exam?.examName || 'N/A'}</p>
                    <p><span className="font-medium">Date:</span> {new Date(selectedGroup.date).toLocaleDateString()}</p>
                    <p><span className="font-medium">Time:</span> {selectedGroup.startTime} - {selectedGroup.endTime}</p>
                    <p><span className="font-medium">Room:</span> {selectedGroup.classroom?.roomNumber || 'N/A'} ({selectedGroup.classroom?.block || 'N/A'})</p>
                  </div>
                </div>

                {/* Search Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Faculty by Employee ID or Name
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Enter employee ID or name..."
                      value={facultySearch}
                      onChange={(e) => setFacultySearch(e.target.value)}
                      className="input-field pl-10 w-full min-h-[44px] text-base"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Search by employee ID (e.g., EMP123) or name (e.g., John Doe)
                  </p>
                </div>

                {/* Search Results */}
                {searching && (
                  <div className="text-center py-4">
                    <div className="spinner w-6 h-6 mx-auto"></div>
                  </div>
                )}

                {!searching && facultySearch.trim() && searchResults.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No faculty found matching "{facultySearch}"
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <p className="text-sm font-medium text-gray-700">
                      Found {searchResults.length} faculty member(s):
                    </p>
                    {searchResults.map((faculty) => (
                      <div
                        key={faculty._id}
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{faculty.name}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                              {faculty.employeeId && (
                                <span>ID: {faculty.employeeId}</span>
                              )}
                              <span>Email: {faculty.email}</span>
                              {faculty.department && (
                                <span>Dept: {faculty.department}</span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              Current Workload: {faculty.workload?.totalDuties || 0} duties, {faculty.workload?.totalHours?.toFixed(1) || 0} hours
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddFacultyToAllocation(faculty._id, faculty.name)}
                            className="btn-primary text-sm px-4 py-2 whitespace-nowrap"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default AdminAllocations

