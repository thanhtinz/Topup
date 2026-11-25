import { tgSellCents, tgCostCents, normalizeTgUsername, TG_STAR_PACKS } from "../src/lib/telegram";

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (got === want) { pass++; } else { fail++; console.log(`FAIL ${name}: got ${got} want ${want}`); }
};

eq("sell 1 star", tgSellCents(0.0163, 7), 2);            
eq("sell 50 stars", tgSellCents(0.0163 * 50, 7), 88);    
eq("sell 100000 stars", tgSellCents(0.0163 * 100000, 7), 174410); 
eq("cost 50 stars", tgCostCents(0.0163 * 50), 82);       
eq("sell premium 12m $71.99 m7", tgSellCents(71.99, 7), 7703); 
eq("cost premium", tgCostCents(71.99), 7199);
eq("sell markup 0", tgSellCents(10, 0), 1000);
eq("username @user_name1", normalizeTgUsername("@user_name1"), "user_name1");
eq("username plain", normalizeTgUsername("abcde"), "abcde");
eq("username too short", normalizeTgUsername("ab1"), null);
eq("username bad chars", normalizeTgUsername("user name"), null);
eq("username empty", normalizeTgUsername(""), null);
eq("packs count", TG_STAR_PACKS.length, 14);
console.log(`telegram math: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
