-- fish_photos 테이블에 새로운 컬럼 추가
ALTER TABLE IF EXISTS public.fish_photos 
  ADD COLUMN IF NOT EXISTS count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS resolution JSONB,
  ADD COLUMN IF NOT EXISTS water_conditions JSONB,
  ADD COLUMN IF NOT EXISTS environmental_data JSONB,
  ADD COLUMN IF NOT EXISTS morphological_data JSONB;

-- JSON 필드 타입 지정 & 기본값 설정 (오류 방지)
ALTER TABLE IF EXISTS public.fish_photos 
  ALTER COLUMN resolution SET DEFAULT '{"width": 0, "height": 0}'::jsonb,
  ALTER COLUMN water_conditions SET DEFAULT '{"temperature": null, "turbidity": "자동 측정 불가", "salinity": "자동 측정 불가"}'::jsonb,
  ALTER COLUMN environmental_data SET DEFAULT '{"weather": "자동 측정 불가", "time_of_day": "오후", "season": "여름", "habitat_type": "미확인"}'::jsonb,
  ALTER COLUMN morphological_data SET DEFAULT '{"length_estimate": "크기 미상", "color_pattern": "색상 미상", "distinctive_features": ["특징적 요소 없음"]}'::jsonb;

-- 기존 데이터가 있다면 기본값으로 업데이트
UPDATE public.fish_photos 
SET 
  count = 1,
  resolution = '{"width": 0, "height": 0}'::jsonb,
  water_conditions = '{"temperature": null, "turbidity": "자동 측정 불가", "salinity": "자동 측정 불가"}'::jsonb,
  environmental_data = '{"weather": "자동 측정 불가", "time_of_day": "오후", "season": "여름", "habitat_type": "미확인"}'::jsonb,
  morphological_data = '{"length_estimate": "크기 미상", "color_pattern": "색상 미상", "distinctive_features": ["특징적 요소 없음"]}'::jsonb
WHERE 
  count IS NULL OR
  resolution IS NULL OR
  water_conditions IS NULL OR
  environmental_data IS NULL OR 
  morphological_data IS NULL;

-- 변경사항 알림 메시지
DO $$
BEGIN
  RAISE NOTICE 'fish_photos 테이블이 업데이트되었습니다.';
END $$;
