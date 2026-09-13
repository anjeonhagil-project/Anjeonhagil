export function shouldApplyAuthSession(currentSession, nextSession, event) {
    if (event === 'USER_UPDATED') return true

    return currentSession?.user?.id !== nextSession?.user?.id
}

export async function loadAuthSnapshot({ loadProfile, loadTerms, loadAccountStatus }) {
    try {
        const [profile, terms] = await Promise.all([
            loadProfile(),
            loadTerms(),
        ])

        return {
            profile,
            termsAgreed: terms.agreed,
            accountStatus: {
                isActive: true,
                canRestore: false,
            },
        }
    } catch {
        let accountStatus = null

        if (loadAccountStatus) {
            try {
                accountStatus = await loadAccountStatus()
            } catch {
                accountStatus = null
            }
        }

        return {
            profile: null,
            termsAgreed: null,
            accountStatus,
        }
    }
}
