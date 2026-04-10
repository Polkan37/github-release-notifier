import { GitHubClient } from '../integrations/github/github.client'

async function run() {
  const client = new GitHubClient()

  console.log('Repo exists (microsoft/markitdown):')
  console.log(await client.repoExists('microsoft/markitdown'))

  console.log('Latest release:')
  console.log(await client.getLatestRelease('microsoft/markitdown'))
}

run()