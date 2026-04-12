
const form = document.getElementById('subscribe-form')
const message = document.getElementById('message')

const emailInput = document.getElementById('email')
const repoInput = document.getElementById('repo')

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateRepo(repo) {
    return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)
}

function showError(input, text) {
    input.style.border = '1px solid red'
    input.title = text
}

function clearError(input) {
    input.style.border = ''
    input.title = ''
}

emailInput.addEventListener('input', () => {
    if (validateEmail(emailInput.value)) clearError(emailInput)
})

repoInput.addEventListener('input', () => {
    if (validateRepo(repoInput.value)) clearError(repoInput)
})

form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const email = emailInput.value.trim()
    const repo = repoInput.value.trim()

    let valid = true
    let errorText = ''

    // reset UI
    clearError(emailInput)
    clearError(repoInput)
    message.textContent = ''
    message.className = ''

    // validate email
    if (!validateEmail(email)) {
        showError(emailInput, 'Invalid email format')
        errorText = 'Invalid email format'
        valid = false
    }

    // validate repo
    if (!validateRepo(repo)) {
        showError(repoInput, 'Format must be owner/repo')
        errorText = 'Format must be owner/repo'
        valid = false
    }

    if (!valid) {
        message.className = 'message error'
        message.textContent = errorText
        return
    }

    message.textContent = 'Sending...'

    try {
        const res = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, repo }),
        })

        const data = await res.json().catch(() => null)

        if (!res.ok) {
            throw new Error(data?.message || 'Request failed')
        }

        message.className = 'message success'
        message.textContent =
            data?.message || 'Check your email to confirm subscription'

        form.reset()
    } catch (err) {
        message.className = 'message error'
        message.textContent =
            err instanceof Error ? err.message : 'Unexpected error'
    }
})
