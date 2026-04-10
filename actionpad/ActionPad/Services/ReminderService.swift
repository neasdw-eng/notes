import EventKit

class ReminderService {
    private let store: EKEventStore

    init(store: EKEventStore) {
        self.store = store
    }

    func createReminder(title: String, dueDate: Date?) async throws -> Bool {
        let granted = try await requestAccess()
        guard granted else { return false }

        guard let calendar = store.defaultCalendarForNewReminders() else {
            throw ActionError.noDefaultReminderList
        }

        let reminder = EKReminder(eventStore: store)
        reminder.title = title
        reminder.calendar = calendar

        if let date = dueDate {
            let components = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: date
            )
            reminder.dueDateComponents = components
            reminder.addAlarm(EKAlarm(absoluteDate: date))
        }

        try store.save(reminder, commit: true)
        return true
    }

    private func requestAccess() async throws -> Bool {
        let status = EKEventStore.authorizationStatus(for: .reminder)
        switch status {
        case .authorized, .fullAccess:
            return true
        case .denied, .restricted:
            return false
        case .notDetermined:
            if #available(iOS 17.0, *) {
                return try await store.requestFullAccessToReminders()
            } else {
                return try await store.requestAccess(to: .reminder)
            }
        case .writeOnly:
            if #available(iOS 17.0, *) {
                return try await store.requestFullAccessToReminders()
            } else {
                return true
            }
        @unknown default:
            return false
        }
    }
}
