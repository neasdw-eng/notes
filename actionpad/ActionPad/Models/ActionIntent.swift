import Foundation

enum ActionIntent: String {
    case calendarEvent
    case reminder
    case alarm
    case notification

    var displayName: String {
        switch self {
        case .calendarEvent: return "Calendar Event"
        case .reminder: return "Reminder"
        case .alarm: return "Alarm"
        case .notification: return "Notification"
        }
    }

    var iconName: String {
        switch self {
        case .calendarEvent: return "calendar.badge.plus"
        case .reminder: return "bell.badge"
        case .alarm: return "alarm"
        case .notification: return "bubble.left"
        }
    }
}
