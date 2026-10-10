ALTER TABLE "ExperimentConfig"
  ADD COLUMN "practiceADurationMinutes" DOUBLE PRECISION NOT NULL DEFAULT 5,
  ADD COLUMN "practiceBDurationMinutes" DOUBLE PRECISION NOT NULL DEFAULT 5;
ALTER TABLE "ExperimentConfig" ADD CONSTRAINT "practice_role_durations_valid"
  CHECK ("practiceADurationMinutes" >= 0.5 AND "practiceADurationMinutes" < 'Infinity'::float8
     AND "practiceBDurationMinutes" >= 0.5 AND "practiceBDurationMinutes" < 'Infinity'::float8);

-- Targeted corrections only. Preserve administrator edits and historical responses.
CREATE FUNCTION pg_temp.feedback1002(value jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb; entry record;
BEGIN
  IF jsonb_typeof(value) = 'array' THEN
    SELECT COALESCE(jsonb_agg(pg_temp.feedback1002(element) ORDER BY ordinal), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(value) WITH ORDINALITY a(element, ordinal);
    RETURN result;
  ELSIF jsonb_typeof(value) = 'object' THEN
    result := value;
    FOR entry IN SELECT key, val FROM jsonb_each(value) e(key, val) LOOP
      result := jsonb_set(result, ARRAY[entry.key], pg_temp.feedback1002(entry.val));
    END LOOP;
    IF value->>'code' = 'DEMO-02' THEN result := jsonb_set(result, '{options}', '["男","女"]'); END IF;
    IF value->>'type' = 'number' THEN result := jsonb_set(result, '{min}', '0'); END IF;
    IF value->>'title' = '人口特征统计和其他信息采集问卷' THEN
      result := jsonb_set(result, '{title}', '"实验后问卷"');
    END IF;
    IF value->>'title' = '合作、验证与责任信念' THEN
      result := jsonb_set(result, '{description}', '"以下问题请结合刚才的任务体验，以及你对类似任务的理解作答。"');
    END IF;
    IF value ? 'postSurvey' THEN
      result := jsonb_set(result, '{postSurvey,title}', '"实验后问卷"');
      result := jsonb_set(result, '{version}', '"three_chapter_v3_1_20261010"');
    END IF;
    RETURN result;
  END IF;
  RETURN value;
END $$;
UPDATE "QuestionnaireTemplate" SET "items" = pg_temp.feedback1002("items"::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE "items"::jsonb ? 'postSurvey' AND (
  "id" = 'three-chapter-questionnaire-v3-0'
  OR "id" IN (SELECT "activeQuestionnaireTemplateId" FROM "ExperimentConfig")
);
