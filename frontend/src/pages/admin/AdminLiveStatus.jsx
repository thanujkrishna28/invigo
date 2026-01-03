import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import api from '../../utils/api'
import { CheckCircle, Clock, AlertTriangle, XCircle, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'

const AdminLiveStatus = () => {
  const [data, setData] = useState({ present: [], onTheWay: [], unableToReach: [], noStatus: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedAllocation, setSelectedAllocation] = useState(null)
  const [showReplaceModal, setShowReplaceModal] = useState(false)

  useEffect(() => {
    fetchLiveStatus()
    // Refresh every 30 seconds
    const interval = setInterval(fetchLiveStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchLiveStatus = async () => {
    try {
      const response = await api.get('/admin/live-status')
      setData(response.data.data || { present: [], onTheWay: [], unableToReach: [], noStatus: [], total: 0 })
    } catch (error) {
      toast.error('Error fetching live status')
    } finally {
      setLoading(false)
    }
  }

  const handleReplaceFaculty = async (reservedFacultyId) => {
    try {
      await api.post(`/admin/replace-faculty/${selectedAllocation._id}`, {
        reservedFacultyId
      })
      toast.success('Faculty replaced successfully')
      setShowReplaceModal(false)
      setSelectedAllocation(null)
      fetchLiveStatus()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to replace faculty')
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Live Duty Status</h1>
          <button onClick={fetchLiveStatus} className="btn-secondary">
            Refresh
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Present</p>
                <p className="text-2xl font-bold text-green-600">{data.present?.length || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">On the Way</p>
                <p className="text-2xl font-bold text-blue-600">{data.onTheWay?.length || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unable to Reach</p>
                <p className="text-2xl font-bold text-red-600">{data.unableToReach?.length || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">No Status</p>
                <p className="text-2xl font-bold text-gray-600">{data.noStatus?.length || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Unable to Reach - Priority */}
        {data.unableToReach?.length > 0 && (
          <div className="card border-2 border-red-300">
            <div className="flex items-center space-x-2 mb-4">
              <XCircle className="w-5 h-5 text-red-500" />
              <h2 className="text-xl font-bold text-red-600">⚠️ Unable to Reach - Action Required</h2>
            </div>
            <div className="space-y-3">
              {data.unableToReach?.map((allocation) => (
                <div
                  key={allocation._id}
                  className="p-4 border border-red-200 bg-red-50 rounded-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{allocation.exam?.examName}</p>
                      <p className="text-sm text-gray-600">{allocation.exam?.courseCode}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <p>Faculty: {allocation.faculty?.name} ({allocation.faculty?.email})</p>
                        <p>Date: {new Date(allocation.date).toLocaleDateString()} | {allocation.startTime} - {allocation.endTime}</p>
                        {allocation.liveStatus?.emergencyReason && (
                          <p className="text-red-600 mt-1">
                            <strong>Reason:</strong> {allocation.liveStatus.emergencyReason}
                          </p>
                        )}
                      </div>
                      {/* Reserved Faculty Suggestions */}
                      {allocation.reservedFaculty && allocation.reservedFaculty.length > 0 && (
                        <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Suggested Reserved Faculty:</p>
                          <div className="space-y-1">
                            {allocation.reservedFaculty
                              .filter(rf => rf.status === 'available')
                              .sort((a, b) => a.priority - b.priority)
                              .slice(0, 2)
                              .map((rf, index) => (
                                <div key={index} className="flex items-center justify-between text-xs">
                                  <span>{rf.faculty?.name} ({rf.faculty?.email})</span>
                                  <button
                                    onClick={() => {
                                      setSelectedAllocation(allocation)
                                      setShowReplaceModal(true)
                                    }}
                                    className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                  >
                                    Replace
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        ❌ Unable to Reach
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* On the Way */}
        {data.onTheWay?.length > 0 && (
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-bold text-gray-900">On the Way</h2>
            </div>
            <div className="space-y-3">
              {data.onTheWay?.map((allocation) => (
                <div
                  key={allocation._id}
                  className="p-4 border border-blue-200 bg-blue-50 rounded-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{allocation.exam?.examName}</p>
                      <p className="text-sm text-gray-600">{allocation.exam?.courseCode}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <p>Faculty: {allocation.faculty?.name}</p>
                        <p>Date: {new Date(allocation.date).toLocaleDateString()} | {allocation.startTime} - {allocation.endTime}</p>
                        {allocation.liveStatus?.eta && (
                          <p className="text-blue-600 font-semibold">ETA: {allocation.liveStatus.eta}</p>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      🚶 On the Way
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Present */}
        {data.present?.length > 0 && (
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <UserCheck className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold text-gray-900">Present</h2>
            </div>
            <div className="space-y-3">
              {data.present?.map((allocation) => (
                <div
                  key={allocation._id}
                  className="p-4 border border-green-200 bg-green-50 rounded-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{allocation.exam?.examName}</p>
                      <p className="text-sm text-gray-600">{allocation.exam?.courseCode}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <p>Faculty: {allocation.faculty?.name}</p>
                        <p>Date: {new Date(allocation.date).toLocaleDateString()} | {allocation.startTime} - {allocation.endTime}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      ✅ Present
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Status */}
        {data.noStatus?.length > 0 && (
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-gray-500" />
              <h2 className="text-xl font-bold text-gray-900">No Status Update</h2>
            </div>
            <div className="space-y-3">
              {data.noStatus?.map((allocation) => (
                <div
                  key={allocation._id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{allocation.exam?.examName}</p>
                      <p className="text-sm text-gray-600">{allocation.exam?.courseCode}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <p>Faculty: {allocation.faculty?.name}</p>
                        <p>Date: {new Date(allocation.date).toLocaleDateString()} | {allocation.startTime} - {allocation.endTime}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                      No Status
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Replace Faculty Modal */}
        {showReplaceModal && selectedAllocation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Replace Faculty</h2>
              <p className="text-sm text-gray-600 mb-4">
                Replace <strong>{selectedAllocation.faculty?.name}</strong> for {selectedAllocation.exam?.examName}
              </p>
              <div className="space-y-3 mb-4">
                {selectedAllocation.reservedFaculty
                  ?.filter(rf => rf.status === 'available')
                  .sort((a, b) => a.priority - b.priority)
                  .map((rf, index) => (
                    <div key={index} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{rf.faculty?.name}</p>
                          <p className="text-xs text-gray-600">{rf.faculty?.email}</p>
                          <p className="text-xs text-gray-500">Priority: {rf.priority}</p>
                        </div>
                        <button
                          onClick={() => handleReplaceFaculty(rf.faculty._id)}
                          className="btn-primary px-4 py-2"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              <button
                onClick={() => {
                  setShowReplaceModal(false)
                  setSelectedAllocation(null)
                }}
                className="btn-secondary w-full"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default AdminLiveStatus

