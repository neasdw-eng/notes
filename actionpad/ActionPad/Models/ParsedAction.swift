import Foundation

struct ParsedAction {
    let intent: ActionIntent
    let title: String
    let date: Date?
    let endDate: Date?
    let originalText: String
    let isUnparseable: Bool

    init(intent: ActionIntent, title: String, date: Date?, endDate: Date? = nil, originalText: String, isUnparseable: Bool = false) {
        self.intent = intent
        self.title = title
        self.date = date
        self.endDate = endDate
        self.originalText = originalText
        self.isUnparseable = isUnparseable
    }
}

struct ActionResult: Identifiable {
    let id = UUID()
    let success: Bool
    let intent: ActionIntent
    let title: String
    let message: String
    let isFallback: Bool

    init(success: Bool, intent: ActionIntent, title: String = "", message: String, isFallback: Bool = false) {
        self.success = success
        self.intent = intent
        self.title = title
        self.message = message
        self.isFallback = isFallback
    }
}
