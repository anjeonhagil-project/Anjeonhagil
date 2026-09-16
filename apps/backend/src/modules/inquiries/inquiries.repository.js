// # 기능: INQ-001~003: 사용자 문의 등록/목록/상세 DB query 전담
import { supabase } from '../../lib/supabase.js'

const INQUIRY_SELECT = [
    'id',
    'user_id',
    'category',
    'title',
    'content',
    'status',
    'answer_content',
    'created_at',
    'answered_at',
    'updated_at',
].join(', ')

export async function createInquiry({ userId, category, title, content }) {
    const { data, error } = await supabase
        .from('inquiries')
        .insert({
            user_id: userId,
            category,
            title,
            content,
        })
        .select(INQUIRY_SELECT)
        .single()

    if (error) throw error
    return data
}

export async function findInquiriesByUserId({ userId, page, limit }) {
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data, error, count } = await supabase
        .from('inquiries')
        .select(INQUIRY_SELECT, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) throw error
    return { inquiries: data ?? [], total: count ?? 0 }
}

export async function findInquiryByIdAndUserId(inquiryId, userId) {
    const { data, error } = await supabase
        .from('inquiries')
        .select(INQUIRY_SELECT)
        .eq('id', inquiryId)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) throw error
    return data
}
