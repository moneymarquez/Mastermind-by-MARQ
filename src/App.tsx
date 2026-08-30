import AuthedGate from './AuthedGate';
import { useAuth } from './auth/useAuth';
import AuthScreen from './auth/AuthScreen';
import { isOwnerIdentity } from './auth/ownerIdentity';
import { useUserRole } from './data/useUserRole';
import ClientPortal from './client-portal/ClientPortal';

interface GatedProps {
  userId: string;
  userEmail: string | null | undefined;
  onSignOut: () => void;
}

/** Resolves role BEFORE AuthedGate ever mounts, so a client-login account
 *  (schema_045_client_login.sql) never touches AuthedGate's hooks at all —
 *  no useMastermindState, no module/subscription queries, none of it.
 *  Only the owner path needs to stay perfectly synchronous (see
 *  ownerIdentity.ts); everyone else pays one profiles lookup here. */
function Gated({ userId, userEmail, onSignOut }: GatedProps) {
  const isOwner = isOwnerIdentity({ id: userId, email: userEmail });
  const { role, loading } = useUserRole(isOwner);

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  }
  if (role === 'client') {
    return <ClientPortal onSignOut={onSignOut} />;
  }
  return <AuthedGate userId={userId} userEmail={userEmail} onSignOut={onSignOut} />;
}

export default function App() {
  const { session, loading, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  }

  if (!session) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  // Keyed on the user id so a sign-out/sign-in as a different account
  // forces a fresh mount — and a fresh mount is what makes the data hooks
  // below fetch for the right account instead of carrying over stale
  // state. userId/userEmail are passed down (not re-fetched inside) so
  // the owner check stays synchronous and zero-network — see
  // src/auth/ownerIdentity.ts for why that matters.
  return (
    <Gated key={session.user.id} userId={session.user.id} userEmail={session.user.email} onSignOut={signOut} />
  );
}
