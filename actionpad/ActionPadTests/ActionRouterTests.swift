import XCTest
@testable import ActionPad

final class ActionRouterTests: XCTestCase {
    let router = ActionRouter()

    // MARK: - Parser Integration (deterministic, no system permissions needed)

    func testParserProducesCorrectIntents() {
        let testCases: [(String, ActionIntent)] = [
            ("expecting shipment on the 13th", .calendarEvent),
            ("remind me to take medication in 3 days", .reminder),
            ("meeting with Sarah at 3pm tomorrow", .calendarEvent),
            ("buy groceries", .reminder),
            ("wake me up at 6am", .alarm),
            ("need to renew passport", .reminder),
            ("flight to NYC on June 5", .calendarEvent),
            ("dentist appointment next Tuesday at 10am", .calendarEvent),
            ("lunch with team at noon", .calendarEvent),
        ]

        for (input, expected) in testCases {
            let preview = router.preview(input)
            XCTAssertEqual(preview.intent, expected, "Input: \"\(input)\" expected \(expected) but got \(preview.intent)")
        }
    }

    func testUnparseableInputDetected() {
        let inputs = ["hello world", "interesting", "lol", ""]
        for input in inputs {
            let preview = router.preview(input)
            XCTAssertTrue(preview.isUnparseable || preview.intent == .notification,
                         "Input: \"\(input)\" should be unparseable or notification")
        }
    }

    func testUnparseableInputReturnsFailure() async {
        let result = await router.process("hello world")
        XCTAssertFalse(result.success, "Unparseable input should return failure")
        XCTAssertTrue(result.message.contains("Couldn't figure out"), "Should show helpful message")
    }

    // MARK: - Preview Function

    func testPreviewDoesNotMutateState() {
        let preview1 = router.preview("remind me to call mom")
        let preview2 = router.preview("meeting at 3pm")
        let preview3 = router.preview("remind me to call mom")

        XCTAssertEqual(preview1.intent, preview3.intent, "Preview should be stateless")
        XCTAssertEqual(preview1.title, preview3.title, "Preview should be stateless")
    }

    // MARK: - Title Quality

    func testTitlesAreUseful() {
        let tests: [(String, String)] = [
            ("remind me to buy groceries", "Buy groceries"),
            ("need to renew passport", "Renew passport"),
        ]

        for (input, expectedTitle) in tests {
            let preview = router.preview(input)
            XCTAssertEqual(preview.title, expectedTitle, "Input: \"\(input)\"")
        }
    }

    func testTitlesNeverEmpty() {
        let inputs = [
            "remind me to call mom",
            "meeting at 3pm",
            "buy groceries",
            "wake me up at 6am",
            "expecting shipment",
            "hello world",
        ]

        for input in inputs {
            let preview = router.preview(input)
            XCTAssertFalse(preview.title.isEmpty, "Title should never be empty for: \"\(input)\"")
        }
    }

    // MARK: - Date Handling

    func testDatesPresentWhenExpected() {
        let withDates = [
            "remind me to call mom tomorrow",
            "meeting at 3pm tomorrow",
        ]

        for input in withDates {
            let preview = router.preview(input)
            XCTAssertNotNil(preview.date, "Should have a date for: \"\(input)\"")
        }
    }

    func testDatesNilWhenNonePresent() {
        let withoutDates = [
            "buy groceries",
            "need to renew passport",
            "hello world",
        ]

        for input in withoutDates {
            let preview = router.preview(input)
            XCTAssertNil(preview.date, "Should have no date for: \"\(input)\"")
        }
    }

    func testPastDatesAreBumped() {
        // Dates in the past should be bumped forward
        // We can test this indirectly: any parsed date should be >= now
        let result = router.preview("remind me to call mom tomorrow")
        if let date = result.date {
            XCTAssertGreaterThanOrEqual(date, Date(), "Parsed dates should never be in the past")
        }
    }
}
