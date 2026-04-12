import 'dotenv/config'
import { GitHubClient } from '../../integrations/github/github.client'

describe('GitHubClient (integration)', () => {
    const client = new GitHubClient()
    jest.setTimeout(15000)

    // -------- repoExists --------

    it('should return true for existing repo', async () => {
        const result = await client.repoExists('facebook/react')

        expect(result).toBe(true)
    })

    it('should return false for non-existing repo', async () => {
        const result = await client.repoExists('some-non-existing/repo-xyz-123')

        expect(result).toBe(false)
    })

    it('should return false for invalid repo format', async () => {
        const result = await client.repoExists('invalid-format')
        expect(result).toBe(false)
    })

    // -------- getLatestRelease --------

    it('should return latest release tag', async () => {
        const result = await client.getLatestRelease('facebook/react')

        expect(result).toHaveProperty('tag')
        expect(result.headers).toBeDefined()
    })

    it('should return null tag if no releases', async () => {
        const result = await client.getLatestRelease('octocat/Hello-World')

        expect(result.tag === null || typeof result.tag === 'string').toBe(true)
    })

    it('should return null tag for invalid repo', async () => {
        const result = await client.getLatestRelease('invalid/repo/format')

        expect(result.tag).toBeNull()
    })
})