const BASE_URL = "https://api.github.com";

export class GitHubClient {
    private token = process.env.GITHUB_TOKEN;

    private get headers() {
        return {
            ...(this.token && { Authorization: `Bearer ${this.token}` }),
        };
    }

    async repoExists(fullName: string): Promise<boolean> {
        const res = await fetch(`${BASE_URL}/repos/${fullName}`, {
            headers: this.headers,
        });

        if (res.status === 404) return false;

        if (res.status === 429) {
            throw new Error("GitHub rate limit exceeded");
        }

        if (!res.ok) {
            throw new Error(`GitHub error: ${res.status}`);
        }

        return true;
    }

    async getLatestRelease(fullName: string): Promise<string | null> {
        const releaseRes = await fetch(`${BASE_URL}/repos/${fullName}/releases/latest`, {
            headers: this.headers,
        });

        if (releaseRes.ok) {
            const data = await releaseRes.json()
            return data.tag_name
        }

        const tagsRes = await fetch(`${BASE_URL}/repos/${fullName}/tags`)

        if (!tagsRes.ok) return null

        const tags = await tagsRes.json()

        return tags[0]?.name || null
    }
}
