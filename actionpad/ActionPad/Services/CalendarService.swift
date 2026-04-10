import EventKit

class CalendarService {
    private let store = EKEventStore()

    func createEvent(title: String, startDate: Date, endDate: Date?) async throws -> Bool {
        let granted = try await requestAccess()
        guard granted else { return false }

        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = startDate
        event.endDate = endDate ?? startDate.addingTimeInterval(3600) // Default 1 hour
        event.calendar = store.defaultCalendarForNewEvents

        try store.save(event, span: .thisEvent)
        return true
    }

    private func requestAccess() async throws -> Bool {
        if #available(iOS 17.0, *) {
            return try await store.requestFullAccessToEvents()
        } else {
            return try await store.requestAccess(to: .event)
        }
    }
}
