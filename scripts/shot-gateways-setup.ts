import "../tests/env";
import { setSetting } from "../src/lib/settings";
import { sealSecret } from "../src/lib/gateways";

async function main() {
  await setSetting("pay_sepay_enabled", "1");
  await setSetting("sepay_bank_name", "MB Bank");
  await setSetting("sepay_bank_bin", "MB");
  await setSetting("sepay_account_number", "0123456789");
  await setSetting("sepay_account_name", "BNT SHOP");
  await setSetting("sepay_secret", sealSecret("test-sepay-key-123"));
  await setSetting("pay_bntpay_enabled", "1");
  await setSetting("bntpay_api_key", sealSecret("test-merchant-key"));
  await setSetting("bntpay_webhook_secret", sealSecret("test-webhook-secret"));
  console.log("đã bật cấu hình test cho 2 cổng");
}
main();
