import { getLineClient } from "../deps.js";

export async function fetchUserProfile(userId: string) {
  try {
    const api = getLineClient();
    return await Promise.resolve(api.getProfile(userId));
  } catch {
    return null;
  }
}
