import { getSettings } from "./settings";
import { openSecret } from "./gateways";

export async function getGoogleConfig() {
  const s = await getSettings();
  const clientId = (s.google_client_id ?? "").trim();
  const clientSecret = openSecret(s.google_client_secret);
  return {
    enabled: s.google_login_enabled === "1" && !!clientId && !!clientSecret,
    clientId,
    clientSecret,
  };
}
