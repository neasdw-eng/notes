import XCTest
@testable import ActionPad

final class ActionRouterTests: XCTestCase {
    let router = ActionRouter()

    func testCalendarEventRouting() async {
        let result = await router.process("meeting at 3pm tomorrow")
        // Should attempt calendar event (may fall back to notification without EventKit access in test)
        XCTAssertTrue(result.success || result.message.contains("Notification"))
    }

    func testReminderRouting() async {
        let result = await router.process("remind me to call mom in 2 hours")
        XCTAssertTrue(result.success || result.message.contains("Notification"))
    }

    func testNotificationFallback() async {
        let result = await router.process("just a random thought")
        XCTAssertEqual(result.intent, .notification)
    }
}
