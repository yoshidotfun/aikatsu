import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync('index.html','utf8'), js=readFileSync('app.js','utf8');
assert.match(js,/length:85/);
assert.match(js,/pointerdown/);
assert.match(js,/localStorage/);
assert.match(html,/id="quantityDialog"/);
assert.match(html,/grid-template-columns:repeat\(2/);

// カードデータ部分だけ実行して、ローカル画像パスが card.code から正しく作られるか確認
const {cards,parseSaved}=vm.runInNewContext(`${js.slice(0,js.indexOf('const storageKey'))};({cards,parseSaved})`);
const base='assets/cards/';
assert.equal(cards.length,85);
assert.equal(cards[0].image,`${base}E1-01_PR.webp`);
assert.equal(cards[84].image,`${base}E1-85_N.webp`);
assert.ok(cards.every(c => c.image===`${base}${c.code}.webp`));
assert.equal(new Set(cards.map(c=>c.image)).size,85);
assert.doesNotMatch(js,/https?:\/\//);

// 保存データの正規化: 壊れたJSON・非オブジェクト・不正な枚数でも85枚 × 0〜99の整数になる
const zeros=Object.fromEntries(cards.map(c=>[c.no,0]));
for(const text of [null,'','{','not json','null','[]','[1,2]','42','"str"','true']) assert.deepEqual({...parseSaved(text)},zeros,String(text));
const q=parseSaved(JSON.stringify({1:3,2:-1,3:2.7,4:'abc',5:150,6:'7',7:null,8:{},9:99,10:-0.5,0:5,86:5,foo:5}));
assert.deepEqual([1,2,3,4,5,6,7,8,9,10].map(n=>q[n]),[3,0,2,0,99,7,0,0,99,0]);
assert.deepEqual(Object.keys(q).map(Number),[...cards.map(c=>c.no)]);
assert.ok(Object.values(q).every(v=>Number.isInteger(v) && v>=0 && v<=99));

// localStorage の読み書きが例外を投げても起動・タップ操作が落ちない
// showModal は本物と同じく「開いている状態で再度呼ぶと例外」にして二重表示を検出する
const el=()=>({value:'',textContent:'',innerHTML:'',open:false,shows:0,on:{},addEventListener(t,f){this.on[t]=f;},showModal(){ if(this.open) throw new Error('already open'); this.open=true; this.shows++; },close(){ this.open=false; this.on.close?.(); },select(){}});
// タイマーは手動で進める（550ms の長押しタイマーだけを fire で発火）
function boot(storage){
  const els={}, $=s=>(els[s]??=el()), timers=new Map(); let id=0;
  vm.runInNewContext(js,{document:{querySelector:$,querySelectorAll:()=>[]},localStorage:storage,navigator:{},setTimeout:(f,ms)=>(timers.set(++id,{f,ms}),id),clearTimeout:i=>timers.delete(i)});
  const pending=()=>[...timers.values()].filter(t=>t.ms===550).length;
  const fire=()=>{ for(const [i,t] of timers) if(t.ms===550){ timers.delete(i); t.f(); } };
  const ev=(x=0,y=0,extra={})=>({target:{closest:()=>({dataset:{no:'1'}})},clientX:x,clientY:y,isPrimary:true,button:0,shiftKey:false,key:'',preventDefault(){},...extra});
  const on=$('#grid').on, owned=()=>Number($('#ownedCount').textContent), dlg=$('#quantityDialog');
  return {on,ev,fire,pending,owned,dlg};
}
const boom=()=>{ throw new Error('storage blocked'); };
{ const {on,ev,owned}=boot({getItem:boom,setItem:boom}); on.click(ev()); assert.equal(owned(),1); }

const mem=()=>({getItem:()=>null,setItem(){}});
// 通常タップ: ちょうど1回トグルし、押下状態は残らない
{ const {on,ev,fire,pending,owned,dlg}=boot(mem());
  on.pointerdown(ev()); on.pointerup(ev()); assert.equal(pending(),0); on.click(ev()); assert.equal(owned(),1);
  fire(); assert.equal(dlg.shows,0);
  on.pointerdown(ev()); on.pointerup(ev()); on.click(ev()); assert.equal(owned(),0); }
// 10px を超えて動いたら長押しを取り消し、状態も完全に消える（戻ってきても再開しない）
{ const {on,ev,fire,pending,dlg}=boot(mem());
  on.pointerdown(ev(0,0)); on.pointermove(ev(5,5)); assert.equal(pending(),1);
  on.pointermove(ev(11,0)); assert.equal(pending(),0); on.pointermove(ev(0,0)); fire(); assert.equal(dlg.shows,0);
  for(const end of ['pointercancel','pointerleave']){ on.pointerdown(ev()); on[end](ev()); assert.equal(pending(),0,end); } }
// 主ポインター・左ボタン以外では長押しを開始しない
{ const {on,ev,pending}=boot(mem());
  on.pointerdown(ev(0,0,{isPrimary:false})); on.pointerdown(ev(0,0,{button:2})); assert.equal(pending(),0); }
// 長押し成功: 1回だけ開き、続く contextmenu でも例外なし、直後の click は無視、次のタップは通常どおり
{ const {on,ev,fire,owned,dlg}=boot(mem());
  on.pointerdown(ev()); fire(); assert.equal(dlg.shows,1); assert.ok(dlg.open);
  on.contextmenu(ev()); on.keydown(ev(0,0,{shiftKey:true,key:'Enter'})); assert.equal(dlg.shows,1);
  on.pointerup(ev()); on.click(ev()); assert.equal(owned(),0);
  dlg.close(); on.pointerdown(ev()); on.pointerup(ev()); on.click(ev()); assert.equal(owned(),1); }
// 長押し後に click が届かずダイアログを閉じても、次のキーボード click は抑止されない
{ const {on,ev,fire,owned,dlg}=boot(mem());
  on.pointerdown(ev()); fire(); on.pointerup(ev()); dlg.close(); on.click(ev()); assert.equal(owned(),1); }
// 右クリック・Shift+Enter: それぞれ1回だけ開き、その後のタップは抑止されない
{ const {on,ev,pending,owned,dlg}=boot(mem());
  on.pointerdown(ev(0,0,{button:2})); on.contextmenu(ev()); on.contextmenu(ev()); assert.equal(dlg.shows,1); assert.equal(pending(),0);
  dlg.close(); on.keydown(ev(0,0,{shiftKey:true,key:'Enter'})); assert.equal(dlg.shows,2);
  dlg.close(); on.pointerdown(ev()); on.pointerup(ev()); on.click(ev()); assert.equal(owned(),1); }

// 同梱画像: ちょうど85枚、すべて空でなく、カードデータと1対1で一致
const files=readdirSync(base).filter(f=>f.endsWith('.webp')).sort();
assert.equal(files.length,85);
assert.equal(files[0],'E1-01_PR.webp');
assert.equal(files[84],'E1-85_N.webp');
assert.deepEqual(files,[...cards.map(c=>`${c.code}.webp`)].sort());
assert.ok(files.every(f=>statSync(base+f).size>0));

// 画像要素の属性・未所持のグレー表示・フォールバック・表記
for(const attr of ['<img src="${c.image}"','alt="','loading="lazy"','decoding="async"','onerror="this.remove()"']) assert.ok(js.includes(attr),attr);
assert.match(html,/\.art \{[^}]*filter:grayscale\(1\)/);
assert.match(html,/\.card\.owned \.art \{[^}]*filter:none/);
assert.doesNotMatch(html,/content:"♡"/);
assert.doesNotMatch(html,/権利確認後/);
assert.doesNotMatch(html,/公式サイトから表示/);
assert.match(html,/同梱した画像/);
assert.match(html,/非公式/);
assert.match(html,/権利者に帰属/);
console.log('smoke test: ok');
