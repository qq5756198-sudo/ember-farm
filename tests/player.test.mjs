import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine,freshState,districtDemoState} from '../dist/districts.js';
import {freshState as oldFresh} from '../dist/engine.js';
import {CROPS,REGIONS,ITEMS} from '../dist/data.js';
import {DISTRICTS} from '../dist/district-data.js';
import {firstHarvestStep,districtOpportunities,renderJourney} from '../dist/player-journey.js';
const mem=()=>{const map=new Map();return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const text=money=>{const s=freshState();s.money=money;return JSON.stringify(s);};

test('district invitations reflect earned prerequisites and do not unlock or gift anything during rendering',()=>{const e=new Engine(freshState());e.s.stats.harvested=1;e.s.stats.sold=1;const before=e.serialize();const rows=districtOpportunities(e);assert.deepEqual(rows.map(d=>d.id),['valley','stationMarket']);assert.equal(e.serialize(),before);assert.equal(e.unlockDistrict('quarantine'),false);e.s.region='market';e.assignRegion();Object.assign(e.s.player,DISTRICTS.stationMarket.gate);e.s.inventory.wood=0;e.s.inventory.scrap=0;const money=e.s.money;assert.equal(e.unlockDistrict('stationMarket'),false);assert.equal(e.s.money,money);assert.equal(e.d.unlocked.stationMarket,undefined);});
