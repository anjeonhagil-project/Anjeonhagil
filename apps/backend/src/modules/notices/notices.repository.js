// # 기능: NOTICE-001~002: 사용자 공지 목록/상세 DB query 전담
import { supabase } from '../../lib/supabase.js'

const NOTICE_SELECT = [
    'id',
    'title',
    'content',
    'published_at',
].join(', ')

export async function findPublishedNotices({ page, limit }) {
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data, error, count } = await supabase
        .from('notices')
        .select(NOTICE_SELECT, { count: 'exact' })
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .range(from, to)

    if (error) throw error
    return { notices: data ?? [], total: count ?? 0 }
}

export async function findPublishedNoticeById(noticeId) {
    const { data, error } = await supabase
        .from('notices')
        .select(NOTICE_SELECT)
        .eq('id', noticeId)
        .eq('is_published', true)
        .maybeSingle()

    if (error) throw error
    return data
}
