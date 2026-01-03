import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import api from '../../utils/api'
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const AdminAcknowledgments = () => {
  const [data, setData] = useState({ pending: [], overdue: [], acknowledged: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ campus: '', department: '' })

  useEffect(() => {
    fetchAcknowledgments()
  }, [filters])

  const fetchAcknowledgments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.campus) params.append('campus', filters.campus)
      if (filters.department) params.append('department', filters.department)

      const response = await api.get(`/admin/acknowledgments?${params}`)
      setData(response.data.data || { pending: [], overdue: [], acknowledged: [], total: 0 })
    } catch (error) {
      toast.error('Error fetching acknowledgments')
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pre-Exam Acknowledgments</h1>
          <button onClick={fetchAcknowledgments} className="btn-secondary">
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Campus</label>
              <input
                type="text"
                value={filters.campus}
                onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
                className="input-field"
                placeholder="Filter by campus"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <input
                type="text"
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="input-field"
                placeholder="Filter by department"
              />
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Acknowledged</p>
                <p className="text-2xl font-bold text-green-600">{data.acknowledged?.length || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{data.pending?.length || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-gray-900">{data.overdue?.length || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{data.total}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Overdue Acknowledgments */}
        {data.overdue?.length > 0 && (
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <XCircle className="w-5 h-5 text-red-500" />
              <h2 className="text-xl font-bold text-gray-900">Overdue Acknowledgments</h2>
            </div>
            <div className="space-y-3">
              {data.overdue?.map((allocation) => (
                <div
                  key={allocation._id}
                  className="p-4 border border-red-200 bg-red-50 rounded-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {allocation.exam?.examType ?
                          allocation.exam.examType.charAt(0).toUpperCase() + allocation.exam.examType.slice(1).replace('-', ' ') :
                          'N/A'
                        } - {allocation.faculty?.name || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">{allocation.exam?.courseCode}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <p>Faculty: {allocation.faculty?.name} ({allocation.faculty?.email})</p>
                        <p>Date: {new Date(allocation.date).toLocaleDateString()} | {allocation.startTime} - {allocation.endTime}</p>
                        <p className="text-red-600 font-semibold">
                          Deadline: {new Date(allocation.acknowledgmentDeadline).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Overdue
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acknowledged Acknowledgments */}
        {data.acknowledged && data.acknowledged.length > 0 && (
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold text-gray-900">Acknowledged</h2>
            </div>
            <div className="space-y-3">
              {data.acknowledged?.map((allocation) => (
                <div
                  key={allocation._id}
                  className="p-4 border border-green-200 bg-green-50 rounded-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {allocation.exam?.examType ?
                          allocation.exam.examType.charAt(0).toUpperCase() + allocation.exam.examType.slice(1).replace('-', ' ') :
                          'N/A'
                        } - {allocation.faculty?.name || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">{allocation.exam?.courseCode}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <p>Faculty: {allocation.faculty?.name} ({allocation.faculty?.email})</p>
                        <p>Date: {new Date(allocation.date).toLocaleDateString()} | {allocation.startTime} - {allocation.endTime}</p>
                        {allocation.preExamAcknowledgment?.acknowledgedAt && (
                          <p className="text-green-600 font-semibold">
                            Acknowledged: {new Date(allocation.preExamAcknowledgment.acknowledgedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        ✓ Acknowledged
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Acknowledgments */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-900">Pending Acknowledgments</h2>
          </div>
          {data.pending?.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-gray-600">All acknowledgments received!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.pending?.map((allocation) => (
                <div
                  key={allocation._id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {allocation.exam?.examType ?
                          allocation.exam.examType.charAt(0).toUpperCase() + allocation.exam.examType.slice(1).replace('-', ' ') :
                          'N/A'
                        } - {allocation.faculty?.name || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">{allocation.exam?.courseCode}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <p>Faculty: {allocation.faculty?.name} ({allocation.faculty?.email})</p>
                        <p>Date: {new Date(allocation.date).toLocaleDateString()} | {allocation.startTime} - {allocation.endTime}</p>
                        <p className="text-yellow-600 font-semibold">
                          Deadline: {new Date(allocation.acknowledgmentDeadline).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default AdminAcknowledgments

