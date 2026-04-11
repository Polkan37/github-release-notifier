# GitHub Release Notifier

API that allows users to subscribe to email notifications about new releases of a chosen GitHub repository.


## Run
docker-compose up -d
npm run dev





## Github subscribed repos monitoring

The scanner runs every minute via a cron job, fetches a batch of repositories starting from the last processed cursor, and processes them concurrently with a controlled limit 5 using p-limit. For each repository, it requests the latest release from GitHub, compares the received tag with the stored lastSeenTag, and if a new release is detected, creates notification records for all active subscriptions (avoiding duplicates). It then updates the repository state and lastScannedRepoId to ensure continuous, incremental scanning. The scanner also handles GitHub rate limits by reading response headers and pausing execution until reset if limits are reached.


