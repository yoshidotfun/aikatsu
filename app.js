const rarityRanges = [
  [1,4,'PR'],[5,20,'R'],[21,29,'N'],[30,32,'ER'],[33,36,'PR'],[37,40,'R'],[41,49,'N'],
  [50,50,'ER'],[51,52,'PR'],[53,59,'R'],[60,70,'N'],[71,82,'PR'],[83,85,'N']
];
const rarityName = { PR:'プレミアムレア', R:'レア', N:'ノーマル', ER:'アンコールレア' };
const cards = Array.from({length:85},(_,i) => {
  const no=i+1, rarity=rarityRanges.find(([a,b]) => no>=a && no<=b)[2], code=`E1-${String(no).padStart(2,'0')}_${rarity}`;
  return { no, rarity, code, image:`assets/cards/${code}.webp` };
});
// 保存データは壊れていても起動を止めない: 既知の85枚だけを 0〜99 の整数に正規化
function clampQty(v){ return Math.min(99,Math.max(0,Math.floor(Number(v))||0)); }
function parseSaved(text){
  let data; try{ data=JSON.parse(text||'{}'); }catch{ data={}; }
  if(!data || typeof data!=='object' || Array.isArray(data)) data={};
  return Object.fromEntries(cards.map(c=>[c.no,clampQty(data[c.no])]));
}
const storageKey='aikatsu-encore-collection-v1';
let stored=null; try{ stored=localStorage.getItem(storageKey); }catch{}
const saved=parseSaved(stored);
// press: 押下中のカード情報 {no,x,y,timer}。終了・キャンセル・ダイアログ表示は必ず endPress() を通す
let filter='all', editing=null, press=null, suppressClick=false;
const dialog=document.querySelector('#quantityDialog');
const grid=document.querySelector('#grid'), search=document.querySelector('#search');

function quantity(no){ return saved[no]||0; }
function persist(){ try{ localStorage.setItem(storageKey,JSON.stringify(saved)); }catch{} }
function render(){
  const term=search.value.trim().toLowerCase();
  const visible=cards.filter(c => {
    const owned=quantity(c.no)>0;
    return (!term || `${c.code} ${rarityName[c.rarity]}`.toLowerCase().includes(term)) && (filter==='all' || (filter==='owned')===owned);
  });
  grid.innerHTML=visible.map(c => {
    const qty=quantity(c.no), owned=qty>0;
    return `<button class="card ${owned?'owned':''}" data-no="${c.no}" aria-pressed="${owned}" aria-label="${c.code} ${rarityName[c.rarity]} ${owned?`${qty}枚所持`:'未所持'}">
      ${qty>1?`<span class="qty">×${qty}</span>`:''}<span class="art"><span class="code">${c.code}</span><img src="${c.image}" alt="${c.code} ${rarityName[c.rarity]}のカード画像" loading="lazy" decoding="async" draggable="false" onerror="this.remove()"></span>
      <span class="meta"><span class="rarity">${rarityName[c.rarity]}</span><span class="mark">${owned?'✓':'＋'}</span></span></button>`;
  }).join('') || '<p class="empty" style="display:block">該当するカードがありません</p>';
  document.querySelector('#ownedCount').textContent=cards.filter(c=>quantity(c.no)>0).length;
  document.querySelector('#totalCount').textContent=cards.reduce((sum,c)=>sum+quantity(c.no),0);
}
function toggle(no){ saved[no]=quantity(no)?0:1; persist(); render(); }
function endPress(){ if(press) clearTimeout(press.timer); press=null; }
function openQuantity(no){
  if(press) suppressClick=true; // 押下中に開いた（長押し）なら、離した後の click は無視
  endPress();
  if(dialog.open) return; // 長押し後の contextmenu などで二重に開かない
  editing=no;
  document.querySelector('#dialogTitle').textContent=`E1-${String(no).padStart(2,'0')} の所持枚数`;
  document.querySelector('#quantity').value=quantity(no)||1;
  dialog.showModal();
  setTimeout(()=>document.querySelector('#quantity').select(),0);
  navigator.vibrate?.(35);
}
grid.addEventListener('pointerdown',e=>{
  const card=e.target.closest('.card');
  endPress(); suppressClick=false;
  if(!card || !e.isPrimary || e.button!==0) return;
  const no=Number(card.dataset.no);
  press={ no, x:e.clientX, y:e.clientY, timer:setTimeout(()=>openQuantity(no),550) };
});
grid.addEventListener('pointermove',e=>{ if(press && Math.hypot(e.clientX-press.x,e.clientY-press.y)>10) endPress(); });
for(const event of ['pointerup','pointercancel','pointerleave']) grid.addEventListener(event,endPress);
grid.addEventListener('click',e=>{ const card=e.target.closest('.card'); if(suppressClick){ suppressClick=false; return; } if(card) toggle(Number(card.dataset.no)); });
grid.addEventListener('contextmenu',e=>{ const card=e.target.closest('.card'); if(card){ e.preventDefault(); openQuantity(Number(card.dataset.no)); } });
grid.addEventListener('keydown',e=>{ const card=e.target.closest('.card'); if(card && e.shiftKey && e.key==='Enter'){ e.preventDefault(); openQuantity(Number(card.dataset.no)); } });
search.addEventListener('input',render);
document.querySelector('.filters').addEventListener('click',e=>{ if(!e.target.dataset.filter)return; filter=e.target.dataset.filter; document.querySelectorAll('.filters button').forEach(b=>b.classList.toggle('active',b===e.target)); render(); });
document.querySelector('.cancel').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{ suppressClick=false; }); // 長押し後の click が届かなかった場合も持ち越さない
document.querySelector('#quantityForm').addEventListener('submit',()=>{ saved[editing]=clampQty(document.querySelector('#quantity').value); persist(); render(); });
render();
