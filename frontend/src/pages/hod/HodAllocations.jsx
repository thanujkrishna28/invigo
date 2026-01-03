import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Download, Search, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

const HodAllocations = () => {
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: ''
  })

  useEffect(() => {
    fetchAllocations()
  }, [filters])

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
      setLoading(false)
    }
  }

  const handleAutoAllocate = async () => {
    try {
      const response = await axios.post('/api/hod/allocate', {})
      toast.success(response.data.message || 'Allocation completed')
      fetchAllocations()
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
          <h1 className="text-3xl font-bold text-gray-900">Department Allocations</h1>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faculty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allocations.map((allocation) => (
                  <tr key={allocation._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(allocation.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {allocation.startTime} - {allocation.endTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {allocation.faculty?.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {allocation.exam?.examName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        allocation.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        allocation.status === 'requested_change' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {allocation.status}
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

export default HodAllocations

