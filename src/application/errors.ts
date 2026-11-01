/**
 * Base for errors whose message is written for the owner and safe to show.
 *
 * Recognise them with `isUserFacingError`, never `instanceof`: Next.js bundles
 * Server Actions and pages as separate module layers, and the shared container
 * (cached on globalThis, so there is one database pool and one extraction queue)
 * may have been built by the other layer and throw its copy of the class.
 */
export class UserFacingError extends Error {
  readonly userFacing = true;
}

export function isUserFacingError(error: unknown): error is UserFacingError {
  return error instanceof Error && (error as Partial<UserFacingError>).userFacing === true;
}
