// v0.25.0「长夜」：在后台把地图底图先画好，主线程进图时不再卡一下。
// 画好的底图转成 ImageBitmap 传回去；地面种类、灯、火星这些是普通数据一起传。
// 农场的水面、地面查询是函数，传不过去：主线程按地面种类表重新接上（载入页一开就先在这里画当前那张）。
import "./district-data.js";
import "./beyond-data.js";
import { bakeMap } from "./pixel-maps.js";

self.onmessage = (ev) => {
  const region = ev.data?.region;
  try {
    const art = bakeMap(region);
    if (!art?.canvas?.transferToImageBitmap) {
      self.postMessage({ region, ok: false });
      return;
    }
    const plain = {};
    for (const [k, v] of Object.entries(art)) {
      if (k === "canvas") continue;
      if (typeof v === "function") {
        // 农场的“是不是水面”“地面种类”主线程按地面种类表重新接上；别的函数传不过去，交给主线程画
        if (region === "farm" && (k === "water" || k === "surface")) continue;
        self.postMessage({ region, ok: false });
        return;
      }
      plain[k] = v;
    }
    const bitmap = art.canvas.transferToImageBitmap();
    self.postMessage({ region, ok: true, bitmap, art: plain }, [bitmap]);
  } catch (err) {
    self.postMessage({ region, ok: false, err: String(err?.message || err) });
  }
};
