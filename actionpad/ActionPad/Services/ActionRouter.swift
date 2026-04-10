import Foundation
import EventKit

class ActionRouter: ObservableObject {
    let parser = NLParser()
    private let store = EKEventStore()
    private lazy var calendarService = CalendarService(store: store)
    private lazy var reminderService = ReminderService(store: store)
    private let notificationService = NotificationService()

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        return f
    }()

    /// Preview what action would be taken without executing it
    func preview(_ text: String) -> ParsedAction {
        return parser.parse(text)
    }

    func process(_ text: String) async -> ActionResult {
        let parsed = parser.parse(text)

        if parsed.isUnparseable {
            return ActionResult(
                success: false,
                intent: .notification,
                title: parsed.title,
                message: "Couldn't figure out what to do with this. Try something like \"remind me to call mom tomorrow\" or \"meeting at 3pm Friday\"."
            )
        }

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
            // No date for calendar event - create as reminder instead (more useful than notification)
            do {
                let success = try await reminderService.createReminder(title: action.title, dueDate: nil)
                if success {
                    return ActionResult(
                        success: true,
                        intent: .reminder,
                        title: action.title,
                        message: "No date found, so created a reminder instead.",
                        isFallback: true
                    )
                }
            } catch {}
            return await fallbackToNotification(action, reason: "No date detected and reminders unavailable")
        }

        do {
            let success = try await calendarService.createEvent(
                title: action.title,
                startDate: date,
                endDate: action.endDate
            )
            if success {
                return ActionResult(
                    success: true,
                    intent: .calendarEvent,
                    title: action.title,
                    message: "Event added for \(formatDate(date))"
                )
            } else {
                return await fallbackToNotification(action, reason: "Calendar access denied")
            }
        } catch {
            return await fallbackToNotification(action, reason: error.localizedDescription)
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
                    title: action.title,
                    message: "Due: \(dateStr)"
                )
            } else {
                return await fallbackToNotification(action, reason: "Reminders access denied")
            }
        } catch {
            return await fallbackToNotification(action, reason: error.localizedDescription)
        }
    }

    private func handleAlarm(_ action: ParsedAction) async -> ActionResult {
        // iOS doesn't allow programmatic alarm creation - use reminder with alarm as best alternative
        if let date = action.date {
            do {
                let success = try await reminderService.createReminder(title: action.title, dueDate: date)
                if success {
                    return ActionResult(
                        success: true,
                        intent: .reminder,
                        title: action.title,
                        message: "Set as reminder with alert for \(formatDate(date)) (iOS doesn't allow direct alarm creation)",
                        isFallback: true
                    )
                }
            } catch {}
        }

        // Fall back to notification
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
                title: action.title,
                message: "Notification scheduled for \(dateStr) (iOS doesn't allow direct alarm creation)",
                isFallback: true
            )
        } catch {
            return ActionResult(
                success: false,
                intent: .alarm,
                title: action.title,
                message: "Could not set alarm, reminder, or notification: \(error.localizedDescription)"
            )
        }
    }

    private func handleNotification(_ action: ParsedAction) async -> ActionResult {
        // If we have a date, try reminder first (more persistent than a notification)
        if let date = action.date {
            do {
                let success = try await reminderService.createReminder(title: action.title, dueDate: date)
                if success {
                    return ActionResult(
                        success: true,
                        intent: .reminder,
                        title: action.title,
                        message: "Due: \(formatDate(date))"
                    )
                }
            } catch {}
        }

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
                title: action.title,
                message: "Notification \(dateStr)"
            )
        } catch {
            return ActionResult(
                success: false,
                intent: .notification,
                title: action.title,
                message: "Failed: \(error.localizedDescription)"
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
                title: action.title,
                message: "\(reason). Notification scheduled instead (\(dateStr)).",
                isFallback: true
            )
        } catch {
            return ActionResult(
                success: false,
                intent: .notification,
                title: action.title,
                message: "\(reason). Also failed to send notification: \(error.localizedDescription)"
            )
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = Self.dateFormatter
        let calendar = Calendar.current

        if calendar.isDateInToday(date) {
            formatter.dateFormat = "h:mm a 'today'"
        } else if calendar.isDateInTomorrow(date) {
            formatter.dateFormat = "h:mm a 'tomorrow'"
        } else {
            formatter.dateFormat = "EEE, MMM d 'at' h:mm a"
        }

        return formatter.string(from: date)
    }
}
