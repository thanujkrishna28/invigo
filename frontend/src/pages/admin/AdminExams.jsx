import { useEffect, useState, useMemo } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const AdminExams = () => {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    campus: '',
    department: '',
    status: '',
    search: ''
  })

  useEffect(() => {
    fetchExams()
  }, [filters.campus, filters.department, filters.status])

  const fetchExams = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)
      if (filters.status) params.append('status', filters.status)

      const response = await axios.get(`/api/admin/exams?${params}`)
      setExams(response.data.data || [])
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
      exam.examName.toLowerCase().includes(searchLower) ||
      exam.courseCode.toLowerCase().includes(searchLower) ||
      exam.examId?.toLowerCase().includes(searchLower)
    )
  }, [exams, filters.search])

  const handleAllocate = async (examId) => {
    try {
      const response = await axios.post('/api/admin/allocate', { examIds: [examId] })
      toast.success('Allocation completed')
      fetchExams()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Allocation failed')
    }
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Exams</h1>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExams.map((exam) => (
                  <tr key={exam._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {exam.examId}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{exam.examName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {exam.courseCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(exam.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {exam.startTime} - {exam.endTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${exam.status === 'allocated' ? 'bg-green-100 text-green-800' :
                        exam.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                        {exam.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {exam.status === 'scheduled' && (
                        <button
                          onClick={() => handleAllocate(exam._id)}
                          className="btn-primary text-xs py-1 px-3"
                        >
                          Allocate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default AdminExams

