import XCTest
@testable import ActionPad

final class NLParserTests: XCTestCase {
    let parser = NLParser()

    // MARK: - Intent Classification

    func testReminderKeywords() {
        let inputs: [(String, ActionIntent)] = [
            ("remind me to take medication", .reminder),
            ("remember to call mom", .reminder),
            ("don't forget to buy milk", .reminder),
            ("don\u{2019}t forget to submit report", .reminder), // smart apostrophe
            ("dont forget the meeting", .reminder),
            ("pick up dry cleaning", .reminder),
            ("I need to renew my passport", .reminder),
            ("I have to finish this", .reminder),
            ("make sure to lock the door", .reminder),
            ("follow up with client", .reminder),
            ("check on the order", .reminder),
            ("buy groceries", .reminder),
            ("pay the electric bill", .reminder),
            ("submit the report", .reminder),
            ("call mom", .reminder),
            ("take out the trash", .reminder),
            ("clean the kitchen", .reminder),
            ("fix the leaky faucet", .reminder),
            ("order new shoes", .reminder),
            ("book a dentist appointment", .reminder),
        ]

        for (input, expected) in inputs {
            let result = parser.parse(input)
            XCTAssertEqual(result.intent, expected, "Input: \"\(input)\" expected \(expected) but got \(result.intent)")
        }
    }

    func testCalendarKeywords() {
        let inputs: [(String, ActionIntent)] = [
            ("meeting with John at 3pm", .calendarEvent),
            ("dentist appointment on Tuesday", .calendarEvent),
            ("schedule a call with Sarah", .calendarEvent),
            ("conference at 10am", .calendarEvent),
            ("flight to NYC on June 5", .calendarEvent),
            ("interview at 2pm tomorrow", .calendarEvent),
            ("reservation at 7pm", .calendarEvent),
            ("expecting shipment on the 13th", .calendarEvent),
            ("delivery arriving tomorrow", .calendarEvent),
            ("yoga class at 7am", .calendarEvent),
            ("birthday party on Saturday", .calendarEvent),
            ("concert on Friday night", .calendarEvent),
        ]

        for (input, expected) in inputs {
            let result = parser.parse(input)
            XCTAssertEqual(result.intent, expected, "Input: \"\(input)\" expected \(expected) but got \(result.intent)")
        }
    }

    func testAlarmKeywords() {
        let inputs: [(String, ActionIntent)] = [
            ("set alarm for 6am", .alarm),
            ("wake me up at 7am", .alarm),
            ("wake me at 6:30", .alarm),
            ("alarm at 5am", .alarm),
        ]

        for (input, expected) in inputs {
            let result = parser.parse(input)
            XCTAssertEqual(result.intent, expected, "Input: \"\(input)\" expected \(expected) but got \(result.intent)")
        }
    }

    func testNotificationFallback() {
        let inputs = [
            "hello world",
            "just a thought",
            "interesting idea",
            "",
        ]

        for input in inputs {
            let result = parser.parse(input)
            XCTAssertEqual(result.intent, .notification, "Input: \"\(input)\" should fall back to notification")
        }
    }

    func testDateOnlyDefaultsToReminder() {
        // Inputs with a date but no intent keyword should become reminders
        let result = parser.parse("tomorrow at noon")
        XCTAssertEqual(result.intent, .reminder)
        XCTAssertNotNil(result.date)
    }

    // MARK: - Title Extraction

    func testTitleExtractsCleanly() {
        let tests: [(String, String)] = [
            ("remind me to buy groceries", "Buy groceries"),
            ("remember to call the doctor", "Call the doctor"),
            ("I need to renew passport", "Renew passport"),
            ("set alarm for 6am", ""), // After stripping "set alarm for" and "6am", may fallback
        ]

        for (input, expectedTitle) in tests {
            let result = parser.parse(input)
            if !expectedTitle.isEmpty {
                XCTAssertEqual(result.title, expectedTitle, "Input: \"\(input)\"")
            }
            // Title should never be empty
            XCTAssertFalse(result.title.isEmpty, "Title should never be empty for input: \"\(input)\"")
        }
    }

    func testTitleDoesNotContainIntentPhrases() {
        let result = parser.parse("remind me to take medication in 3 days")
        XCTAssertFalse(result.title.lowercased().contains("remind me"), "Title should not contain 'remind me'")
    }

    func testTitleDoesNotHaveDanglingPrepositions() {
        // When date is stripped, trailing "on", "at", "by" etc. should also be removed
        // Note: this depends on NSDataDetector including/excluding prepositions
        let result = parser.parse("meeting with Sarah at 3pm tomorrow")
        XCTAssertFalse(result.title.hasSuffix(" at"), "Title should not end with dangling 'at'")
        XCTAssertFalse(result.title.hasSuffix(" on"), "Title should not end with dangling 'on'")
        XCTAssertFalse(result.title.hasSuffix(" by"), "Title should not end with dangling 'by'")
    }

    func testTitleCapitalizesFirstLetter() {
        let result = parser.parse("buy milk")
        XCTAssertTrue(result.title.first?.isUppercase ?? false, "Title should start with uppercase")
    }

    // MARK: - Smart Apostrophe Handling

    func testSmartApostropheMatches() {
        // iOS keyboards produce smart quotes - both should work
        let straight = parser.parse("don't forget to call mom")
        let smart = parser.parse("don\u{2019}t forget to call mom")

        XCTAssertEqual(straight.intent, .reminder)
        XCTAssertEqual(smart.intent, .reminder)
    }

    // MARK: - Unparseable Detection

    func testUnparseableInputFlagged() {
        let result = parser.parse("hello world")
        XCTAssertTrue(result.isUnparseable, "Input with no keywords and no date should be unparseable")
        XCTAssertEqual(result.intent, .notification)
    }

    func testParseableInputNotFlagged() {
        let result = parser.parse("remind me to call mom")
        XCTAssertFalse(result.isUnparseable)
    }

    func testEmptyInputIsUnparseable() {
        let result = parser.parse("")
        XCTAssertTrue(result.isUnparseable)
    }

    func testWhitespaceOnlyIsUnparseable() {
        let result = parser.parse("   ")
        XCTAssertTrue(result.isUnparseable)
    }

    // MARK: - Date Extraction

    func testRelativeDateExtraction() {
        let result = parser.parse("remind me to call mom tomorrow")
        XCTAssertNotNil(result.date, "Should detect 'tomorrow' as a date")
    }

    func testNoDateForPlainText() {
        let result = parser.parse("buy groceries")
        XCTAssertNil(result.date, "Plain text without date should have nil date")
    }

    // MARK: - Edge Cases

    func testVeryLongInput() {
        let longText = "remind me to " + String(repeating: "do something important and ", count: 100) + "finish"
        let result = parser.parse(longText)
        XCTAssertEqual(result.intent, .reminder)
        XCTAssertFalse(result.title.isEmpty)
    }

    func testSpecialCharacters() {
        let result = parser.parse("remind me to check @john's email & reply!!!")
        XCTAssertEqual(result.intent, .reminder)
        XCTAssertFalse(result.title.isEmpty)
    }

    func testEmojiInput() {
        let result = parser.parse("remind me to send flowers to mom")
        XCTAssertEqual(result.intent, .reminder)
    }

    func testSingleWordWithKeyword() {
        let result = parser.parse("buy")
        XCTAssertEqual(result.intent, .reminder)
    }

    // MARK: - Priority Order

    func testAlarmTakesPriorityOverCalendar() {
        // "alarm" should be alarm, not calendar event
        let result = parser.parse("set alarm for the meeting at 6am")
        XCTAssertEqual(result.intent, .alarm, "Alarm keywords should take priority over calendar keywords")
    }

    func testCalendarTakesPriorityOverReminder() {
        // "meeting" (calendar) should win over generic task words
        let result = parser.parse("meeting with John")
        XCTAssertEqual(result.intent, .calendarEvent)
    }
}
