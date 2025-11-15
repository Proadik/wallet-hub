/**
 * Shortens a public key by showing the first few and last few characters
 * @param publicKey - The full public key string
 * @param startLength - Number of characters to show at the start (default: 4)
 * @param endLength - Number of characters to show at the end (default: 4)
 * @returns Shortened public key like "143g****21gs" or null if input is null
 */
export function shortenPublicKey(
  publicKey: string | null,
  startLength: number = 4,
  endLength: number = 4
): string | null {
  if (!publicKey) return null;
  
  if (publicKey.length <= startLength + endLength) {
    return publicKey;
  }
  
  const start = publicKey.slice(0, startLength);
  const end = publicKey.slice(-endLength);
  return `${start}****${end}`;
}

