import BrainNudgeCard from '../brain/BrainNudgeCard';
import { useMyTeams } from '../../../data/useDispatch';
import { FromOwnerSection } from '../../../dispatch/FromOwner';

/** Kept on Home: the Brain nudge and the member side of Dispatch ("From <lead>"). */
export function HomeExtras({ currentUserId, onNavigate }: { currentUserId?: string; onNavigate: (screen: string) => void }) {
  const { teams } = useMyTeams(!!currentUserId);
  return (
    <>
      <BrainNudgeCard onOpen={() => onNavigate('brain')} />
      {currentUserId && teams.map((t) => <FromOwnerSection key={t.owner_id} team={t} userId={currentUserId} />)}
    </>
  );
}
