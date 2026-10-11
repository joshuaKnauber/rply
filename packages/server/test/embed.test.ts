import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { embedDocument } from "@rply/schema/helpers";

function run(html: string) {
  const doc = embedDocument({ html }, "parent", "dark");
  const posted: any[] = [];
  const ctx: any = {
    document: { documentElement: { dataset: { theme: "dark" } } },
    parent: { postMessage: (m: unknown) => posted.push(m) },
    addEventListener() {},
    dispatchEvent: (e: any) => posted.push(e),
    CustomEvent: function (this: any, type: string, init: any) {
      Object.assign(this, { type, init });
    },
    Map,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const [, script] of doc.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script!, ctx);
  return { doc, ctx, posted };
}

test("the embed bridge only adds rply globals, so apps can use any names", () => {
  const { ctx } = run("<script>const post = 1; const store = 2; let calls = 3, call = 4, nextId = 5; window.theme = rply.theme;</script>");
  assert.equal(ctx.theme, "dark");
  assert.equal(typeof ctx.rply.call, "function");
});

test("full HTML documents lose their outer doctype and html tags", () => {
  const { doc } = run("<!DOCTYPE html>\n<html lang='en'><head><title>x</title></head><body>hi</body></html>");
  assert.equal(doc.match(/<!doctype/gi)?.length, 1);
  assert.equal(doc.match(/<html/g)?.length, 1);
  assert.ok(doc.includes("<body>hi</body>"));
});

test("theme changes update data-theme and fire rply:theme once", () => {
  const { ctx, posted } = run("");
  ctx.__rplyReceive({ rply: "theme", theme: "light" });
  ctx.__rplyReceive({ rply: "theme", theme: "light" });
  assert.equal(ctx.rply.theme, "light");
  assert.deepEqual(posted.map((e) => [e.type, e.init.detail]), [["rply:theme", "light"]]);
});
