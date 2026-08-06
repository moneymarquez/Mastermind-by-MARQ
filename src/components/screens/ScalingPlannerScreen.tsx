import type { CSSProperties } from 'react';
import { useQuestionnaireTable } from '../../data/useQuestionnaireTable';
import { SCALING_PLANNER_QUESTIONS, generatePlanText } from '../../data/scalingPlannerQuestions';
import type { ScalingPlan } from '../../data/types';
import QuestionnaireFlow from './QuestionnaireFlow';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

export default function ScalingPlannerScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { rows, loading, active, activeId, setActiveId, start, saveAnswer, complete, remove } =
    useQuestionnaireTable<ScalingPlan>('scaling_plans', 'plan_text');

  return (
    <QuestionnaireFlow
      homeHeadStyle={homeHeadStyle}
      homeSubStyle={homeSubStyle}
      title="Scaling Planner"
      subtitle="The business fundamentals — pairs with Brand Lab for the visual side."
      flagNote="Nova-assisted answering/refinement and true AI synthesis aren't live yet — this generates a structured plan from your answers directly. Swap in once the Nova reasoning layer is connected."
      questions={SCALING_PLANNER_QUESTIONS}
      rows={rows}
      loading={loading}
      active={active}
      activeId={activeId}
      setActiveId={setActiveId}
      start={start}
      saveAnswer={saveAnswer}
      complete={complete}
      remove={remove}
      generate={generatePlanText}
      getText={(row) => row.plan_text}
      itemLabel={(row) => row.answers.name || 'Untitled plan'}
      newLabel="New plan"
    />
  );
}
