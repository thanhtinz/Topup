import { visiblePackages } from "../src/lib/visibility";

const P = (provider: string) => ({ provider });
let fail = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
}

eq("dual + ERIS", visiblePackages({ priority: "ERIS" }, [P("FZR"), P("ERIS"), P("MANUAL")]).map((p) => p.provider), ["ERIS", "MANUAL"]);
eq("dual + FZR", visiblePackages({ priority: "FZR" }, [P("FZR"), P("ERIS")]).map((p) => p.provider), ["FZR"]);
eq("dual + ERIS_ONLY", visiblePackages({ priority: "ERIS_ONLY" }, [P("FZR"), P("ERIS")]).map((p) => p.provider), ["ERIS"]);
eq("dual + FZR_ONLY", visiblePackages({ priority: "FZR_ONLY" }, [P("FZR"), P("ERIS")]).map((p) => p.provider), ["FZR"]);
eq("single FZR + priority ERIS (không lọc)", visiblePackages({ priority: "ERIS" }, [P("FZR"), P("FZR")]).length, 2);
eq("single ERIS + priority FZR (không lọc)", visiblePackages({ priority: "FZR" }, [P("ERIS")]).length, 1);
eq("chỉ MANUAL", visiblePackages({ priority: "ERIS" }, [P("MANUAL")]).length, 1);
console.log(fail === 0 ? "ALL PASS" : `${fail} FAIL`);
process.exit(fail ? 1 : 0);
