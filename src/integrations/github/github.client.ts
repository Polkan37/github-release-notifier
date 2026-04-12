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

        const remaining = res.headers.get('x-ratelimit-remaining')
        if (res.status === 429 || remaining === '0') {
            throw new Error("GitHub rate limit exceeded");
        }
        if (res.status === 403) {
            throw new Error('GitHub access forbidden or rate limited')
        }
        if (res.status >= 500) {
            throw new Error('GitHub server error')
        }
        if (!res.ok) {
            throw new Error(`GitHub error: ${res.status}`)
        }

        return true;
    }

    async getLatestRelease(fullName: string): Promise<{ tag: string | null; headers: Headers }> {
        const res = await fetch(`${BASE_URL}/repos/${fullName}/releases/latest`, {
            headers: this.headers,
        });
        type GitHubError = Error & {
            status?: number
            headers?: Headers
        }

        if (res.status === 404) return { tag: null, headers: res.headers }

        if (!res.ok) {
            const text = await res.text()
            const error = new Error(text) as GitHubError
            
            error.status = res.status
            error.headers = res.headers
            throw error
        }

        const data = await res.json()

        return {
            tag: data.tag_name ?? null,
            headers: res.headers,
        }

    }
}
