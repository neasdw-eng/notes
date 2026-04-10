import Foundation

class NLParser {

    // Cached detector - NSDataDetector is expensive to create
    private let dateDetector: NSDataDetector? = {
        try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue)
    }()

    // Calendar keywords - events with a specific time/date on the calendar
    private let calendarKeywords = [
        "meeting", "appointment", "schedule", "event", "conference",
        "call with", "lunch with", "dinner with", "breakfast with",
        "expecting", "shipment", "delivery", "arriving", "flight",
        "interview", "reservation", "booked", "booking",
        "class", "lesson", "course", "party", "wedding", "birthday party",
        "concert", "show", "game"
    ]

    // Reminder keywords - tasks/to-dos the user needs to do
    // Includes both straight and smart apostrophe variants
    private let reminderKeywords = [
        "remind", "remember",
        "don't forget", "don\u{2019}t forget",
        "dont forget",
        "pick up", "take out", "call",
        "take medication", "take meds", "buy", "pay",
        "get groceries", "need to", "gotta", "have to",
        "make sure", "follow up", "check on",
        "submit", "send", "return", "cancel",
        "clean", "wash", "fix", "order", "book"
    ]

    // Alarm keywords
    private let alarmKeywords = [
        "alarm", "wake up", "wake me up", "wake me"
    ]

    // Phrases to strip from extracted title (longest first to avoid partial matches)
    private let phrasesToRemove = [
        "remind me to", "remind me",
        "remember to",
        "don't forget to", "don\u{2019}t forget to",
        "dont forget to",
        "don't forget", "don\u{2019}t forget",
        "dont forget",
        "set a reminder to", "set reminder to",
        "set a reminder", "set reminder",
        "schedule a", "schedule an", "schedule",
        "create a", "create an",
        "set an alarm for", "set alarm for", "set an alarm", "set alarm",
        "wake me up at", "wake me up", "wake me at", "wake me",
        "i need to", "i have to", "i gotta", "i have a", "i have an",
        "make sure to", "make sure i",
        "need to", "gotta", "have to",
        "expecting a", "expecting"
    ]

    // Dangling prepositions to clean up after date removal
    private let danglingPrepositions = ["on", "at", "by", "for", "in", "from", "until", "till", "before", "after", "every"]

    func parse(_ text: String) -> ParsedAction {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return ParsedAction(intent: .notification, title: "", date: nil, originalText: text, isUnparseable: true)
        }

        let lowered = trimmed.lowercased()

        // Extract date first (used by both classifier and result)
        let (rawDate, dateRange) = extractDate(from: trimmed)

        // Bump past dates to the future
        let date = rawDate.flatMap { bumpDateIfPast($0) }

        let intent = classifyIntent(lowered, hasDate: date != nil)
        let title = extractTitle(from: trimmed, dateRange: dateRange)

        // If no keyword matched and no date found, mark as unparseable
        let isUnparseable = (intent == .notification && date == nil)

        return ParsedAction(
            intent: intent,
            title: title,
            date: date,
            originalText: text,
            isUnparseable: isUnparseable
        )
    }

    private func classifyIntent(_ text: String, hasDate: Bool) -> ActionIntent {
        // Check alarm first (most specific)
        for keyword in alarmKeywords {
            if text.contains(keyword) { return .alarm }
        }

        // Check calendar keywords before reminder, so "meeting" etc. are events not reminders
        for keyword in calendarKeywords {
            if text.contains(keyword) { return .calendarEvent }
        }

        // Check reminder keywords
        for keyword in reminderKeywords {
            if text.contains(keyword) { return .reminder }
        }

        // If a date is detected but no keyword matched, default to reminder
        if hasDate {
            return .reminder
        }

        return .notification
    }

    private func extractDate(from text: String) -> (Date?, Range<String.Index>?) {
        guard let detector = dateDetector else { return (nil, nil) }

        let nsRange = NSRange(text.startIndex..., in: text)
        let matches = detector.matches(in: text, options: [], range: nsRange)

        guard let match = matches.first, let date = match.date else {
            return (nil, nil)
        }

        let range = Range(match.range, in: text)
        return (date, range)
    }

    /// Bumps a date to the future if it's in the past.
    /// Keeps adding days until the date is in the future.
    private func bumpDateIfPast(_ date: Date) -> Date {
        var result = date
        let now = Date()
        guard result < now else { return result }

        let calendar = Calendar.current

        // Check if this looks like a day-of-month reference (no specific time set)
        // NSDataDetector for date-only inputs like "the 13th" returns midnight
        let components = calendar.dateComponents([.hour, .minute, .second], from: result)
        let isDateOnly = components.hour == 0 && components.minute == 0 && components.second == 0

        if isDateOnly {
            // For date-only references like "the 13th", bump by month until future
            while result < now {
                guard let next = calendar.date(byAdding: .month, value: 1, to: result) else { break }
                result = next
            }
        } else {
            // For time-specific dates, bump by day until future
            while result < now {
                guard let next = calendar.date(byAdding: .day, value: 1, to: result) else { break }
                result = next
            }
        }

        return result
    }

    private func extractTitle(from text: String, dateRange: Range<String.Index>?) -> String {
        var cleaned = text

        // Remove the date substring if found
        if let range = dateRange {
            cleaned = cleaned.replacingCharacters(in: range, with: "")
        }

        // Remove dangling prepositions left behind after date removal
        cleaned = removeDanglingPrepositions(cleaned)

        // Remove common intent phrases (case-insensitive, using range-based replacement)
        cleaned = removeIntentPhrases(cleaned)

        // Clean up whitespace and punctuation
        cleaned = cleaned
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: .punctuationCharacters)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        // If we stripped everything, fall back to original text
        if cleaned.isEmpty {
            cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        // Capitalize first letter
        return cleaned.prefix(1).uppercased() + cleaned.dropFirst()
    }

    /// Safe case-insensitive phrase removal that avoids String index crashes
    private func removeIntentPhrases(_ text: String) -> String {
        var result = text
        for phrase in phrasesToRemove {
            if let range = result.range(of: phrase, options: [.caseInsensitive, .diacriticInsensitive]) {
                result.replaceSubrange(range, with: "")
            }
        }
        return result
    }

    /// Remove trailing prepositions that dangle after date removal
    /// e.g., "flight to NYC on " -> "flight to NYC"
    private func removeDanglingPrepositions(_ text: String) -> String {
        var words = text.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
        // Remove trailing dangling prepositions
        while let last = words.last, danglingPrepositions.contains(last.lowercased()) {
            words.removeLast()
        }
        return words.joined(separator: " ")
    }
}
