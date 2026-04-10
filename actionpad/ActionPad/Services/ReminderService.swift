import EventKit

class ReminderService {
    private let store = EKEventStore()

    func createReminder(title: String, dueDate: Date?) async throws -> Bool {
        let granted = try await requestAccess()
        guard granted else { return false }

        let reminder = EKReminder(eventStore: store)
        reminder.title = title
        reminder.calendar = store.defaultCalendarForNewReminders()

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
        if #available(iOS 17.0, *) {
            return try await store.requestFullAccessToReminders()
        } else {
            return try await store.requestAccess(to: .reminder)
        }
    }
}
