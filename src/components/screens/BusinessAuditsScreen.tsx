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
      subtitle="Surfaces bottlenecks from a structured set of questions."
      flagNote="This question set is a generic placeholder — once the Scaling 101 material is linked, it gets replaced with an audit built on that framework. The summary below is templated from your answers, not scored yet."
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
