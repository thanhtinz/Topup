import { getSettings } from "./settings";
import { openSecret } from "./gateways";

export async function getFacebookConfig() {
  const s = await getSettings();
  const appId = (s.fb_app_id ?? "").trim();
  const appSecret = openSecret(s.fb_app_secret);
  return {
    enabled: s.fb_login_enabled === "1" && !!appId && !!appSecret,
    appId,
    appSecret,
  };
}
