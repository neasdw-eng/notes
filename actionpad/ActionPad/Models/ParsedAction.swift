import Foundation

struct ParsedAction {
    let intent: ActionIntent
    let title: String
    let date: Date?
    let endDate: Date?
    let originalText: String
}

struct ActionResult {
    let success: Bool
    let intent: ActionIntent
    let message: String
}
