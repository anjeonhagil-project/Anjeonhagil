// 30일이 지난 탈퇴 계정을 점검하거나 정리하는 독립 실행 스크립트.
// 기본 실행은 조회만 한다. 실제 삭제는 --execute를 명시해야 한다.
import { supabase } from '../src/lib/supabase.js'

const RETENTION_DAYS = 30
const isExecuteMode = process.argv.includes('--execute')
const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
).toISOString()

async function findExpiredWithdrawnAccounts() {
    const { data, error } = await supabase
        .from('users')
        .select('id, withdrawn_at')
        .eq('is_active', false)
        .not('withdrawn_at', 'is', null)
        .lte('withdrawn_at', cutoff)

    if (error) throw error
    return data ?? []
}

async function deleteAccount(userId) {
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    if (authError) throw authError

    // public.users가 auth.users를 FK cascade로 참조하지 않는 환경도 지원한다.
    const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

    if (profileError) throw profileError
}

async function main() {
    const accounts = await findExpiredWithdrawnAccounts()

    console.log(`30일 경과 탈퇴 계정: ${accounts.length}명`)
    console.table(accounts)

    if (!isExecuteMode) {
        console.log('조회만 완료했습니다. 실제 삭제는 --execute 옵션을 붙여 실행하세요.')
        return
    }

    for (const account of accounts) {
        await deleteAccount(account.id)
        console.log(`삭제 완료: ${account.id}`)
    }
}

main().catch((error) => {
    console.error('탈퇴 계정 정리 실패:', error.message)
    process.exitCode = 1
})
