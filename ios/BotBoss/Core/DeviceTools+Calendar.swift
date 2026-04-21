import EventKit
import Foundation

/// Calendar + Reminders access through EventKit. The agent can read
/// upcoming events, create events, and read/write reminders — provided the
/// user granted access via the system prompt. This is unreachable to any
/// web competitor.
struct CalendarEventsTool: DeviceTool {
    let name = "device.calendar.upcoming"
    let label = "Upcoming calendar events"
    let requiresPermission = "Calendar"

    func run(input: [String: Any]) async throws -> DeviceToolResult {
        let store = EKEventStore()
        try await requestAccess(store: store, entity: .event)

        let days = (input["days"] as? Int).flatMap { min(max($0, 1), 30) } ?? 7
        let start = Date()
        let end = Calendar.current.date(byAdding: .day, value: days, to: start)!
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: predicate)

        let rows: [[String: String]] = events.prefix(50).map { e in
            [
                "title": e.title ?? "",
                "start": ISO8601DateFormatter().string(from: e.startDate),
                "end": ISO8601DateFormatter().string(from: e.endDate),
                "location": e.location ?? "",
                "calendar": e.calendar.title,
            ]
        }

        return DeviceToolResult(
            ok: true,
            summary: "\(rows.count) events in the next \(days) day(s)",
            data: ["events": AnyEncodable(rows)],
            error: nil
        )
    }
}

struct CreateCalendarEventTool: DeviceTool {
    let name = "device.calendar.create"
    let label = "Create calendar event"
    let requiresPermission = "Calendar"

    func run(input: [String: Any]) async throws -> DeviceToolResult {
        let store = EKEventStore()
        try await requestAccess(store: store, entity: .event)

        guard let title = input["title"] as? String,
              let startISO = input["start"] as? String,
              let endISO = input["end"] as? String,
              let start = ISO8601DateFormatter().date(from: startISO),
              let end = ISO8601DateFormatter().date(from: endISO)
        else {
            return DeviceToolResult(
                ok: false, summary: "Missing title/start/end", data: nil,
                error: "Invalid input"
            )
        }

        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = start
        event.endDate = end
        event.notes = input["notes"] as? String
        event.location = input["location"] as? String
        event.calendar = store.defaultCalendarForNewEvents

        try store.save(event, span: .thisEvent)
        return DeviceToolResult(
            ok: true,
            summary: "Created “\(title)” on \(start.formatted(date: .abbreviated, time: .shortened))",
            data: ["eventIdentifier": AnyEncodable(event.eventIdentifier ?? "")],
            error: nil
        )
    }
}

struct RemindersTool: DeviceTool {
    let name = "device.reminders.add"
    let label = "Add reminder"
    let requiresPermission = "Reminders"

    func run(input: [String: Any]) async throws -> DeviceToolResult {
        let store = EKEventStore()
        try await requestAccess(store: store, entity: .reminder)

        guard let title = input["title"] as? String else {
            return DeviceToolResult(ok: false, summary: "Missing title", data: nil, error: nil)
        }

        let reminder = EKReminder(eventStore: store)
        reminder.title = title
        reminder.notes = input["notes"] as? String
        reminder.calendar = store.defaultCalendarForNewReminders()

        if let dueISO = input["due"] as? String,
           let due = ISO8601DateFormatter().date(from: dueISO) {
            reminder.dueDateComponents = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute], from: due
            )
            reminder.addAlarm(EKAlarm(absoluteDate: due))
        }

        try store.save(reminder, commit: true)
        return DeviceToolResult(
            ok: true, summary: "Reminder added: \(title)", data: nil, error: nil
        )
    }
}

private func requestAccess(store: EKEventStore, entity: EKEntityType) async throws {
    switch entity {
    case .event:
        if #available(iOS 17.0, *) {
            let granted = try await store.requestFullAccessToEvents()
            if !granted { throw DeviceToolError.permissionDenied("Calendar") }
        } else {
            let granted = try await store.requestAccess(to: .event)
            if !granted { throw DeviceToolError.permissionDenied("Calendar") }
        }
    case .reminder:
        if #available(iOS 17.0, *) {
            let granted = try await store.requestFullAccessToReminders()
            if !granted { throw DeviceToolError.permissionDenied("Reminders") }
        } else {
            let granted = try await store.requestAccess(to: .reminder)
            if !granted { throw DeviceToolError.permissionDenied("Reminders") }
        }
    @unknown default:
        throw DeviceToolError.permissionDenied("Unknown")
    }
}

enum DeviceToolError: Error, LocalizedError {
    case permissionDenied(String)
    var errorDescription: String? {
        switch self {
        case .permissionDenied(let what): return "\(what) access denied"
        }
    }
}
