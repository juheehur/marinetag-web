-- 테이블 생성 함수
CREATE OR REPLACE FUNCTION create_fish_photos_table()
RETURNS void AS $$
BEGIN
  -- fish_photos 테이블 생성
  CREATE TABLE IF NOT EXISTS public.fish_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url TEXT NOT NULL,
    species TEXT,
    location JSONB,
    analysis JSONB,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );

  -- 행 수준 보안 활성화
  ALTER TABLE public.fish_photos ENABLE ROW LEVEL SECURITY;

  -- 기존 정책이 있는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fish_photos' AND policyname = 'Public Access'
  ) THEN
    -- 공개 접근 정책 생성 (기존 정책이 없을 경우에만)
    CREATE POLICY "Public Access" ON public.fish_photos
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 즉시 함수 실행
SELECT create_fish_photos_table();

-- 테이블이 이미 있으면 메시지 출력
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fish_photos') THEN
    RAISE NOTICE 'fish_photos 테이블이 이미 존재합니다.';
  END IF;
END $$;

-- 테이블 직접 생성 (함수가 실행되지 않을 경우 대비)
CREATE TABLE IF NOT EXISTS public.fish_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  species TEXT,
  location JSONB,
  analysis JSONB,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 행 수준 보안 활성화
ALTER TABLE public.fish_photos ENABLE ROW LEVEL SECURITY;

-- 공개 접근 정책 생성
CREATE POLICY "Public Access" ON public.fish_photos
  FOR ALL
  USING (true)
  WITH CHECK (true); 