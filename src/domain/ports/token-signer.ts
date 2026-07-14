export type AccessTokenPayload = {
  userId: string;
  email: string;
};

export interface TokenSigner {
  sign(payload: AccessTokenPayload): string;
}
