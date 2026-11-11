// Fixture: the sidecar's adapter. It names the entry it was asked for, so the test can see
// which entry the registry handed it; it plays nothing.
export async function sidecarKernel(entryId: string) {
  return { entryId, run(): void {} };
}
