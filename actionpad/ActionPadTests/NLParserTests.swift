import XCTest
@testable import ActionPad

final class NLParserTests: XCTestCase {
    let parser = NLParser()

    func testReminderIntent() {
        let result = parser.parse("remind me to take medication in 3 days")
        XCTAssertEqual(result.intent, .reminder)
        XCTAssertNotNil(result.date)
        XCTAssertFalse(result.title.isEmpty)
    }

    func testCalendarEventIntent() {
        let result = parser.parse("meeting with John on Friday at 3pm")
        XCTAssertEqual(result.intent, .calendarEvent)
    }

    func testShipmentCalendarEvent() {
        let result = parser.parse("expecting shipment on the 13th")
        XCTAssertEqual(result.intent, .calendarEvent)
        XCTAssertNotNil(result.date)
    }

    func testAlarmIntent() {
        let result = parser.parse("wake me up at 6am")
        XCTAssertEqual(result.intent, .alarm)
    }

    func testNotificationFallback() {
        let result = parser.parse("hello world")
        XCTAssertEqual(result.intent, .notification)
    }

    func testEmptyInput() {
        let result = parser.parse("")
        XCTAssertEqual(result.intent, .notification)
    }

    func testDateExtraction() {
        let result = parser.parse("remind me to call mom tomorrow")
        XCTAssertEqual(result.intent, .reminder)
        XCTAssertNotNil(result.date)
    }

    func testTitleExtraction() {
        let result = parser.parse("remind me to buy groceries")
        XCTAssertEqual(result.intent, .reminder)
        // Title should not contain "remind me to"
        XCTAssertFalse(result.title.lowercased().contains("remind me"))
    }

    func testDateOnlyDefaultsToReminder() {
        let result = parser.parse("tomorrow at noon")
        XCTAssertEqual(result.intent, .reminder)
        XCTAssertNotNil(result.date)
    }
}
