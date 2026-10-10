// 新画面：十五张地图的底图从这里取。第一次进某张地图时才画，画好就留着。
// 每张图返回：底图画布、地面种类、灯（窗、灯、火、霓虹…）、余烬、烟囱、积水点，以及这张图的天气习惯。
import { bakeFarm, puddleSpots } from "./pixel-farm.js";
import { CITY } from "./pixel-city.js";
import { DISTRICT_ART, FRONTIER_ART } from "./pixel-lands.js";
import { S, puddlesOn } from "./pixel-build.js";

const TABLE = { ...CITY, ...DISTRICT_ART, ...FRONTIER_ART };
// 这张图的天气习惯：室内（地下城）没有天气、一直是灯光；霜原的雨落下来是雪；松林常年有雾；雨巷总是湿的
export const MAP_MOOD = {
  shelter: { indoor: true },
  frost: { snowy: true },
  pinewood: { mist: true },
  courtyard: { wet: true },
  shipyard: { waterEdge: true },
  archive: { waterEdge: true },
};
export function hasMapArt(region) {
  return region === "farm" || !!TABLE[region];
}
// 画好后只留画布和地面种类；逐像素的原始数据很大（每张约 1.5 MB），只有测试要看时才留着
export function bakeMap(region, { keepPix = false } = {}) {
  let out = null;
  if (region === "farm") {
    const f = bakeFarm();
    out = {
      ...f,
      chimneys: [f.chimney].filter(Boolean),
      puddles: puddleSpots(f.map),
      mood: {},
    };
  } else {
    const make = TABLE[region];
    if (!make) return null;
    const art = make();
    const codes = region === "shelter" ? [] : [S.road, S.paving, S.dirt, S.wood];
    out = { ...art, puddles: codes.length ? puddlesOn(art.map, codes, region === "courtyard" ? 46 : 34, 900 + region.length * 13) : [], mood: MAP_MOOD[region] || {} };
  }
  if (!keepPix) delete out.pix;
  return out;
}
