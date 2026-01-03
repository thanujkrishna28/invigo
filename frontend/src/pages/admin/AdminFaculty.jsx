import { useEffect, useState, useMemo } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Search } from 'lucide-react'

const AdminFaculty = () => {
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    campus: '',
    department: '',
    search: ''
  })

  useEffect(() => {
    fetchFaculty()
  }, [filters.campus, filters.department])

  const fetchFaculty = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await axios.get(`/api/admin/faculty?${params}`)
      setFaculty(response.data.data || [])
    } catch (error) {
      console.error('Error fetching faculty:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredFaculty = useMemo(() => {
    if (!filters.search) return faculty
    const searchLower = filters.search.toLowerCase()
    return faculty.filter(f =>
      f.name.toLowerCase().includes(searchLower) ||
      f.email.toLowerCase().includes(searchLower) ||
      f.employeeId?.toLowerCase().includes(searchLower) ||
      f.department?.toLowerCase().includes(searchLower)
    )
  }, [faculty, filters.search])

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
        <h1 className="text-3xl font-bold text-gray-900">Faculty</h1>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search faculty..."
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

        {/* Faculty Table */}
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campus</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workload</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFaculty.map((f) => (
                  <tr key={f._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {f.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {f.employeeId || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {f.department || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.campus}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <p className="font-medium">{f.workload?.totalDuties || 0} duties</p>
                        <p className="text-xs text-gray-500">{f.workload?.totalHours || 0} hours</p>
                      </div>
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

export default AdminFaculty

