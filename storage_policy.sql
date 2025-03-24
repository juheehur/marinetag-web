-- 스토리지 정책 설정 (Supabase Studio에서 실행)

-- 'photos' 버킷에 대한 모든 사용자 INSERT 권한 부여
CREATE POLICY "공개 업로드 정책" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'photos');

-- 'photos' 버킷에 대한 모든 사용자 SELECT 권한 부여
CREATE POLICY "공개 조회 정책" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'photos');

-- 'photos' 버킷에 대한 모든 사용자 UPDATE 권한 부여
CREATE POLICY "공개 수정 정책" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'photos');

-- 'photos' 버킷에 대한 모든 사용자 DELETE 권한 부여
CREATE POLICY "공개 삭제 정책" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'photos'); 