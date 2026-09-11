-- 기능: Q5 삭제에 맞춰 기존 structure_score를 선택값으로 변경
-- 기존 사용자의 값은 유지하고, 새 4문항 온보딩에서는 값을 저장하지 않는다.

alter table public.driving_preferences
    alter column structure_score drop not null;

-- Supabase API가 변경된 테이블 정의를 즉시 반영하도록 schema cache를 갱신한다.
notify pgrst, 'reload schema';
