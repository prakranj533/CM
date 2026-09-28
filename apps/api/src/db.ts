import { firestore } from "./firestore.js";

export { firestore };

export async function disconnect(): Promise<void> {
  await firestore.terminate();
}
