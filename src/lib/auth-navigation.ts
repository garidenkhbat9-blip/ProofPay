import { safeReturn } from "./domain";
import { entryPerspective } from "./judge-access";

export function needsAccountConfirmation(
  destination: string,
  userId: string | undefined,
  authenticatedHere: boolean,
  confirmedAccount: string | null,
) {
  return !!userId && !!entryPerspective(destination) && !authenticatedHere && confirmedAccount !== userId;
}

export function authenticationReturn(explicit: string | null, pending: string | null) {
  // An invalid explicit destination must not resurrect an older pending route.
  return safeReturn(explicit !== null ? explicit : pending);
}
