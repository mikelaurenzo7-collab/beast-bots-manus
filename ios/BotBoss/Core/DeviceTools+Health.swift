import Foundation
import HealthKit

/// HealthKit summary reader. The raw samples stay on device; we only
/// surface aggregated daily totals to the agent (steps, active energy,
/// sleep hours) — never raw heart rate traces or ECG data. That's both an
/// Apple requirement and a reasonable default for privacy.
struct HealthSummaryTool: DeviceTool {
    let name = "device.health.daily_summary"
    let label = "Daily health summary"
    let requiresPermission = "Health"

    func run(input: [String: Any]) async throws -> DeviceToolResult {
        guard HKHealthStore.isHealthDataAvailable() else {
            return DeviceToolResult(
                ok: false, summary: "HealthKit not available on this device",
                data: nil, error: nil
            )
        }
        let store = HKHealthStore()
        let types: Set<HKObjectType> = [
            HKQuantityType(.stepCount),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.distanceWalkingRunning),
        ]
        try await store.requestAuthorization(toShare: [], read: types)

        let days = (input["days"] as? Int).flatMap { min(max($0, 1), 30) } ?? 7
        let end = Date()
        let start = Calendar.current.date(byAdding: .day, value: -days, to: end)!

        async let steps = sumQuantity(store: store, type: .stepCount,
                                      unit: .count(), start: start, end: end)
        async let calories = sumQuantity(store: store, type: .activeEnergyBurned,
                                         unit: .kilocalorie(), start: start, end: end)
        async let miles = sumQuantity(store: store, type: .distanceWalkingRunning,
                                      unit: .mile(), start: start, end: end)

        let summary: [String: Double] = [
            "steps": (try? await steps) ?? 0,
            "activeCalories": (try? await calories) ?? 0,
            "miles": (try? await miles) ?? 0,
        ]

        return DeviceToolResult(
            ok: true,
            summary: "Last \(days)d: \(Int(summary["steps"] ?? 0)) steps, \(Int(summary["miles"] ?? 0))mi",
            data: ["totals": AnyEncodable(summary), "days": AnyEncodable(days)],
            error: nil
        )
    }

    private func sumQuantity(
        store: HKHealthStore,
        type: HKQuantityTypeIdentifier,
        unit: HKUnit,
        start: Date,
        end: Date
    ) async throws -> Double {
        try await withCheckedThrowingContinuation { cont in
            let q = HKStatisticsQuery(
                quantityType: HKQuantityType(type),
                quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end),
                options: .cumulativeSum
            ) { _, stats, error in
                if let error { cont.resume(throwing: error); return }
                cont.resume(returning: stats?.sumQuantity()?.doubleValue(for: unit) ?? 0)
            }
            store.execute(q)
        }
    }
}
