const BASE_URL = process.env.APP_URL

export function confirmEmailTemplate(token: string) {
  return `
    <div>
        <h2>Confirm subscription</h2>
        <div>
            <p>Click to confirm button or use this link in your browser window: ${BASE_URL}/api/confirm/${token}</p>
            <br>
            <a href="${BASE_URL}/api/confirm/${token}" target="_blank" style="padding: 8px 23px; color: inherit; border: 1px solid #747775; border-radius: 18px; text-decoration: none; line-height: 20px;">
            Confirm subscription
            </a>
            <p><br>If you didn't request this email, you can safely ignore it.</p>
        </div>
    </div>
  `
}