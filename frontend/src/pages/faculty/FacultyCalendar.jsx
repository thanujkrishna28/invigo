import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import axios from 'axios'
import Calendar from 'react-calendar'
import moment from 'moment'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import toast from 'react-hot-toast'

const FacultyCalendar = () => {
  const [events, setEvents] = useState([])
  const [filteredEvents, setFilteredEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCalendarData()
  }, [])

  useEffect(() => {
    filterEvents()
  }, [events, selectedDate])

  const fetchCalendarData = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/faculty/calendar')
      setEvents(response.data.events || [])
    } catch (error) {
      toast.error('Error fetching calendar data')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterEvents = () => {
    const dateStr = moment(selectedDate).format('YYYY-MM-DD')
    const filtered = events.filter(event => {
      const eventDate = moment(event.start).format('YYYY-MM-DD')
      return eventDate === dateStr
    })
    setFilteredEvents(filtered)
  }

  const tileClassName = ({ date }) => {
    const dateStr = moment(date).format('YYYY-MM-DD')
    const hasEvents = events.some(event => 
      moment(event.start).format('YYYY-MM-DD') === dateStr
    )
    return hasEvents ? 'bg-blue-100' : ''
  }

  const tileContent = ({ date }) => {
    const dateStr = moment(date).format('YYYY-MM-DD')
    const dayEvents = events.filter(event => 
      moment(event.start).format('YYYY-MM-DD') === dateStr
    )
    return dayEvents.length > 0 ? (
      <div className="text-xs text-center mt-1">
        <span className="bg-blue-500 text-white rounded-full w-5 h-5 inline-flex items-center justify-center">
          {dayEvents.length}
        </span>
      </div>
    ) : null
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8" />
            My Calendar
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="card">
              <Calendar
                onChange={setSelectedDate}
                value={selectedDate}
                tileClassName={tileClassName}
                tileContent={tileContent}
                className="w-full"
              />
            </div>
          </div>

          {/* Events List */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">
                {moment(selectedDate).format('MMMM DD, YYYY')}
              </h2>
              
              {filteredEvents.length === 0 ? (
                <p className="text-gray-500 text-sm">No duties on this date</p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredEvents.map((event, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedEvent(event)}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ borderLeftColor: event.resource?.color || '#3B82F6', borderLeftWidth: '4px' }}
                    >
                      <div className="font-medium text-sm">{event.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {moment(event.start).format('HH:mm')} - {moment(event.end).format('HH:mm')}
                      </div>
                      {event.resource?.department && (
                        <div className="text-xs text-gray-500">{event.resource.department}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">Invigilation Duty</h3>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedEvent.resource?.examName && (
                    <div>
                      <span className="font-medium">Exam:</span> {selectedEvent.resource.examName}
                    </div>
                  )}
                  {selectedEvent.resource?.courseCode && (
                    <div>
                      <span className="font-medium">Course Code:</span> {selectedEvent.resource.courseCode}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Date:</span> {moment(selectedEvent.start).format('MMMM DD, YYYY')}
                  </div>
                  <div>
                    <span className="font-medium">Time:</span> {moment(selectedEvent.start).format('HH:mm')} - {moment(selectedEvent.end).format('HH:mm')}
                  </div>
                  {selectedEvent.resource?.department && (
                    <div>
                      <span className="font-medium">Department:</span> {selectedEvent.resource.department}
                    </div>
                  )}
                  {selectedEvent.resource?.campus && (
                    <div>
                      <span className="font-medium">Campus:</span> {selectedEvent.resource.campus}
                    </div>
                  )}
                  {selectedEvent.resource?.classroom && (
                    <div>
                      <span className="font-medium">Classroom:</span> {selectedEvent.resource.classroom.roomNumber} - {selectedEvent.resource.classroom.block} (Floor {selectedEvent.resource.classroom.floor})
                    </div>
                  )}
                  {selectedEvent.resource?.status && (
                    <div>
                      <span className="font-medium">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${
                        selectedEvent.resource.status === 'confirmed' 
                          ? 'bg-green-100 text-green-800'
                          : selectedEvent.resource.status === 'requested_change'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedEvent.resource.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default FacultyCalendar

