-- ============================================================================
-- 안전하길 · auth.users → public.users 자동 프로필 생성 트리거
-- ============================================================================
-- 근거: 03_Auth_권한_흐름.xlsx
--   - "이메일 회원가입" Step 5: DB Trigger가 auth.users.id/email/user_metadata로
--     public.users row 생성 ("프로필 생성 실패 시 로그인 차단")
--   - "소셜 로그인" Step 3: 동일한 DB Trigger가 email/provider metadata로
--     public.users row 생성 ("추가 아이디 입력 화면 없음")
--
-- 전제:
--   - public.users(id, username, email, nickname, signup_provider,
--                   is_active, onboarding, withdrawn_at, created_at, updated_at)
--   - public.users.id 는 auth.users(id) 를 참조하는 uuid FK 여야 함
--     (아직 아니라면 아래 "사전 점검" 섹션 먼저 실행)
--   - public.users 는 RLS가 켜져 있으므로, 트리거 함수는 SECURITY DEFINER로
--     실행해 RLS를 우회해야 insert가 성공함
--
-- username 규칙(스펙 03시트 Step1 검증 규칙과 동일): ^[a-z][a-z0-9_]{4,19}$
--   - 이메일 가입: Frontend가 signUp() 호출 시 options.data.username 으로 전달
--     → 이미 정규식을 통과한 값이 온다고 가정하고 그대로 사용
--   - 소셜 로그인(구글/카카오): 입력 화면이 없으므로, auth.users.id(uuid)를 이용해
--     정규식을 만족하는 값을 자동 생성 (예: "u" + uuid 앞 10자리, 소문자/숫자만이라
--     정규식 통과. 충돌 확률은 사실상 0에 가까움 — MVP 범위에서는 별도 dedup 불필요)
-- ============================================================================

-- ── 0. (선택) 사전 점검: public.users.id가 auth.users(id) FK인지 확인 ───────
-- 아직 아니라면 아래처럼 맞춰주세요 (컬럼이 이미 uuid이고 데이터가 없다는 전제):
--
-- alter table public.users
--   alter column id set data type uuid using id::uuid,
--   add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- ── 1. 트리거 함수 ──────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_nickname text;
  v_provider text;
begin
  -- username: 이메일 가입은 프론트가 넘겨준 값, 소셜 로그인은 자동 생성
  v_username := new.raw_user_meta_data ->> 'username';
  if v_username is null or v_username !~ '^[a-z][a-z0-9_]{4,19}$' then
    v_username := 'u' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  -- nickname: 이메일 가입은 프론트가 넘겨준 nickname, 소셜은 provider가 준 이름
  v_nickname := coalesce(
    new.raw_user_meta_data ->> 'nickname',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    v_username
  );

  -- signup_provider: 팀 컨벤션은 google / kakao / naver / local 네 가지.
  -- Supabase는 이메일·비밀번호 가입 시 app_metadata.provider에 자동으로
  -- 'email'을 넣어주므로, 이 값만 팀 컨벤션인 'local'로 바꿔서 저장.
  -- (naver는 Supabase 기본 제공 provider가 아니라 Custom OAuth로 붙일 예정이라
  --  실제 연동 시 provider 값이 'naver'로 그대로 오는지 다시 확인 필요)
  v_provider := coalesce(new.raw_app_meta_data ->> 'provider', 'local');
  if v_provider = 'email' then
    v_provider := 'local';
  end if;

  insert into public.users (
    id, username, email, nickname, signup_provider,
    is_active, onboarding, created_at, updated_at
  )
  values (
    new.id,
    v_username,
    new.email,          -- 카카오 등 이메일 미동의 시 null일 수 있음(허용 여부는 email 컬럼 제약과 함께 팀 결정 필요)
    v_nickname,
    v_provider,
    true,
    false,
    now(),
    now()
  );

  return new;
exception
  when others then
    -- 스펙 명시대로 "프로필 생성 실패 시 로그인 차단": 예외를 그대로 올려서
    -- auth.users insert(=가입 자체)까지 롤백되게 함
    raise exception 'public.users 프로필 생성 실패 (auth.users.id=%): %', new.id, sqlerrm;
end;
$$;

-- ── 2. 트리거 등록 ──────────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_user();

-- ============================================================================
-- 테스트 방법
-- ============================================================================
-- 1) Supabase 대시보드 SQL Editor에서 이 파일 전체 실행
-- 2) 지금까지 하신 것처럼 브라우저에서
--    https://<project-ref>.supabase.co/auth/v1/authorize?provider=google 로 로그인
-- 3) SQL Editor에서 아래 쿼리로 확인
--    select * from public.users order by created_at desc limit 5;
--    → username(u로 시작하는 자동생성 값), signup_provider='google' 등이
--      정상적으로 채워졌는지 확인
-- ============================================================================
