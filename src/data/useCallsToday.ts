import { useContacts } from './useContacts';
import { useCallOutcomes } from './useCallOutcomes';
import { useDialingQueue } from './useLeadflow';
import { countCalledToday } from '../components/screens/leadflow/leadFilters';

/** Calls made today, counted the way the Dialing screen counts them:
 *  outcomes logged on dialing contacts plus leads called from the lead
 *  queue. Home's tile and greeting used only the first, so a session spent
 *  entirely on the lead queue read as zero calls on the Overview. */
export function useCallsToday(): { callsToday: number; loading: boolean } {
  const { contacts, loading: contactsLoading } = useContacts();
  const dialingContacts = contacts.filter((c) => c.source === 'dialing');
  const { todayCount, loading: outcomesLoading } = useCallOutcomes(dialingContacts);
  // Owner-only route; for anyone else it answers 403 and the queue stays
  // empty, which is the right count for them.
  const { queue } = useDialingQueue();
  return { callsToday: todayCount + countCalledToday(queue), loading: contactsLoading || outcomesLoading };
}
