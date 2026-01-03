import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import { Calendar, Download, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const FacultyDuties = () => {
  const [duties, setDuties] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('upcoming')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUnavailableModal, setShowUnavailableModal] = useState(null)
  const [showOnTheWayModal, setShowOnTheWayModal] = useState(null)
  const [showEmergencyModal, setShowEmergencyModal] = useState(null)
  const [unavailableReason, setUnavailableReason] = useState('')
  const [eta, setEta] = useState('')
  const [emergencyReason, setEmergencyReason] = useState('')

  useEffect(() => {
    fetchDuties()
  }, [view, showNotifications])

  const fetchDuties = async () => {
    try {
      const params = new URLSearchParams()
      if (view !== 'all') params.append('view', view)
      if (showNotifications) params.append('showNotifications', 'true')

      const response = await axios.get(`/api/faculty/duties?${params}`)
      setDuties(response.data.data)
    } catch (error) {
      toast.error('Error fetching duties')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadDutyLetter = async (allocationId) => {
    try {
      const response = await axios.get(`/api/reports/duty-letter/${allocationId}`, {
        responseType: 'blob'
      })
      // Create blob with proper MIME type
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `duty-letter-${allocationId}.pdf`)
      document.body.appendChild(link)
      link.click()
      // Clean up
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Duty letter downloaded')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Download failed')
    }
  }

  const handleDownloadICal = async (allocationId) => {
    try {
      const response = await axios.get(`/api/reports/ical/${allocationId}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `duty-${allocationId}.ics`)
      document.body.appendChild(link)
      link.click()
      toast.success('Calendar file downloaded')
    } catch (error) {
      toast.error('Download failed')
    }
  }

  const handleAcknowledge = async (allocationId, action) => {
    try {
      await axios.post(`/api/faculty/acknowledge/${allocationId}`, { action })
      toast.success(action === 'acknowledge' ? 'Duty acknowledged successfully. Notification removed from your view.' : 'Unavailability noted')
      fetchDuties() // Refresh - acknowledged items will disappear if showNotifications is true
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to acknowledge')
    }
  }

  const handleSubmitUnavailable = async () => {
    if (!unavailableReason.trim()) {
      toast.error('Please provide a reason')
      return
    }
    try {
      await axios.post(`/api/faculty/acknowledge/${showUnavailableModal._id}`, {
        action: 'unavailable',
        reason: unavailableReason
      })
      toast.success('Unavailability noted. Admin will be notified.')
      setShowUnavailableModal(null)
      setUnavailableReason('')
      fetchDuties()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit')
    }
  }

  const handleLiveStatus = async (allocationId, status) => {
    try {
      await axios.post(`/api/faculty/live-status/${allocationId}`, { status })
      toast.success('Status updated successfully')
      fetchDuties()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status')
    }
  }

  const handleSubmitOnTheWay = async () => {
    if (!eta.trim()) {
      toast.error('Please provide ETA')
      return
    }
    try {
      await axios.post(`/api/faculty/live-status/${showOnTheWayModal._id}`, {
        status: 'on_the_way',
        eta: eta
      })
      toast.success('Status updated: On the way')
      setShowOnTheWayModal(null)
      setEta('')
      fetchDuties()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status')
    }
  }

  const handleSubmitEmergency = async () => {
    if (!emergencyReason.trim()) {
      toast.error('Please provide emergency reason')
      return
    }
    try {
      await axios.post(`/api/faculty/live-status/${showEmergencyModal._id}`, {
        status: 'unable_to_reach',
        emergencyReason: emergencyReason
      })
      toast.success('Emergency reported. Admin has been notified.')
      setShowEmergencyModal(null)
      setEmergencyReason('')
      fetchDuties()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to report emergency')
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Duties</h1>
          <button onClick={fetchDuties} className="btn-secondary flex items-center justify-center space-x-2 min-h-[44px] text-sm sm:text-base px-4">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* View Tabs */}
        <div className="card p-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto -mx-2 px-2">
              {['today', 'week', 'month', 'all'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 font-medium text-sm sm:text-base capitalize whitespace-nowrap min-h-[44px] transition-all ${
                    view === v
                      ? 'border-b-2 border-primary-600 text-primary-600 font-semibold'
                      : 'text-gray-600 hover:text-gray-900 active:bg-gray-100'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNotifications}
                  onChange={(e) => setShowNotifications(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Show Only Pending Notifications</span>
              </label>
            </div>
          </div>
        </div>

        {/* Duties List */}
        <div className="card">
          {duties.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No duties found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {duties.map((duty) => (
                <div
                  key={duty._id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 gap-3 sm:gap-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{duty.exam?.examName}</p>
                    <p className="text-xs sm:text-sm text-gray-600">{duty.exam?.courseCode}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2 text-xs sm:text-sm text-gray-500 gap-1 sm:gap-0">
                      <span>{new Date(duty.date).toLocaleDateString()}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{duty.startTime} - {duty.endTime}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{duty.campus}</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2 flex-shrink-0">
                    {/* Acknowledgment Status */}
                    {duty.preExamAcknowledgment && (
                      <div className="flex items-center space-x-2">
                        {duty.preExamAcknowledgment.status === 'pending' && (
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Acknowledgment Pending
                            </span>
                            <button
                              onClick={() => handleAcknowledge(duty._id, 'acknowledge')}
                              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              Acknowledge
                            </button>
                            <button
                              onClick={() => setShowUnavailableModal(duty)}
                              className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              Unavailable
                            </button>
                          </div>
                        )}
                        {duty.preExamAcknowledgment.status === 'acknowledged' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            ✓ Acknowledged
                          </span>
                        )}
                        {duty.preExamAcknowledgment.status === 'unavailable' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Unavailable
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Live Status (30 min before exam) */}
                    {duty.liveStatusWindow && new Date() >= new Date(duty.liveStatusWindow.opensAt) && new Date() <= new Date(duty.liveStatusWindow.closesAt) && (
                      <div className="flex items-center space-x-2">
                        {!duty.liveStatus?.status && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-600">Status:</span>
                            <button
                              onClick={() => handleLiveStatus(duty._id, 'present')}
                              className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              ✅ Present
                            </button>
                            <button
                              onClick={() => setShowOnTheWayModal(duty)}
                              className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              🚶 On Way
                            </button>
                            <button
                              onClick={() => setShowEmergencyModal(duty)}
                              className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              ❌ Unable
                            </button>
                          </div>
                        )}
                        {duty.liveStatus?.status === 'present' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            ✅ Present
                          </span>
                        )}
                        {duty.liveStatus?.status === 'on_the_way' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            🚶 On the Way {duty.liveStatus.eta && `(ETA: ${duty.liveStatus.eta})`}
                          </span>
                        )}
                        {duty.liveStatus?.status === 'unable_to_reach' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            ❌ Unable to Reach
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                          duty.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {duty.status}
                      </span>
                      <button
                        onClick={() => handleDownloadDutyLetter(duty._id)}
                        className="p-2 sm:p-2.5 text-primary-600 hover:bg-primary-100 active:bg-primary-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Download Duty Letter"
                      >
                        <Download className="w-5 h-5 sm:w-6 sm:h-6" />
                      </button>
                      <button
                        onClick={() => handleDownloadICal(duty._id)}
                        className="p-2 sm:p-2.5 text-primary-600 hover:bg-primary-100 active:bg-primary-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Add to Calendar"
                      >
                        <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unavailable Modal */}
        {showUnavailableModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Mark as Unavailable</h2>
              <p className="text-sm text-gray-600 mb-4">
                Exam: {showUnavailableModal.exam?.examName} on {new Date(showUnavailableModal.date).toLocaleDateString()}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={unavailableReason}
                    onChange={(e) => setUnavailableReason(e.target.value)}
                    className="input-field"
                    rows="4"
                    required
                    placeholder="Please provide a reason for unavailability..."
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowUnavailableModal(null)
                      setUnavailableReason('')
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button onClick={handleSubmitUnavailable} className="btn-primary flex-1">
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* On the Way Modal */}
        {showOnTheWayModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">On the Way</h2>
              <p className="text-sm text-gray-600 mb-4">
                Exam: {showOnTheWayModal.exam?.examName} at {showOnTheWayModal.startTime}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Arrival Time (ETA) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className="input-field"
                    placeholder="e.g., 09:15 AM or 15 minutes"
                    required
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowOnTheWayModal(null)
                      setEta('')
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button onClick={handleSubmitOnTheWay} className="btn-primary flex-1">
                    Update Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Emergency Modal */}
        {showEmergencyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-red-600 mb-4">⚠️ Unable to Reach</h2>
              <p className="text-sm text-gray-600 mb-4">
                Exam: {showEmergencyModal.exam?.examName} at {showEmergencyModal.startTime}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">
                  This will immediately alert the Exam Cell. Reserved faculty will be suggested for replacement.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    className="input-field"
                    rows="4"
                    required
                    placeholder="Please describe the emergency situation..."
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowEmergencyModal(null)
                      setEmergencyReason('')
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button onClick={handleSubmitEmergency} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
                    Report Emergency
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default FacultyDuties

