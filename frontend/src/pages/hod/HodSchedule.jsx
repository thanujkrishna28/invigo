import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Search, Zap, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const HodSchedule = () => {
  const [activeTab, setActiveTab] = useState('exams')
  const [exams, setExams] = useState([])
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState({ exams: true, allocations: true })
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  })

  const tabs = [
    { id: 'exams', label: 'Exams', icon: '📝' },
    { id: 'allocations', label: 'Allocations', icon: '📅' }
  ]

  useEffect(() => {
    if (activeTab === 'exams') fetchExams()
    if (activeTab === 'allocations') fetchAllocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters.status, filters.search])

  const fetchExams = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)

      const response = await axios.get(`/api/hod/exams?${params}`)
      let filtered = response.data.data

      if (filters.search) {
        filtered = filtered.filter(exam =>
          exam.examName.toLowerCase().includes(filters.search.toLowerCase()) ||
          exam.courseCode.toLowerCase().includes(filters.search.toLowerCase())
        )
      }

      setExams(filtered)
    } catch (error) {
      toast.error('Error fetching exams')
    } finally {
      setLoading({ ...loading, exams: false })
    }
  }

  const fetchAllocations = async () => {
    try {
      const response = await axios.get('/api/hod/allocations')
      let filtered = response.data.data

      if (filters.search) {
        filtered = filtered.filter(alloc =>
          alloc.faculty?.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          alloc.exam?.examName.toLowerCase().includes(filters.search.toLowerCase())
        )
      }

      setAllocations(filtered)
    } catch (error) {
      toast.error('Error fetching allocations')
    } finally {
      setLoading({ ...loading, allocations: false })
    }
  }

  const handleAutoAllocate = async () => {
    try {
      const response = await axios.post('/api/hod/allocate', {})
      toast.success(response.data.message || 'Allocation completed')
      fetchAllocations()
      fetchExams()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Allocation failed')
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="section-title">Schedule Management</h1>
          <p className="text-gray-600 mt-1">Manage department exams and allocations</p>
        </div>

        {/* Tabs */}
        <div className="card p-2">
          <div className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/50'
                    : 'text-gray-700 hover:bg-primary-50 hover:text-primary-600'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {/* Exams Tab */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              {/* Filters */}
              <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search exams..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="input-field pl-10"
                    />
                  </div>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="input-field"
                  >
                    <option value="">All Status</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="allocated">Allocated</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Exams Table */}
              <div className="card">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Exam ID</th>
                        <th>Exam Name</th>
                        <th>Course</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.exams ? (
                        <tr>
                          <td colSpan="6" className="text-center py-8">
                            <div className="spinner w-8 h-8 mx-auto"></div>
                          </td>
                        </tr>
                      ) : exams.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-gray-500">
                            No exams found
                          </td>
                        </tr>
                      ) : (
                        exams.map((exam) => (
                          <tr key={exam._id}>
                            <td className="font-medium">{exam.examId}</td>
                            <td>{exam.examName}</td>
                            <td>{exam.courseCode}</td>
                            <td>{new Date(exam.date).toLocaleDateString()}</td>
                            <td>{exam.startTime} - {exam.endTime}</td>
                            <td>
                              <span className={`badge ${
                                exam.status === 'allocated' ? 'badge-success' :
                                exam.status === 'scheduled' ? 'badge-warning' :
                                'badge-info'
                              }`}>
                                {exam.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Allocations Tab */}
          {activeTab === 'allocations' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Allocations</h2>
                <button onClick={handleAutoAllocate} className="btn-primary flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span>Auto Allocate</span>
                </button>
              </div>

              {/* Filters */}
              <div className="card">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="input-field pl-10"
                  />
                </div>
              </div>

              {/* Allocations Table */}
              <div className="card">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Faculty</th>
                        <th>Exam</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.allocations ? (
                        <tr>
                          <td colSpan="5" className="text-center py-8">
                            <div className="spinner w-8 h-8 mx-auto"></div>
                          </td>
                        </tr>
                      ) : allocations.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-gray-500">
                            No allocations found
                          </td>
                        </tr>
                      ) : (
                        allocations.map((allocation) => (
                          <tr key={allocation._id}>
                            <td className="font-medium">
                              {new Date(allocation.date).toLocaleDateString()}
                            </td>
                            <td>
                              <span className="badge badge-primary">
                                {allocation.startTime} - {allocation.endTime}
                              </span>
                            </td>
                            <td className="font-semibold">{allocation.faculty?.name}</td>
                            <td>{allocation.exam?.examName}</td>
                            <td>
                              <span className={`badge ${
                                allocation.status === 'confirmed' ? 'badge-success' :
                                allocation.status === 'requested_change' ? 'badge-warning' :
                                'badge-primary'
                              }`}>
                                {allocation.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
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

export default HodSchedule

