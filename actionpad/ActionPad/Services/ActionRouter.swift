import Foundation

class ActionRouter {
    private let parser = NLParser()
    private let calendarService = CalendarService()
    private let reminderService = ReminderService()
    private let notificationService = NotificationService()

    func process(_ text: String) async -> ActionResult {
        let parsed = parser.parse(text)

        switch parsed.intent {
        case .calendarEvent:
            return await handleCalendarEvent(parsed)
        case .reminder:
            return await handleReminder(parsed)
        case .alarm:
            return await handleAlarm(parsed)
        case .notification:
            return await handleNotification(parsed)
        }
    }

    private func handleCalendarEvent(_ action: ParsedAction) async -> ActionResult {
        guard let date = action.date else {
            return await fallbackToNotification(action, reason: "No date detected")
        }

        do {
            let success = try await calendarService.createEvent(
                title: action.title,
                startDate: date,
                endDate: action.endDate
            )
            if success {
                let formatted = formatDate(date)
                return ActionResult(
                    success: true,
                    intent: .calendarEvent,
                    message: "Calendar event created for \(formatted)"
                )
            } else {
                return await fallbackToNotification(action, reason: "Calendar access denied")
            }
        } catch {
            return await fallbackToNotification(action, reason: "Calendar error")
        }
    }

    private func handleReminder(_ action: ParsedAction) async -> ActionResult {
        do {
            let success = try await reminderService.createReminder(
                title: action.title,
                dueDate: action.date
            )
            if success {
                let dateStr = action.date.map { formatDate($0) } ?? "no due date"
                return ActionResult(
                    success: true,
                    intent: .reminder,
                    message: "Reminder set: \(action.title) (\(dateStr))"
                )
            } else {
                return await fallbackToNotification(action, reason: "Reminders access denied")
            }
        } catch {
            return await fallbackToNotification(action, reason: "Reminders error")
        }
    }

    private func handleAlarm(_ action: ParsedAction) async -> ActionResult {
        // iOS doesn't allow programmatic alarm creation in Clock app
        // Fall back to a timed notification
        do {
            try await notificationService.scheduleNotification(
                title: "Alarm: \(action.title)",
                body: action.originalText,
                date: action.date
            )
            let dateStr = action.date.map { formatDate($0) } ?? "now"
            return ActionResult(
                success: true,
                intent: .alarm,
                message: "Notification scheduled for \(dateStr) (iOS doesn't allow direct alarm creation)"
            )
        } catch {
            return ActionResult(
                success: false,
                intent: .alarm,
                message: "Failed to schedule alarm notification"
            )
        }
    }

    private func handleNotification(_ action: ParsedAction) async -> ActionResult {
        do {
            try await notificationService.scheduleNotification(
                title: action.title,
                body: action.originalText,
                date: action.date
            )
            let dateStr = action.date.map { "for \(formatDate($0))" } ?? "sent"
            return ActionResult(
                success: true,
                intent: .notification,
                message: "Notification \(dateStr)"
            )
        } catch {
            return ActionResult(
                success: false,
                intent: .notification,
                message: "Failed to send notification"
            )
        }
    }

    private func fallbackToNotification(_ action: ParsedAction, reason: String) async -> ActionResult {
        do {
            try await notificationService.scheduleNotification(
                title: action.title,
                body: action.originalText,
                date: action.date
            )
            let dateStr = action.date.map { formatDate($0) } ?? "now"
            return ActionResult(
                success: true,
                intent: .notification,
                message: "\(reason). Notification scheduled instead (\(dateStr))"
            )
        } catch {
            return ActionResult(
                success: false,
                intent: .notification,
                message: "\(reason). Failed to send fallback notification."
            )
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        let calendar = Calendar.current

        if calendar.isDateInToday(date) {
            formatter.dateFormat = "h:mm a 'today'"
        } else if calendar.isDateInTomorrow(date) {
            formatter.dateFormat = "h:mm a 'tomorrow'"
        } else {
            formatter.dateFormat = "MMM d, h:mm a"
        }

        return formatter.string(from: date)
    }
}
