import SwiftUI

/// Minimal design tokens. Kept intentionally flat so every screen reads the
/// same values; the app has one visual identity — dense, monochrome, fast.
enum Theme {
    static let accent = Color("AccentColor")
    static let background = Color(uiColor: .systemBackground)
    static let surface = Color(uiColor: .secondarySystemBackground)
    static let border = Color(uiColor: .separator)
    static let textPrimary = Color(uiColor: .label)
    static let textSecondary = Color(uiColor: .secondaryLabel)

    enum Spacing {
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 12
        static let l: CGFloat = 16
        static let xl: CGFloat = 24
    }

    enum Radius {
        static let s: CGFloat = 8
        static let m: CGFloat = 12
        static let l: CGFloat = 16
    }

    enum Font {
        static let mono = SwiftUI.Font.system(.body, design: .monospaced)
        static let monoSmall = SwiftUI.Font.system(.footnote, design: .monospaced)
    }
}
