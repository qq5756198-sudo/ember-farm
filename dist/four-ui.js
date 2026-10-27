// v0.44.0「四季」的界面这一层：
// · 设施图标换成新画的 16×16 小图（建造页、拆掉一样设施、说明卡；原来是旧图集像素化出来的，好几样共用一个箱子）；
// · 快捷栏“建造”那一格换成锤子和木板。
// （标题页动起来：字一行行亮起来、“余烬农场”的橙边一明一暗在 ui.css；后面的农场、飘着的东西在 four-renderer.js。）
import { registerFourIcons, iconRef } from "./four-art.js";

registerFourIcons();

// 快捷栏“建造”那一格、建造页“摆件”那一格用的图标
export const buildToolIcon = () => iconRef("t:buildTool") || 43;
export const decorIcon = () => iconRef("b:trDecor");
