import Foundation

class NLParser {

    private let calendarKeywords = [
        "meeting", "appointment", "schedule", "event", "conference",
        "call with", "lunch with", "dinner with", "breakfast with",
        "expecting", "shipment", "delivery", "arriving", "flight",
        "interview", "reservation", "booked", "booking"
    ]

    private let reminderKeywords = [
        "remind", "remember", "don't forget", "dont forget",
        "pick up", "take medication", "take meds", "buy",
        "get groceries", "need to", "gotta", "have to",
        "make sure", "follow up", "check on"
    ]

    private let alarmKeywords = [
        "alarm", "wake up", "wake me"
    ]

    func parse(_ text: String) -> ParsedAction {
        let lowered = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

        let intent = classifyIntent(lowered)
        let (date, dateRange) = extractDate(from: text)
        let title = extractTitle(from: text, dateRange: dateRange, intent: intent)

        return ParsedAction(
            intent: intent,
            title: title,
            date: date,
            endDate: nil,
            originalText: text
        )
    }

    private func classifyIntent(_ text: String) -> ActionIntent {
        // Check in priority order: reminder > calendar > alarm > notification
        for keyword in reminderKeywords {
            if text.contains(keyword) { return .reminder }
        }
        for keyword in alarmKeywords {
            if text.contains(keyword) { return .alarm }
        }
        for keyword in calendarKeywords {
            if text.contains(keyword) { return .calendarEvent }
        }

        // If a date is detected but no keyword matched, default to reminder
        let (date, _) = extractDate(from: text)
        if date != nil {
            return .reminder
        }

        return .notification
    }

    private func extractDate(from text: String) -> (Date?, Range<String.Index>?) {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue) else {
            return (nil, nil)
        }

        let nsRange = NSRange(text.startIndex..., in: text)
        let matches = detector.matches(in: text, options: [], range: nsRange)

        guard let match = matches.first, let date = match.date else {
            return (nil, nil)
        }

        let range = Range(match.range, in: text)
        return (date, range)
    }

    private func extractTitle(from text: String, dateRange: Range<String.Index>?, intent: ActionIntent) -> String {
        var cleaned = text

        // Remove the date substring if found
        if let range = dateRange {
            cleaned = cleaned.replacingCharacters(in: range, with: "")
        }

        // Remove common intent phrases
        let phrasesToRemove = [
            "remind me to", "remind me", "remember to", "don't forget to",
            "dont forget to", "set a reminder to", "set reminder to",
            "schedule a", "schedule an", "schedule", "create a", "create an",
            "set an alarm for", "set alarm for", "set an alarm", "set alarm",
            "wake me up at", "wake me up", "wake me at", "wake me",
            "i need to", "i have to", "i gotta", "i have a", "i have an",
            "make sure to", "make sure i", "need to", "gotta",
            "expecting a", "expecting"
        ]

        let lowered = cleaned.lowercased()
        for phrase in phrasesToRemove {
            if let range = lowered.range(of: phrase) {
                let startIdx = cleaned.index(cleaned.startIndex, offsetBy: lowered.distance(from: lowered.startIndex, to: range.lowerBound))
                let endIdx = cleaned.index(cleaned.startIndex, offsetBy: lowered.distance(from: lowered.startIndex, to: range.upperBound))
                cleaned = cleaned.replacingCharacters(in: startIdx..<endIdx, with: "")
            }
        }

        // Clean up whitespace and punctuation
        cleaned = cleaned
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
}
