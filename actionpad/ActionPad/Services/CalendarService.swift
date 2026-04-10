import EventKit

class CalendarService {
    private let store: EKEventStore

    init(store: EKEventStore) {
        self.store = store
    }

    func createEvent(title: String, startDate: Date, endDate: Date?) async throws -> Bool {
        let granted = try await requestAccess()
        guard granted else { return false }

        guard let calendar = store.defaultCalendarForNewEvents else {
            throw ActionError.noDefaultCalendar
        }

        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = startDate
        event.endDate = endDate ?? startDate.addingTimeInterval(3600)
        event.calendar = calendar

        try store.save(event, span: .thisEvent)
        return true
    }

    private func requestAccess() async throws -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        switch status {
        case .authorized, .fullAccess:
            return true
        case .denied, .restricted:
            return false
        case .notDetermined:
            if #available(iOS 17.0, *) {
                return try await store.requestFullAccessToEvents()
            } else {
                return try await store.requestAccess(to: .event)
            }
        case .writeOnly:
            if #available(iOS 17.0, *) {
                return try await store.requestFullAccessToEvents()
            } else {
                return true
            }
        @unknown default:
            return false
        }
    }
}

enum ActionError: LocalizedError {
    case noDefaultCalendar
    case noDefaultReminderList
    case notificationsDenied

    var errorDescription: String? {
        switch self {
        case .noDefaultCalendar:
            return "No default calendar configured on this device"
        case .noDefaultReminderList:
            return "No default reminder list configured on this device"
        case .notificationsDenied:
            return "Notification permissions denied"
        }
    }
}
