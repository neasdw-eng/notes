import SwiftUI

struct ConfirmationView: View {
    let result: ActionResult
    let onDismiss: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Status icon
                Image(systemName: statusIcon)
                    .font(.system(size: 44))
                    .foregroundStyle(statusColor)
                    .padding(.top, 8)

                // Intent label
                Text(statusLabel)
                    .font(.title3)
                    .fontWeight(.bold)

                // Title of created item
                if !result.title.isEmpty {
                    Text(result.title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                // Detail message
                Text(result.message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                // Dismiss button
                Button {
                    onDismiss()
                } label: {
                    Text("OK")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 40)
                .padding(.top, 4)
            }
            .padding()
        }
    }

    private var statusIcon: String {
        if !result.success {
            return "xmark.circle"
        }
        if result.isFallback {
            return "exclamationmark.triangle"
        }
        return result.intent.iconName
    }

    private var statusColor: Color {
        if !result.success {
            return .red
        }
        if result.isFallback {
            return .orange
        }
        return .green
    }

    private var statusLabel: String {
        if !result.success {
            return "Couldn't Do That"
        }
        if result.isFallback {
            return "\(result.intent.displayName) Created (Fallback)"
        }
        return "\(result.intent.displayName) Created"
    }
}

#Preview("Success") {
    ConfirmationView(
        result: ActionResult(
            success: true,
            intent: .reminder,
            title: "Take medication",
            message: "Due: 9:00 AM tomorrow"
        ),
        onDismiss: {}
    )
}

#Preview("Fallback") {
    ConfirmationView(
        result: ActionResult(
            success: true,
            intent: .notification,
            title: "Meeting with John",
            message: "Calendar access denied. Notification scheduled instead.",
            isFallback: true
        ),
        onDismiss: {}
    )
}

#Preview("Failure") {
    ConfirmationView(
        result: ActionResult(
            success: false,
            intent: .notification,
            title: "",
            message: "Couldn't figure out what to do with this. Try something like \"remind me to call mom tomorrow\"."
        ),
        onDismiss: {}
    )
}
