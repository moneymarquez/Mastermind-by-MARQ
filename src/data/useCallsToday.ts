import { useContacts } from './useContacts';
import { useCallOutcomes } from './useCallOutcomes';
import { useDialingQueue } from './useLeadflow';
import { countCalledToday } from '../components/screens/leadflow/leadFilters';
import { useDailyCallGoal } from './useDailyCallGoal';
import { dialStreak } from './dialStreak';
import { dateStr } from './time';

/** Calls made today, counted the way the Dialing screen counts them:
 *  outcomes logged on dialing contacts plus leads called from the lead
 *  queue. Home's tile and greeting used only the first, so a session spent
 *  entirely on the lead queue read as zero calls on the Overview. */
export function useCallsToday(): { callsToday: number; streak: number; loading: boolean } {
  const { contacts, loading: contactsLoading } = useContacts();
  const dialingContacts = contacts.filter((c) => c.source === 'dialing');
  const { todayCount, history, loading: outcomesLoading } = useCallOutcomes(dialingContacts);
  const goal = useDailyCallGoal();
  // Owner-only route; for anyone else it answers 403 and the queue stays
  // empty, which is the right count for them.
  const { queue } = useDialingQueue();
  const callsToday = todayCount + countCalledToday(queue);
  return { callsToday, streak: dialStreak(history, goal, dateStr(new Date()), callsToday), loading: contactsLoading || outcomesLoading };
}
