export type SubscriptionDTO = {
  email: string
  repo: string
  confirmed: boolean
  lastSeenTag: string | null
}

export type SubscribeBody = {
  email: string
  repo: string
}

export type TokenParams = {
  token: string
}

export type SubscriptionsQuery = {
  email: string
}

export type SubscriptionResponse = {
  email: string
  repo: string
  confirmed: boolean
  last_seen_tag: string | null
}

export type ServiceError =
  | 'Invalid repository format'
  | 'Repository not found'
  | 'Already subscribed'
