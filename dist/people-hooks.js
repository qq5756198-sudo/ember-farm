// 居民卡上各层加的几行：居民页（工作日报）和营地的居民表都会接上。
// v0.26：心情三档（为什么高兴、为什么不高兴、来劲时什么样）。
export const RESIDENT_HOOKS = [];
export const residentExtras = (e, r) => RESIDENT_HOOKS.map((hook) => hook(e, r) || "").join("");
