import type { CSSProperties } from 'react';
import { useQuestionnaireTable } from '../../data/useQuestionnaireTable';
import { BUSINESS_AUDIT_QUESTIONS, generateAuditSummary } from '../../data/businessAuditQuestions';
import type { BusinessAudit } from '../../data/types';
import QuestionnaireFlow from './QuestionnaireFlow';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

export default function BusinessAuditsScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { rows, loading, active, activeId, setActiveId, start, saveAnswer, complete, remove } =
    useQuestionnaireTable<BusinessAudit>('business_audits', 'summary_text');

  return (
    <QuestionnaireFlow
      homeHeadStyle={homeHeadStyle}
      homeSubStyle={homeSubStyle}
      title="Business Audits"
      subtitle="16 questions across the Scaling 101 curriculum — Foundation through Advanced Scaling."
      flagNote="Grounded in your Scaling 101 material — one question per critical/high-priority topic that's actually diagnosable, not a fill-in-the-blank of all 30 topics. The summary groups your answers by phase and flags any thin ones; it's templated, not a real Nova-scored audit yet."
      questions={BUSINESS_AUDIT_QUESTIONS}
      rows={rows}
      loading={loading}
      active={active}
      activeId={activeId}
      setActiveId={setActiveId}
      start={start}
      saveAnswer={saveAnswer}
      complete={complete}
      remove={remove}
      generate={generateAuditSummary}
      getText={(row) => row.summary_text}
      itemLabel={(row) => `Audit — ${new Date(row.created_at).toLocaleDateString()}`}
      newLabel="New audit"
    />
  );
}
