export function releaseTemplate(
    repo: string,
    tag: string,
    unsubscribeToken: string
) {
    return `
    <h2>New release in ${repo}</h2>
    <p>Hello, <br> Repo: <b>${repo}</b> has new release <b>${tag}</b></p>

    <p style="margin-top:20px;font-size:12px;color:#888;">
      If you no longer want to receive these notifications,
      <a href="${process.env.APP_URL}/api/unsubscribe/${unsubscribeToken}">
        unsubscribe here
      </a>.
    </p>
  `
}