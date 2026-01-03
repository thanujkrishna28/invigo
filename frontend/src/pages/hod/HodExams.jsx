import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'

const HodExams = () => {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  })

  useEffect(() => {
    fetchExams()
  }, [filters])

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
      setLoading(false)
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
        <h1 className="text-3xl font-bold text-gray-900">Department Exams</h1>

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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exams.map((exam) => (
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
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        exam.status === 'allocated' ? 'bg-green-100 text-green-800' :
                        exam.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {exam.status}
                      </span>
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

export default HodExams

