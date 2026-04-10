import SwiftUI

struct ConfirmationView: View {
    let result: ActionResult
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: result.success ? result.intent.iconName : "xmark.circle")
                .font(.system(size: 48))
                .foregroundStyle(result.success ? .green : .red)

            Text(result.success ? "Done" : "Failed")
                .font(.title2)
                .fontWeight(.bold)

            Text(result.message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

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
        }
        .padding()
    }
}

#Preview {
    ConfirmationView(
        result: ActionResult(
            success: true,
            intent: .reminder,
            message: "Reminder set: Take medication (Apr 13, 9:00 AM)"
        ),
        onDismiss: {}
    )
}
